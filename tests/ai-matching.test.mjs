import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Execute the real orchestration against SQLite and a controlled AI binding.
// These are contract tests; deployment checks cover the actual Workers runtime.
const env = {};
globalThis.concertmatchTestEnv = env;
const bundle = await build({
  entryPoints: ["lib/ai-matching.ts"],
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
          contents: "export const env = globalThis.concertmatchTestEnv;",
        }));
      },
    },
  ],
});
const directory = mkdtempSync(join(tmpdir(), "concertmatch-ai-test-"));
const bundledFile = join(directory, "assessment.mjs");
writeFileSync(bundledFile, bundle.outputFiles[0].text);
const { recommendConcerts } = await import(pathToFileURL(bundledFile).href);
unlinkSync(bundledFile);
rmdirSync(directory);
const group = {
  id: "test-group",
  members: [
    {
      id: "member",
      name: "Private name",
      artists: [{ id: "favorite", name: "Favorite", genres: ["Pop"] }],
      genres: [],
    },
  ],
  preferences: {
    city: "Private city",
    lat: 52,
    lng: 13,
    radius: 100,
    from: "2026-10-01",
    to: "2027-01-01",
    budget: 0,
    discovery: true,
  },
};
const events = [
  {
    id: "concert",
    title: "Band",
    artists: [{ id: "band", name: "Band", genres: ["Pop"] }],
    genres: ["Pop"],
    lat: 52,
    lng: 13,
    date: "2026-11-01",
    status: "onsale",
    city: "Test city",
    venue: "Test venue",
    source: "Test",
    url: "https://example.com/concert",
    checkedAt: "2026-10-01T00:00:00Z",
  },
];
const valid = JSON.stringify({
  recommendations: [
    {
      id: 0,
      scores: [78],
      confidence: "medium",
      reason: "Melodischer Pop, aber mit mehr Gitarren.",
    },
  ],
});
const usage = { prompt_tokens: 4000, completion_tokens: 2000 };
function fixture(ai) {
  const sql = new DatabaseSync(":memory:");
  sql.exec(
    "CREATE TABLE rate_limits(key TEXT PRIMARY KEY,count INTEGER,expires_at INTEGER); CREATE TABLE cache(key TEXT PRIMARY KEY,data TEXT,expires_at INTEGER); CREATE TABLE groups(id TEXT PRIMARY KEY); CREATE TABLE members(id TEXT PRIMARY KEY,artists TEXT,genres TEXT)",
  );
  sql.prepare("INSERT INTO groups VALUES(?)").run(group.id);
  sql
    .prepare("INSERT INTO members VALUES(?,?,?)")
    .run("member", JSON.stringify(group.members[0].artists), "[]");
  env.AI = ai;
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
        async run() {
          return sql.prepare(query).run(...values);
        },
      };
    },
  };
  return sql;
}
test("successful diagnostics, usage refund and raw cache survive without another inference", async () => {
  let calls = 0;
  const sql = fixture({
    async run() {
      calls++;
      return { response: valid, usage };
    },
  });
  try {
    const live = await recommendConcerts(group, events);
    assert.equal(live.debug.status, "live");
    assert.equal(live.debug.output, valid);
    assert.equal(live.debug.budget.used, 316);
    assert.equal(live.recommendations.concert.scores.member, 78);
    assert.ok(!live.debug.input.includes("Private name"));
    assert.ok(!live.debug.input.includes("Private city"));
    const cached = await recommendConcerts(group, events);
    assert.equal(cached.debug.status, "cache");
    assert.equal(cached.debug.outputSource, "raw");
    assert.equal(cached.debug.output, valid);
    assert.equal(calls, 1);
    // Older caches are still reused without invalidating their existing key.
    sql
      .prepare("UPDATE cache SET data=?")
      .run(JSON.stringify(JSON.parse(valid).recommendations));
    const legacy = await recommendConcerts(group, events);
    assert.equal(legacy.debug.status, "cache");
    assert.equal(legacy.debug.outputSource, "validated-cache");
    assert.equal(calls, 1);
  } finally {
    sql.close();
  }
});
test("large catalogues constrain generation and accept a discovery near the end", async () => {
  const catalogue = Array.from({ length: 300 }, (_, i) => ({
    ...events[0],
    id: "concert-" + i,
    title: "Band " + i,
    artists: [{ id: "band-" + i, name: "Band " + i, genres: ["Pop"] }],
  }));
  const sql = fixture({
    async run(_model, request) {
      const format =
        request.response_format.json_schema.properties.recommendations;
      assert.equal(format.maxItems, 16);
      assert.equal(format.minItems, 16);
      assert.equal(format.items.properties.scores.minItems, 1);
      assert.equal(format.items.properties.scores.maxItems, 1);
      assert.equal(format.items.properties.id.maximum, 299);
      const input = JSON.parse(request.messages[1].content);
      assert.equal(input.candidates.length, 300);
      return {
        response: JSON.stringify({
          recommendations: Array.from({ length: 16 }, (_, i) => ({
            id: 299 - i,
            scores: [70],
            confidence: "medium",
            reason:
              "Favorite und Band 299 teilen melodischen Pop, mit mehr Gitarren beim Live-Act.",
          })),
        }),
        usage,
      };
    },
  });
  try {
    const result = await recommendConcerts(group, catalogue);
    assert.equal(result.mode, "ai");
    assert.equal(result.recommendations["concert-299"].scores.member, 70);
  } finally {
    sql.close();
  }
});

test("an incomplete large-catalogue assessment falls back without caching a one-result answer", async () => {
  const catalogue = Array.from({ length: 30 }, (_, i) => ({
    ...events[0],
    id: "different-" + i,
    artists: [{ id: "band-" + i, name: "Band " + i, genres: ["Pop"] }],
  }));
  const sql = fixture({
    async run() {
      return { response: valid, usage };
    },
  });
  try {
    const result = await recommendConcerts(group, catalogue);
    assert.equal(result.mode, "genres");
    assert.equal(result.debug.status, "invalid-output");
    assert.equal(result.debug.assessedCount, 1);
    assert.equal(sql.prepare("SELECT count(*) AS n FROM cache").get().n, 0);
  } finally {
    sql.close();
  }
});

test("chat-completion envelopes validate and never expose internal reasoning", async () => {
  const sql = fixture({
    async run(model, input) {
      assert.equal(model, "@cf/meta/llama-4-scout-17b-16e-instruct");
      assert.equal(input.response_format.type, "json_schema");
      return {
        choices: [
          {
            message: { content: valid, reasoning_content: "Private reasoning" },
          },
        ],
        usage,
      };
    },
  });
  try {
    const result = await recommendConcerts(group, events);
    assert.equal(result.mode, "ai");
    assert.equal(result.recommendations.concert.scores.member, 78);
    assert.ok(!JSON.stringify(result).includes("Private reasoning"));
  } finally {
    sql.close();
  }
});
test("invalid output is visible for debugging, refunds usage and preserves genre fallback", async () => {
  const raw = JSON.stringify({
    recommendations: [
      {
        id: 999,
        scores: [78],
        confidence: "medium",
        reason: "Unknown candidate",
      },
    ],
  });
  const sql = fixture({
    async run() {
      return { response: raw, usage };
    },
  });
  try {
    const result = await recommendConcerts(group, events);
    assert.equal(result.mode, "genres");
    assert.equal(result.debug.status, "invalid-output");
    assert.equal(result.debug.output, raw);
    assert.equal(result.debug.budget.used, 316);
    assert.equal(result.recommendations, undefined);
    assert.match(result.notice, /KI ist gerade nicht verfügbar/);
    assert.equal(sql.prepare("SELECT count(*) AS n FROM cache").get().n, 0);
    assert.equal(
      sql
        .prepare(
          "SELECT count(*) AS n FROM rate_limits WHERE key LIKE 'ai:lease:%'",
        )
        .get().n,
      0,
    );
  } finally {
    sql.close();
  }
});
test("budget stoppage skips inference and reports the app budget only in diagnostics", async () => {
  const sql = fixture({
    async run() {
      assert.fail("Model must not run");
    },
  });
  try {
    const day = Math.floor(Date.now() / 86400000);
    sql
      .prepare("INSERT INTO rate_limits VALUES(?,?,?)")
      .run("ai:day:" + day, 7800, (day + 1) * 86400);
    const result = await recommendConcerts(group, events);
    assert.equal(result.debug.status, "budget-exhausted");
    assert.equal(result.debug.budget.used, 7800);
    assert.equal(result.debug.output, undefined);
    assert.doesNotMatch(result.notice, /Kontingent|Tageslimit/);
    assert.equal(
      sql
        .prepare(
          "SELECT count(*) AS n FROM rate_limits WHERE key LIKE 'ai:lease:%'",
        )
        .get().n,
      0,
    );
  } finally {
    sql.close();
  }
});
test("provider failure and missing binding remain distinct without exposing provider secrets", async () => {
  const sql = fixture({
    async run() {
      throw new Error("Sensitive upstream details");
    },
  });
  try {
    const failed = await recommendConcerts(group, events);
    assert.equal(failed.debug.status, "provider-error");
    assert.equal(failed.debug.budget.used, 1200);
    assert.ok(!JSON.stringify(failed).includes("Sensitive"));
    env.AI = undefined;
    assert.equal(
      (await recommendConcerts(group, events)).debug.status,
      "missing-binding",
    );
    assert.equal(
      (await recommendConcerts(group, [])).debug.status,
      "no-candidates",
    );
  } finally {
    sql.close();
  }
});
