import assert from "node:assert/strict";
import { rankConcerts } from "../lib/matching";
import { defaultPreferences } from "../lib/catalog";
import type { Artist, Group, Concert } from "../lib/types";

const origin = process.argv[2] || "http://localhost:5173";
assert.ok(
  ["http://localhost:5173", "https://concertmatch.ticore.workers.dev"].includes(
    origin,
  ),
);
let cookie = "";
async function api(path: string, body?: unknown) {
  const response = await fetch(origin + path, {
    method: body ? "POST" : "GET",
    headers: {
      Cookie: cookie,
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60000),
  });
  if (response.headers.get("set-cookie"))
    cookie = response.headers.get("set-cookie")!.split(";")[0];
  const data = (await response.json()) as Record<string, unknown>;
  assert.equal(response.status, 200, JSON.stringify(data));
  return data;
}
const profiles = [];
for (const name of ["Juice WRLD", "Lil Peep"]) {
  const data = await api("/api/artists?q=" + encodeURIComponent(name));
  const found = (data.artists as Artist[]).find(
    (a) => a.name.toLowerCase() === name.toLowerCase(),
  );
  assert.ok(found, name + " must be searchable independently of live concerts");
  profiles.push({ name: "QA " + name, artists: [found], genres: [] });
}
const created = await api("/api/groups", {
  name: "QA catalogue and ranking",
  profiles,
  preferences: defaultPreferences(),
});
const group = created.group as Group;
try {
  const start = Date.now();
  const data = await api("/api/concerts?group=" + group.id);
  const metadata = new Map(
    (data.artistMetadata as Artist[]).map((a) => [a.id, a]),
  );
  const members = group.members.map((m) => ({
    ...m,
    artists: m.artists.map((a) => metadata.get(a.id) || a),
  }));
  const ranked = rankConcerts(
    data.events as Concert[],
    members,
    group.preferences,
  );
  assert.ok(
    (data.events as Concert[]).length,
    "Live provider should return concert data",
  );
  assert.ok(ranked.every((m) => m.score > 0));
  console.log(
    JSON.stringify(
      {
        elapsedMs: Date.now() - start,
        events: (data.events as Concert[]).length,
        matches: ranked.length,
        enriched: (data.events as Concert[]).filter((e) =>
          e.artists.some((a) => a.mbid),
        ).length,
        top: ranked
          .slice(0, 10)
          .map((m) => ({
            title: m.concert.title,
            score: m.score,
            artists: m.concert.artists.map((a) => ({
              name: a.name,
              genres: a.genres,
              listeners: a.listeners,
            })),
            reasons: m.members.map((a) => a.reason),
          })),
      },
      null,
      2,
    ),
  );
} finally {
  const response = await fetch(origin + "/api/groups/" + group.id, {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "delete" }),
  });
  assert.equal(response.status, 200, "Remove only this disposable test group");
}
