import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const env = {};
globalThis.concertmatchProviderTestEnv = env;
const bundle = await build({
  entryPoints: ["lib/ticketmaster.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  plugins: [
    {
      name: "test-bindings",
      setup(build) {
        build.onResolve({ filter: /^cloudflare:workers$/ }, () => ({
          path: "bindings",
          namespace: "test",
        }));
        build.onLoad({ filter: /.*/, namespace: "test" }, () => ({
          contents:
            "export const env = globalThis.concertmatchProviderTestEnv;",
        }));
      },
    },
  ],
});
const dir = mkdtempSync(join(tmpdir(), "concertmatch-provider-test-")),
  file = join(dir, "providers.mjs");
writeFileSync(file, bundle.outputFiles[0].text);
const { searchConcerts, findConcert } = await import(pathToFileURL(file).href);
unlinkSync(file);
rmdirSync(dir);
const p = {
  city: "Berlin",
  lat: 52.5,
  lng: 13.4,
  radius: 100,
  from: "2099-11-01",
  to: "2099-11-30",
  budget: 0,
  discovery: true,
};
const event = {
  id: "1234567890123456789",
  rubricId: 2,
  title: { de: "Band live" },
  url: "https://eventfrog.de/de/p/band",
  begin: "2099-11-01T20:30:00+01:00",
  cancelled: false,
  visible: true,
  published: true,
  soldOut: false,
  agendaEntryOnly: false,
  locationIds: ["42"],
};
const location = {
  id: "42",
  title: { de: "Club" },
  city: "Berlin",
  lat: p.lat,
  lng: p.lng,
};
const originalFetch = globalThis.fetch;
function setup(
  t,
  { tm = false, ef = true, failTm = false, failEf = false } = {},
) {
  env.TICKETMASTER_API_KEY = tm ? "test-tm-secret" : "";
  env.EVENTFROG_API_KEY = ef ? "test-ef-secret" : "";
  // Controlled cache/lease binding: don't make a remote request or sleep in tests.
  env.DB = {
    prepare(sql) {
      return {
        bind() {
          return this;
        },
        async first() {
          return /rate_limits/.test(sql) ? { count: 1 } : null;
        },
        async run() {
          return {};
        },
      };
    },
  };
  const calls = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(input);
    calls.push(url);
    if (url.hostname === "app.ticketmaster.com") {
      if (failTm) throw new Error("Ticketmaster failure");
      if (url.pathname.endsWith("classifications.json"))
        return Response.json({ _embedded: { classifications: [] } });
      return Response.json({
        _embedded: {
          events: [
            {
              id: "tm-event",
              name: "Other band",
              url: "https://www.ticketmaster.de/event/tm-event",
              dates: { start: { localDate: "2099-11-01" } },
              _embedded: {
                venues: [
                  {
                    name: "Other Club",
                    city: { name: "Berlin" },
                    location: { latitude: "52.5", longitude: "13.4" },
                  },
                ],
              },
            },
          ],
        },
        page: { totalElements: 1, totalPages: 1 },
      });
    }
    assert.equal(url.hostname, "api.eventfrog.net");
    assert.equal(init.headers.Authorization, "Bearer test-ef-secret");
    assert.equal(url.searchParams.has("apiKey"), false);
    if (failEf) return new Response("unavailable", { status: 503 });
    if (url.pathname.endsWith("rubrics"))
      return Response.json({
        rubrics: [
          { id: 1, parentId: 0, title: { de: "Konzerte" } },
          { id: 2, parentId: 1, title: { de: "Rock" } },
        ],
      });
    if (url.pathname.endsWith("locations"))
      return Response.json({ locations: [location] });
    return Response.json({ events: [event], totalNumberOfResources: 1 });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    delete env.DB;
  });
  return calls;
}
test("Eventfrog-only search and saved-event lookup use real provider IDs and geographic filters", async (t) => {
  const calls = setup(t);
  const result = await searchConcerts(p, [], false);
  assert.equal(result.events[0].source, "Eventfrog");
  const query = calls.find((url) => url.pathname.endsWith("events"));
  assert.equal(query.searchParams.get("country"), "ALL");
  assert.equal(query.searchParams.get("r"), "100");
  assert.deepEqual(query.searchParams.getAll("rubId"), ["1", "2"]);
  const saved = await findConcert(result.events[0].id);
  assert.equal(saved.id, result.events[0].id);
  assert.equal(
    calls
      .filter((url) => url.pathname.endsWith("events"))
      .at(-1)
      .searchParams.get("id"),
    event.id,
  );
});
test("a Ticketmaster failure keeps Eventfrog results and reports incomplete coverage", async (t) => {
  setup(t, { tm: true, failTm: true });
  const result = await searchConcerts(p, [], false);
  assert.equal(result.events.length, 1);
  assert.match(result.notice, /Ticketmaster/);
});
test("an Eventfrog failure keeps Ticketmaster results without implying successful extra coverage", async (t) => {
  setup(t, { tm: true, failEf: true });
  const result = await searchConcerts(p, [], false);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].source, "Ticketmaster");
  assert.match(result.notice, /Eventfrog/);
});
test("missing provider credentials make no provider requests and fail clearly", async (t) => {
  const calls = setup(t, { ef: false });
  await assert.rejects(searchConcerts(p, [], false), /eingerichtet/);
  assert.equal(calls.length, 0);
});
