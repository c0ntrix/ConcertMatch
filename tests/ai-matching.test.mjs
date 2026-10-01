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
    assert.equal(live.debug.budget.used, 646);
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
    assert.equal(result.debug.budget.used, 646);
    assert.equal(result.recommendations, undefined);
    assert.match(result.notice, /Erweiterte KI-Suche ist momentan deaktiviert/);
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
      .run("ai:day:" + day, 7000, (day + 1) * 86400);
    const result = await recommendConcerts(group, events);
    assert.equal(result.debug.status, "budget-exhausted");
    assert.equal(result.debug.budget.used, 7000);
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
    assert.equal(failed.debug.budget.used, 1500);
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
