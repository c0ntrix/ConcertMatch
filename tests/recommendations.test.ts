import test from "node:test";
import assert from "node:assert/strict";
import {
  recommendationInput,
  parseRecommendations,
  mapRecommendations,
  recommendationSystem,
  AI_INPUT_BYTES,
  AI_MAX_CANDIDATES,
} from "../lib/recommendations";
import { rankConcerts } from "../lib/matching";
import { defaultPreferences } from "../lib/catalog";
import type { Concert, Member } from "../lib/types";
const p = defaultPreferences();
const members: Member[] = ["Taylor Swift", "Dua Lipa"].map((name, i) => ({
  id: String(i),
  name: "Private name " + i,
  artists: [{ id: name, name, genres: [] }],
  genres: [],
}));
const event = (
  id: string,
  name = id,
  overrides: Partial<Concert> = {},
): Concert => ({
  id,
  title: name,
  artists: [{ id: name, name, genres: [] }],
  date: p.to,
  venue: id,
  city: p.city,
  lat: p.lat,
  lng: p.lng,
  genres: [],
  url: "https://example.com",
  checkedAt: "",
  source: "Test",
  status: "onsale",
  ...overrides,
});
const row = (id: number, scores = [75, 70]) => ({
  id,
  scores,
  reason: "Gemeinsamer melodischer Pop, mit unterschiedlichem Tanzanteil.",
  confidence: "medium",
});

test("AI input excludes private names, locations and invalid events, with one assessment per lineup", () => {
  const input = recommendationInput(
    [
      event("one", "Sabrina Carpenter"),
      event("two", "Sabrina Carpenter"),
      event("cancelled", "Other", { status: "cancelled" }),
      event("far", "Far", { lat: 0 }),
    ],
    members,
    p,
  );
  assert.equal(input.lineups.length, 1);
  assert.equal(input.lineups[0].length, 2);
  assert.ok(!input.content.includes("Private name"));
  assert.ok(!input.content.includes(p.city));
  assert.ok(!input.content.includes("cancelled"));
});
test("only known candidate IDs and a complete score vector are accepted", () => {
  const input = recommendationInput([event("one")], members, p);
  for (const rows of [
    [row(8)],
    [row(0, [75])],
    [row(0), row(0)],
    [row(0, [999, 70])],
  ])
    assert.throws(() => parseRecommendations({ recommendations: rows }, input));
  assert.throws(() => parseRecommendations("not json", input));
});
test("all 50 selected artists reach the model when the context fits", () => {
  const artists = Array.from({ length: 50 }, (_, i) => ({
    id: String(i),
    name: "Favorite " + i,
    genres: [],
  }));
  const input = recommendationInput(
    [event("one")],
    [{ ...members[0], artists }],
    p,
  );
  assert.equal(JSON.parse(input.content).profiles[0].artists.length, 50);
  assert.ok(input.content.includes("Favorite 49"));
});
test("reversing billed headliner/support does not share an assessment", () => {
  const artists = [
    { id: "a", name: "Headliner", genres: [] },
    { id: "b", name: "Support", genres: [] },
  ];
  const input = recommendationInput(
    [
      event("one", "Show", { artists }),
      event("two", "Other show", { artists: [...artists].reverse() }),
    ],
    members,
    p,
  );
  assert.equal(input.lineups.length, 2);
});
test("unknown-act confidence is capped and assessments apply to real tour dates only", () => {
  const input = recommendationInput(
    [event("one", "Band"), event("two", "Band")],
    members,
    p,
  );
  const parsed = parseRecommendations(
    { recommendations: [{ ...row(0), confidence: "low" }] },
    input,
  );
  const output = mapRecommendations(parsed, input, members);
  assert.deepEqual(Object.keys(output), ["one", "two"]);
  assert.deepEqual(output.one.scores, { "0": 45, "1": 45 });
});

test("extra valid model assessments keep the strongest 16 after validating every row", () => {
  const input = recommendationInput(
    Array.from({ length: 18 }, (_, i) => event("candidate-" + i)),
    members,
    p,
  );
  const rows = Array.from({ length: 18 }, (_, i) => row(i, [40 + i, 40 + i]));
  const parsed = parseRecommendations({ recommendations: rows }, input);
  assert.equal(parsed.length, 16);
  assert.deepEqual(
    parsed.map((r) => r.id),
    Array.from({ length: 16 }, (_, i) => 17 - i),
  );
  assert.throws(() =>
    parseRecommendations(
      { recommendations: [...rows, row(999, [0, 0])] },
      input,
    ),
  );
  assert.throws(() =>
    parseRecommendations({ recommendations: [...rows, row(0, [0, 0])] }, input),
  );
  assert.throws(() =>
    parseRecommendations(
      { recommendations: [...rows.slice(0, 17), row(17, [99])] },
      input,
    ),
  );
});

test("system instructions and score example follow the actual number of profiles", () => {
  for (const count of [1, 2, 8]) {
    const system = recommendationSystem(count);
    const match = system.match(/"scores":(\[[\d,]+\])/);
    assert.ok(match);
    const example = JSON.parse(match[1]);
    assert.equal(example.length, count);
    assert.ok(system.includes(`GENAU ${count} Zahlen`));
  }
  assert.ok(
    recommendationSystem(1).includes(
      "Favoriten innerhalb eines Profils gehören zur selben Person",
    ),
  );
});
test("AI can discover relevant acts without genre metadata, while direct favorites stay exact", () => {
  const events = [
    event("pop", "Sabrina Carpenter"),
    event("direct", "Taylor Swift"),
    event("unjudged", "Unknown"),
  ];
  const input = recommendationInput(events, members, p);
  const id = input.lineups.findIndex((cs) => cs[0].id === "pop");
  const assessed = mapRecommendations(
    parseRecommendations({ recommendations: [row(id)] }, input),
    input,
    members,
  );
  const ranked = rankConcerts(events, members, p, assessed);
  assert.equal(ranked[0].concert.id, "pop");
  assert.equal(
    ranked.find((m) => m.concert.id === "direct")?.members[0].score,
    100,
  );
  assert.ok(!ranked.some((m) => m.concert.id === "unjudged"));
});

test("a partial AI assessment keeps unassessed style matches and honors explicit rejections", () => {
  const profile = {
    ...members[0],
    artists: [{ id: "taste", name: "Favorite", genres: ["synth-pop"] }],
  };
  const events = ["assessed", "unassessed", "rejected"].map((id) =>
    event(id, id, {
      artists: [{ id, name: id, genres: ["synth-pop"] }],
      genres: ["synth-pop"],
    }),
  );
  const ranked = rankConcerts(events, [profile], p, {
    assessed: {
      scores: { "0": 70 },
      reason: "Melodischer Synth-Pop.",
      confidence: "high",
    },
    rejected: {
      scores: { "0": 0 },
      reason: "Der musikalische Schwerpunkt passt nicht.",
      confidence: "high",
    },
  });
  assert.ok(ranked.some((m) => m.concert.id === "assessed"));
  assert.ok(ranked.some((m) => m.concert.id === "unassessed" && m.score > 0));
  assert.ok(!ranked.some((m) => m.concert.id === "rejected"));
});
test("large artist imports and candidate sets stay within the inference input budget", () => {
  const big = Array.from({ length: 8 }, (_, i) => ({
    ...members[0],
    id: String(i),
    artists: Array.from({ length: 50 }, (_, j) => ({
      id: String(j),
      name: "長い名前".repeat(20) + j,
      genres: ["alternative rock", "indie pop"],
    })),
  }));
  const input = recommendationInput(
    Array.from({ length: 800 }, (_, i) => event(String(i))),
    big,
    p,
  );
  assert.ok(new TextEncoder().encode(input.content).length <= AI_INPUT_BYTES);
  assert.equal(JSON.parse(input.content).profiles.length, 8);
  assert.ok(input.lineups.length > 0);
  assert.ok(input.lineups.length <= AI_MAX_CANDIDATES);
});
test("500 and 1000 km actually admit distant concerts but keep the radius boundary", () => {
  const nearby = event("450km", "Taylor Swift", { lat: p.lat - 4 });
  const far = event("890km", "Taylor Swift", { lat: p.lat - 8 });
  assert.equal(
    rankConcerts([nearby, far], members, { ...p, radius: 300 }).length,
    0,
  );
  assert.equal(
    rankConcerts([nearby, far], members, { ...p, radius: 500 }).length,
    1,
  );
  assert.equal(
    rankConcerts([nearby, far], members, { ...p, radius: 1000 }).length,
    2,
  );
});

test("cached artist metadata informs manually entered tastes without sending private fields", () => {
  const input = recommendationInput([event("one")], members, p, [
    {
      ...members[0].artists[0],
      genres: ["country pop", "synth-pop"],
      listeners: 1234,
    },
  ]);
  const payload = JSON.parse(input.content);
  assert.deepEqual(payload.profiles[0].artists[0].styles, [
    "country pop",
    "synth-pop",
  ]);
  assert.ok(!input.content.includes("listeners"));
});

test("ticket upgrades cannot enter the model's real concert candidates", () => {
  const input = recommendationInput(
    [
      event("regular", "Band"),
      event("upsell", "Band", { title: "Band - Premium Seats" }),
      event("hospitality", "Band", { title: "Band Hospitality" }),
      event("premium", "Band", { title: "Band | Premium Packages" }),
    ],
    members,
    p,
  );
  assert.deepEqual(
    input.lineups.flat().map((c) => c.id),
    ["regular"],
  );
});

test("harmless model deviations are normalized without weakening candidate checks", () => {
  const input = recommendationInput([event("one")], members, p);
  const parsed = parseRecommendations(
    {
      recommendations: [
        {
          ...row(0, [100, 95]),
          reason: "A".repeat(300),
          extra: "unused",
        },
      ],
    },
    input,
  );
  assert.deepEqual(parsed[0].scores, [92, 92]);
  assert.equal(parsed[0].reason.length, 240);
  assert.ok(!("extra" in parsed[0]));
  assert.throws(() =>
    parseRecommendations({ recommendations: [row(0, [101, 80])] }, input),
  );
});
