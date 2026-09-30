import test from "node:test";
import assert from "node:assert/strict";
import { resolveMetadataBatch } from "../lib/artist-metadata";
const a = { id: "mb:a", mbid: "a", name: "Example", genres: ["trap"] };
test("truncated catalogue pages cannot negative-cache missing artists or assign ambiguous identities", () => {
  assert.equal(
    resolveMetadataBatch(["Example", "Missing"], [a], false).size,
    0,
  );
});
test("complete catalogue responses resolve unique names and preserve ambiguous names", () => {
  const result = resolveMetadataBatch(["Example", "Missing"], [a], true);
  assert.equal(result.get("example")?.mbid, "a");
  assert.equal(result.get("missing"), null);
  assert.equal(
    resolveMetadataBatch(
      ["Example"],
      [a, { ...a, id: "mb:b", mbid: "b" }],
      true,
    ).get("example"),
    null,
  );
});
