import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";

const origin = process.argv[2];
if (
  origin !== "https://concertmatch.ticore.workers.dev" &&
  !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || "")
)
  throw new Error("Pass the ConcertMatch deployment or a loopback origin.");
function client() {
  let cookie = "";
  return async (path, body) => {
    const response = await fetch(origin + path, {
      method: body ? "POST" : "GET",
      headers: {
        Origin: origin,
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const session = response.headers.get("set-cookie");
    if (session) cookie = session.split(";")[0];
    return { status: response.status, data: await response.json() };
  };
}
const owner = client(),
  stranger = client();
let groupId;
try {
  const created = await owner("/api/groups", {
    name: "AI diagnostics disposable QA",
    profiles: [
      {
        name: "Synthetic test profile",
        artists: [
          { id: "qa:provinz", name: "Provinz", genres: ["Indie", "Pop"] },
          {
            id: "qa:annenmay",
            name: "AnnenMayKantereit",
            genres: ["Indie", "Rock"],
          },
        ],
        genres: [],
      },
    ],
  });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  groupId = created.data.group.id;
  assert.equal(
    (await stranger("/api/recommendations", { groupId })).status,
    404,
  );
  const concerts = await owner("/api/concerts?group=" + groupId);
  assert.equal(concerts.status, 200);
  assert.ok(concerts.data.events.length > 0);
  const live = await owner("/api/recommendations", { groupId });
  assert.equal(live.status, 200, JSON.stringify(live.data));
  writeFileSync(
    ".wrangler/ai-smoke-result.json",
    JSON.stringify(live.data, null, 2),
  );
  assert.equal(
    live.data.debug.status,
    "live",
    JSON.stringify({
      status: live.data.debug.status,
      error: live.data.debug.error,
      output: live.data.debug.output?.slice(0, 1200),
    }),
  );
  assert.equal(live.data.mode, "ai");
  assert.ok(live.data.debug.output.length > 0);
  assert.ok(live.data.debug.assessedCount <= 16);
  assert.ok(!live.data.debug.input.includes("Synthetic test profile"));
  const cached = await owner("/api/recommendations", { groupId });
  assert.equal(cached.data.debug.status, "cache");
  assert.equal(cached.data.debug.outputSource, "raw");
  assert.equal(cached.data.debug.output, live.data.debug.output);
  assert.deepEqual(cached.data.recommendations, live.data.recommendations);
  console.log(
    JSON.stringify({
      status: live.data.debug.status,
      candidates: live.data.debug.candidateCount,
      assessments: live.data.debug.assessedCount,
      durationMs: live.data.debug.durationMs,
      budget: live.data.debug.budget,
      cached: true,
      accessChecked: true,
    }),
  );
} finally {
  if (groupId) {
    const deleted = await owner("/api/groups/" + groupId, { action: "delete" });
    assert.equal(deleted.status, 200);
    assert.equal((await owner("/api/groups/" + groupId)).status, 404);
    console.log("Removed the disposable QA group and its assessment cache.");
  }
}
