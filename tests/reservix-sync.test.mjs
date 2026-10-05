import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { pathToFileURL } from "node:url";

const env = {};
globalThis.concertmatchReservixTestEnv = env;
const dir = mkdtempSync(join(tmpdir(), "concertmatch-reservix-test-"));
const bundle = await build({
  entryPoints: {
    sync: "app/api/providers/reservix/sync/route.ts",
    concerts: "lib/ticketmaster.ts",
  },
  outdir: dir,
  outExtension: { ".js": ".mjs" },
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
          contents: "export const env=globalThis.concertmatchReservixTestEnv;",
        }));
      },
    },
  ],
});
for (const output of bundle.outputFiles)
  writeFileSync(join(dir, basename(output.path)), output.text);
const { POST } = await import(pathToFileURL(join(dir, "sync.mjs")).href);
const { searchConcerts, findConcert } = await import(
  pathToFileURL(join(dir, "concerts.mjs")).href
);
for (const output of bundle.outputFiles)
  unlinkSync(join(dir, basename(output.path)));
rmdirSync(dir);

test("authenticated snapshot activation, incomplete import fallback, search geography, save and expiry", async (t) => {
  const sql = new DatabaseSync(":memory:");
  sql.exec(
    "CREATE TABLE cache(key TEXT PRIMARY KEY,data TEXT,expires_at INTEGER);",
  );
  env.RESERVIX_SYNC_TOKEN = "a".repeat(64);
  env.TICKETMASTER_API_KEY = "";
  env.EVENTFROG_API_KEY = "";
  env.DB = {
    prepare(query) {
      let values = [];
      return {
        bind(...args) {
          values = args;
          return this;
        },
        async first() {
          return sql.prepare(query).get(...values) ?? null;
        },
        async all() {
          return { results: sql.prepare(query).all(...values) };
        },
        async run() {
          return sql.prepare(query).run(...values);
        },
      };
    },
  };
  t.after(() => sql.close());
  const checkedAt = new Date().toISOString(),
    date = checkedAt.slice(0, 10);
  const concert = {
    id: "reservix:1234",
    title: "Band live",
    artists: [],
    date,
    time: "20:00",
    venue: "Club",
    city: "Berlin",
    lat: 52.52,
    lng: 13.4,
    url: "https://www.awin1.com/pclick.php?p=5678&a=3113053&m=31293",
    genres: ["Rock"],
    source: "Reservix",
    checkedAt,
    status: "onsale",
  };
  const p = {
    city: "Berlin",
    lat: 52.52,
    lng: 13.4,
    radius: 10,
    from: date,
    to: date,
    budget: 0,
    discovery: true,
  };
  const generation = crypto.randomUUID();
  const send = (data, token = env.RESERVIX_SYNC_TOKEN) =>
    POST(
      new Request("https://example.test/api/providers/reservix/sync", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ generation, checkedAt, ...data }),
      }),
    );
  assert.equal(
    (await send({ batch: 0, events: [concert] }, "é".repeat(64))).status,
    401,
  );
  assert.equal(
    (await send({ batch: 0, events: [concert] }, "wrong")).status,
    401,
  );
  assert.equal((await send({ batch: 0, events: [concert] })).status, 200);
  assert.equal((await send({ batches: 2, count: 2 })).status, 409);
  assert.deepEqual((await searchConcerts(p, [], false)).events, []);
  assert.equal((await send({ batches: 1, count: 1 })).status, 200);
  assert.equal((await searchConcerts(p, [], false)).events[0].id, concert.id);
  assert.equal((await findConcert(concert.id)).url, concert.url);
  const next = crypto.randomUUID();
  assert.equal(
    (
      await send({
        generation: next,
        batch: 0,
        events: [{ ...concert, id: "reservix:9999", lat: 48, lng: 10 }],
      })
    ).status,
    200,
  );
  assert.equal(
    (await send({ generation: next, batches: 2, count: 2 })).status,
    409,
  );
  assert.equal((await searchConcerts(p, [], false)).events[0].id, concert.id);
  assert.equal(
    (await send({ generation: next, batches: 1, count: 1 })).status,
    200,
  );
  assert.deepEqual((await searchConcerts(p, [], false)).events, []);
  sql.prepare("UPDATE cache SET expires_at=?").run(Date.now() - 1);
  assert.deepEqual((await searchConcerts(p, [], false)).events, []);
  await assert.rejects(findConcert("reservix:9999"), /aktualisiert/);
});
