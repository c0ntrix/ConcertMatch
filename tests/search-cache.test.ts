import test from "node:test";
import assert from "node:assert/strict";
import {
  SearchResultCache,
  SEARCH_CACHE_STORAGE,
  SEARCH_CACHE_TTL,
  type SearchResults,
} from "../lib/search-cache";
import { defaultPreferences } from "../lib/catalog";
import type { Group } from "../lib/types";
const group: Group = {
  id: "one",
  name: "Search",
  owner: true,
  expiresAt: Date.now() + 86400000,
  preferences: defaultPreferences(),
  saved: [],
  votes: [],
  members: [
    {
      id: "person",
      name: "Du",
      artists: [{ id: "taylor", name: "Taylor Swift", genres: ["Pop"] }],
      genres: [],
    },
  ],
};
const results: SearchResults = {
  events: [],
  artistMetadata: [],
  notice: "",
  checkedAt: "2026-10-01",
  recommendationNotice: "",
  recommendations: {},
};
function storage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
}
test("complete searches survive returning home and remounting, then expire", () => {
  const session = storage();
  const first = new SearchResultCache();
  first.put(group, results, session, 1000);
  assert.deepEqual(
    new SearchResultCache().get(group, session, 1000 + 4 * 60000),
    results,
  );
  assert.equal(
    new SearchResultCache().get(group, session, 1000 + SEARCH_CACHE_TTL),
    undefined,
  );
});
test("every taste, membership and filter change invalidates reuse, while votes and names do not", () => {
  const session = storage();
  const cache = new SearchResultCache();
  cache.put(group, results, session);
  assert.ok(
    cache.get(
      {
        ...group,
        name: "Renamed",
        members: [{ ...group.members[0], name: "Renamed person" }],
      },
      session,
    ),
  );
  for (const updated of [
    { ...group, id: "other" },
    { ...group, preferences: { ...group.preferences, aiSearch: true } },
    { ...group, preferences: { ...group.preferences, radius: 500 } },
    { ...group, preferences: { ...group.preferences, to: "2027-01-01" } },
    { ...group, members: [{ ...group.members[0], artists: [] }] },
    {
      ...group,
      members: [...group.members, { ...group.members[0], id: "other" }],
    },
  ])
    assert.equal(cache.get(updated, session), undefined);
});
test("corrupt browser storage and storage failures do not stop searches; deletion drops retained results", () => {
  const session = storage();
  const cache = new SearchResultCache();
  session.setItem(SEARCH_CACHE_STORAGE, "not json");
  assert.equal(cache.get(group, session), undefined);
  session.setItem(SEARCH_CACHE_STORAGE, JSON.stringify([{}]));
  assert.equal(cache.get(group, session), undefined);
  const unavailable = {
    getItem() {
      throw new Error("disabled");
    },
    setItem() {
      throw new Error("disabled");
    },
    removeItem() {},
  };
  cache.put(group, results, unavailable);
  assert.deepEqual(cache.get(group, unavailable), results);
  cache.remove(group.id, unavailable);
  assert.equal(cache.get(group, unavailable), undefined);
});

test("a failed storage write cannot replace newer in-memory results with older persisted data", () => {
  const session = storage();
  const cache = new SearchResultCache();
  cache.put(group, results, session, 1000);
  const full = {
    ...session,
    setItem() {
      throw new Error("quota");
    },
  };
  const updated = { ...results, notice: "New results" };
  cache.put(group, updated, full, 2000);
  assert.deepEqual(cache.get(group, full, 3000), updated);
});
