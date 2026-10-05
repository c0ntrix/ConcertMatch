import type {
  Artist,
  Concert,
  Group,
  Recommendations,
  RecommendationDebug,
} from "./types";

export const SEARCH_CACHE_STORAGE = "cm_search_results_v1";
export const SEARCH_CACHE_TTL = 15 * 60000;
const MAX_ENTRIES = 3;
// Storage quotas count UTF-16 bytes. Leave room for drafts and other settings.
const MAX_STORAGE_CHARS = 1_500_000;
type StorageAccess = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type SearchResults = {
  events: Concert[];
  artistMetadata: Artist[];
  recommendations?: Recommendations;
  recommendationDebug?: RecommendationDebug;
  recommendationNotice: string;
  notice: string;
  checkedAt: string;
};
type Entry = {
  key: string;
  groupId: string;
  expires: number;
  results: SearchResults;
};

// Authorization always comes from the fresh group response. Names, saved events
// and votes do not change the search; taste, membership and every filter do.
export function searchCacheKey(group: Group) {
  return JSON.stringify({
    version: 1,
    id: group.id,
    preferences: group.preferences,
    profiles: group.members.map((m) => ({
      id: m.id,
      artists: m.artists,
      genres: m.genres,
    })),
  });
}

function validArtist(artist: Artist) {
  return (
    artist &&
    typeof artist.id === "string" &&
    typeof artist.name === "string" &&
    Array.isArray(artist.genres) &&
    artist.genres.every((genre) => typeof genre === "string")
  );
}

function validEntry(entry: Entry, now: number) {
  const r = entry?.results;
  return (
    typeof entry?.key === "string" &&
    typeof entry.groupId === "string" &&
    Number.isFinite(entry.expires) &&
    entry.expires > now &&
    entry.expires <= now + SEARCH_CACHE_TTL &&
    Array.isArray(r?.events) &&
    Array.isArray(r.artistMetadata) &&
    r.artistMetadata.every(validArtist) &&
    r.events.every(
      (e) =>
        e &&
        typeof e.id === "string" &&
        typeof e.date === "string" &&
        typeof e.title === "string" &&
        typeof e.venue === "string" &&
        typeof e.city === "string" &&
        typeof e.url === "string" &&
        typeof e.source === "string" &&
        typeof e.status === "string" &&
        Number.isFinite(e.lat) &&
        Number.isFinite(e.lng) &&
        Array.isArray(e.artists) &&
        e.artists.every(validArtist) &&
        Array.isArray(e.genres) &&
        e.genres.every((genre) => typeof genre === "string"),
    ) &&
    typeof r.notice === "string" &&
    typeof r.checkedAt === "string" &&
    typeof r.recommendationNotice === "string"
  );
}

// This object belongs to one mounted browser component, never a Worker isolate.
export class SearchResultCache {
  private entries: Entry[] = [];

  get(group: Group, storage?: StorageAccess, now = Date.now()) {
    const key = searchCacheKey(group);
    if (storage) {
      try {
        const raw = storage.getItem(SEARCH_CACHE_STORAGE);
        if (raw && raw.length <= MAX_STORAGE_CHARS) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            // Preserve in-memory results when persistence was full or disabled.
            const seen = new Set<string>();
            this.entries = [...this.entries, ...parsed]
              .filter((e) => validEntry(e, now))
              .sort((a, b) => b.expires - a.expires)
              .filter((e) => {
                if (seen.has(e.key)) return false;
                seen.add(e.key);
                return true;
              })
              .slice(0, MAX_ENTRIES);
          }
        }
      } catch {
        // Disabled storage and malformed entries do not block a normal search.
      }
    }
    this.entries = this.entries.filter((e) => validEntry(e, now));
    return this.entries.find((e) => e.key === key)?.results;
  }

  put(
    group: Group,
    results: SearchResults,
    storage?: StorageAccess,
    now = Date.now(),
  ) {
    const key = searchCacheKey(group);
    this.entries = [
      { key, groupId: group.id, expires: now + SEARCH_CACHE_TTL, results },
      ...this.entries.filter((e) => e.key !== key && validEntry(e, now)),
    ].slice(0, MAX_ENTRIES);
    this.persist(storage);
  }

  remove(groupId: string, storage?: StorageAccess) {
    this.entries = this.entries.filter((e) => e.groupId !== groupId);
    this.persist(storage);
  }

  private persist(storage?: StorageAccess) {
    if (!storage) return;
    try {
      // Keep the newest complete searches within browser storage limits.
      const retained = [...this.entries];
      while (
        retained.length &&
        JSON.stringify(retained).length > MAX_STORAGE_CHARS
      )
        retained.pop();
      if (retained.length)
        storage.setItem(SEARCH_CACHE_STORAGE, JSON.stringify(retained));
      else storage.removeItem(SEARCH_CACHE_STORAGE);
    } catch {
      // In-memory reuse still works if browser storage is full or unavailable.
    }
  }
}
