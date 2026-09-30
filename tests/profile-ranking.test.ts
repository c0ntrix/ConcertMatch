import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { rankConcerts } from "../lib/matching";
import type { Concert, Member, Preferences } from "../lib/types";
const fixture = JSON.parse(
  fs.readFileSync(
    new URL("./fixtures/rap-profile.json", import.meta.url),
    "utf8",
  ),
) as { members: Member[]; preferences: Preferences; events: Concert[] };
test("mixed melodic-rap profiles rank Don Toliver and J. Cole ahead of peripheral pop and support matches", () => {
  const ranked = rankConcerts(
    fixture.events,
    fixture.members,
    fixture.preferences,
  );
  assert.equal(ranked[0].concert.artists[0].name, "Don Toliver");
  assert.equal(ranked[1].concert.artists[0].name, "J. Cole");
  assert.ok(
    ranked.findIndex((m) => m.concert.artists[0].name === "Kid Kapri") > 1,
  );
  assert.ok(
    !ranked.some((m) =>
      ["Pitbull", "Kehlani"].includes(m.concert.artists[0].name),
    ),
  );
});
