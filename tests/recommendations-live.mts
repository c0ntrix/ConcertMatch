import assert from "node:assert/strict";
import { defaultPreferences } from "../lib/catalog";
import { rankConcerts, haversine } from "../lib/matching";
import type { Concert, Group, Recommendations } from "../lib/types";

const origin = process.argv[2] || "http://localhost:5173";
assert.ok(
  ["http://localhost:5173", "https://concertmatch.ticore.workers.dev"].includes(
    origin,
  ),
);
let cookie = "";
async function api<T = Record<string, unknown>>(path: string, body?: unknown) {
  const r = await fetch(origin + path, {
    method: body ? "POST" : "GET",
    headers: {
      Cookie: cookie,
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(120000),
  });
  if (r.headers.get("set-cookie"))
    cookie = r.headers.get("set-cookie")!.split(";")[0];
  const data = (await r.json()) as T;
  assert.equal(r.status, 200, JSON.stringify(data));
  return data;
}
const cases: Record<string, string[][]> = {
  electronic: [
    ["Bicep", "Bonobo"],
    ["Fred again..", "Disclosure"],
  ],
  pop: [
    ["Taylor Swift", "Olivia Rodrigo"],
    ["Dua Lipa", "Ariana Grande"],
  ],
  metal: [
    ["Tool", "Deftones"],
    ["Spiritbox", "Loathe"],
  ],
};
const scenario = process.argv[3] || "electronic";
assert.ok(cases[scenario]);
const profiles = cases[scenario].map((names, i) => ({
  name: "QA music " + i,
  artists: names.map((name) => ({ id: "manual:" + name, name, genres: [] })),
  genres: [],
}));
const created = await api<{ group: Group }>("/api/groups", {
  name: "QA contextual recommendations " + scenario,
  profiles,
  preferences: { ...defaultPreferences(), radius: 500 },
});
const group = created.group as Group;
try {
  const data = await api<{ events: Concert[] }>(
    "/api/concerts?group=" + group.id,
  );
  const events = data.events as Concert[];
  assert.ok(
    events.some(
      (c) =>
        haversine(group.preferences, c) > 300 &&
        haversine(group.preferences, c) <= 500,
    ),
    "500 km should retrieve concerts outside the old radius",
  );
  const start = Date.now();
  const result = await api<{
    mode: string;
    notice: string;
    recommendations?: Recommendations;
  }>("/api/recommendations", { groupId: group.id });
  if (origin.startsWith("https:"))
    assert.equal(result.mode, "ai", result.notice);
  else assert.equal(result.mode, "genres");
  const ranked = rankConcerts(
    events,
    group.members,
    group.preferences,
    result.recommendations as Recommendations | undefined,
  );
  console.log(
    JSON.stringify(
      {
        scenario,
        mode: result.mode,
        elapsedMs: Date.now() - start,
        events: events.length,
        matches: ranked.length,
        top: ranked.slice(0, 8).map((m) => ({
          title: m.concert.title,
          score: m.score,
          distance: m.distance,
          members: m.members.map((p) => p.score),
          reason: m.members[0].reason,
        })),
      },
      null,
      2,
    ),
  );
  if (result.mode === "ai") {
    assert.ok(
      ranked.length > 0,
      "Known electronic profiles should have plausible live candidates",
    );
    assert.ok(
      ranked.every(
        (m) => m.members.every((s) => s.score >= 25) || !m.discovery,
      ),
    );
    const second = await api<{
      mode: string;
      recommendations?: Recommendations;
    }>("/api/recommendations", { groupId: group.id });
    assert.equal(second.mode, "ai");
    assert.deepEqual(
      second.recommendations,
      result.recommendations,
      "Repeated recommendations should use the cached assessment",
    );
  }
} finally {
  await api("/api/groups/" + group.id, { action: "delete" });
  console.log("Removed this test group.");
}
