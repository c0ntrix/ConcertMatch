import {
  discoveryGenres,
  musicGenres,
  type ClassificationCatalogue,
  type ProviderGenre,
} from "./discovery-plan";
import type { Artist, Concert, Member, Preferences } from "./types";
import { normalize } from "./catalog";
import { enrichArtists } from "./music-catalog";
import { sameArtist, genreKey, deduplicateConcerts } from "./matching";
import { ApiError, cached, config, db, putCache } from "./server";
import { requestPool } from "./request-pool";
import { withinEuroBudget } from "./concert-budget";
import {
  eventPages,
  parseEvent,
  ticketmasterArtist,
  type Attraction,
  type EventPage,
  type TicketmasterEvent,
} from "./ticketmaster-events";
type TicketmasterRequest = typeof tm;
export function geoHash(lat: number, lng: number, precision = 7) {
  const base = "0123456789bcdefghjkmnpqrstuvwxyz";
  let even = true,
    index = 0,
    bits = 0,
    result = "";
  const latitude = [-90, 90],
    longitude = [-180, 180];
  while (result.length < precision) {
    const range = even ? longitude : latitude;
    const value = even ? lng : lat;
    const mid = (range[0] + range[1]) / 2;
    index = index * 2 + (value >= mid ? 1 : 0);
    if (value >= mid) range[0] = mid;
    else range[1] = mid;
    even = !even;
    if (++bits === 5) {
      result += base[index];
      bits = 0;
      index = 0;
    }
  }
  return result;
}
async function tm<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  const key = config("TICKETMASTER_API_KEY");
  if (!key)
    throw new ApiError(
      "Die Konzertsuche wird gerade eingerichtet. Bitte versuche es später noch einmal.",
      503,
    );
  // Reserve a shared slot before consuming the daily budget. A burst from a
  // single search should wait briefly instead of losing later result pages.
  let acquired = false;
  for (let attempt = 0; attempt < 10; attempt++) {
    const now = Date.now();
    const row = await db()
      .prepare(
        "INSERT INTO rate_limits(key,count,expires_at) VALUES('tm:lease',?,?) ON CONFLICT(key) DO UPDATE SET count=excluded.count,expires_at=excluded.expires_at WHERE rate_limits.count<=? RETURNING count",
      )
      .bind(now + 280, Math.ceil(now / 1000) + 60, now)
      .first();
    if (row) {
      acquired = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 280));
  }
  if (!acquired)
    throw new ApiError(
      "Die Konzertsuche ist gerade ausgelastet. Bitte gleich erneut versuchen.",
      429,
    );
  const day = Math.floor(Date.now() / 86400000);
  const budget = await db()
    .prepare(
      "INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
    )
    .bind("tm:day:" + day, (day + 1) * 86400)
    .first<{ count: number }>();
  if (budget && budget.count > 4500)
    throw new ApiError(
      "Die Konzertsuche ist heute stark ausgelastet. Bitte später erneut versuchen.",
      429,
    );
  const url = new URL("https://app.ticketmaster.com/discovery/v2/" + path);
  url.search = new URLSearchParams({ ...params, apikey: key }).toString();
  const response = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    // Release the outgoing connection before the pool starts another request.
    await response.body?.cancel();
    if (response.status === 429)
      throw new ApiError(
        "Ticketmaster ist gerade ausgelastet. Bitte versuche es später erneut.",
        429,
      );
    throw new ApiError(
      "Die Konzertdaten sind gerade nicht erreichbar. Bitte später erneut versuchen.",
      502,
    );
  }
  return (await response.json()) as T;
}
export async function searchArtists(query: string) {
  const key = "artists:" + normalize(query);
  const hit = await cached<Artist[]>(key);
  if (hit) return hit;
  if (!config("TICKETMASTER_API_KEY")) return [];
  const data = await tm<{ _embedded?: { attractions: Attraction[] } }>(
    "attractions.json",
    { keyword: query, classificationName: "music", size: "12", locale: "*" },
  );
  const artists = (data._embedded?.attractions || []).map(ticketmasterArtist);
  await putCache(key, artists, 24 * 3600000);
  return artists;
}
async function nearbyConcerts(
  p: Preferences,
  request: TicketmasterRequest = tm,
) {
  const today = new Date().toISOString().slice(0, 10);
  const from = p.from < today ? today : p.from;
  if (p.to < today)
    return {
      events: [],
      notice: "Der ausgewählte Zeitraum liegt in der Vergangenheit.",
      checkedAt: new Date().toISOString(),
    };
  const query = {
    geoPoint: geoHash(p.lat, p.lng),
    radius: String(p.radius),
    unit: "km",
    classificationName: "music",
    startDateTime: from + "T00:00:00Z",
    endDateTime: p.to + "T23:59:59Z",
    size: "200",
    sort: "relevance,desc",
    locale: "*",
  };
  const cacheKey = "events:v3:" + JSON.stringify(query);
  const hit = await cached<{
    events: Concert[];
    notice: string;
    checkedAt: string;
  }>(cacheKey);
  if (hit) return hit;
  const checkedAt = new Date().toISOString();
  const { events, partial } = await eventPages(
    (page) =>
      request<EventPage>("events.json", { ...query, page: String(page) }),
    4,
    checkedAt,
  );
  const notice = partial
    ? "Ein Teil der Konzertdaten konnte nicht geladen werden. Die angezeigte Auswahl ist unvollständig."
    : "";
  const result = { events, notice, checkedAt };
  await putCache(cacheKey, result, partial ? 60000 : 15 * 60000);
  return result;
}
// Partition discovery by the group's main music families, so a large radius
// does not let the global 800-event page hide all relevant touring artists.
async function focusedConcerts(
  p: Preferences,
  members: Member[],
  request: TicketmasterRequest = tm,
) {
  let catalogue = await cached<ProviderGenre[]>("tm:music-genres:v1");
  if (!catalogue) {
    catalogue = musicGenres(
      await request<ClassificationCatalogue>("classifications.json", {
        locale: "en-us",
      }),
    );
    if (catalogue.length)
      await putCache("tm:music-genres:v1", catalogue, 7 * 86400000);
  }
  const today = new Date().toISOString().slice(0, 10);
  const discoveries = await Promise.allSettled(
    discoveryGenres(members, catalogue).map(async (genre) => {
      const query = {
        geoPoint: geoHash(p.lat, p.lng),
        radius: String(p.radius),
        unit: "km",
        genreId: genre.id,
        startDateTime: (p.from < today ? today : p.from) + "T00:00:00Z",
        endDateTime: p.to + "T23:59:59Z",
        size: "200",
        sort: "relevance,desc",
        locale: "*",
      };
      const key = "focused:v2:" + JSON.stringify(query);
      let hits = await cached<{ events: Concert[]; partial: boolean }>(key);
      if (!hits) {
        const checkedAt = new Date().toISOString();
        try {
          const found = await eventPages(
            (page) =>
              request<EventPage>("events.json", {
                ...query,
                page: String(page),
              }),
            3,
            checkedAt,
          );
          hits = { events: found.events, partial: found.partial };
        } catch {
          hits = { events: [], partial: true };
        }
        await putCache(key, hits, hits.partial ? 60000 : 15 * 60000);
      }
      return hits;
    }),
  );
  return {
    events: [
      ...new Map(
        discoveries
          .flatMap((d) => (d.status === "fulfilled" ? d.value.events : []))
          .map((e) => [e.id, e]),
      ).values(),
    ],
    partial: discoveries.some(
      (d) => d.status === "rejected" || d.value.partial,
    ),
  };
}

export async function findConcert(id: string) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id))
    throw new ApiError("Ungültige Konzert-ID.");
  const key = "event:v2:" + id;
  const hit = await cached<Concert>(key);
  if (hit) return hit;
  const raw = await tm<TicketmasterEvent>(
    "events/" + encodeURIComponent(id) + ".json",
    {
      locale: "*",
    },
  );
  const c = parseEvent(raw, new Date().toISOString());
  if (!c) throw new ApiError("Dieser Termin ist nicht mehr verfügbar.", 404);
  await putCache(key, c);
  return c;
}

async function targetedConcerts(
  p: Preferences,
  favorites: Artist[],
  checkedAt: string,
  request: TicketmasterRequest,
) {
  const today = checkedAt.slice(0, 10);
  const discoveries = await Promise.all(
    favorites.slice(0, 8).map(async (favorite) => {
      const query = {
        keyword: favorite.name,
        geoPoint: geoHash(p.lat, p.lng),
        radius: String(p.radius),
        unit: "km",
        classificationName: "music",
        startDateTime: (p.from < today ? today : p.from) + "T00:00:00Z",
        endDateTime: p.to + "T23:59:59Z",
        size: "100",
        locale: "*",
      };
      const key = "targeted:v3:" + JSON.stringify(query);
      try {
        let targeted = await cached<Concert[]>(key);
        if (!targeted) {
          const data = await request<EventPage>("events.json", query);
          targeted = (data._embedded?.events || [])
            .map((e) => parseEvent(e, checkedAt))
            .filter(
              (e): e is Concert =>
                !!e && e.artists.some((a) => sameArtist(a, favorite)),
            );
          await putCache(key, targeted);
        }
        return { events: targeted, partial: false };
      } catch {
        return { events: [], partial: true };
      }
    }),
  );
  return {
    events: discoveries.flatMap((d) => d.events),
    partial: discoveries.some((d) => d.partial),
  };
}

export async function searchConcerts(
  p: Preferences,
  members: Member[] = [],
  enrich = true,
) {
  const checkedAt = new Date().toISOString();
  if (p.to < checkedAt.slice(0, 10))
    return { ...(await nearbyConcerts(p)), artistMetadata: [] };
  // Interleave profiles so a large import by one person cannot consume every slot.
  const favorites: Artist[] = [];
  for (let i = 0; i < 50; i++)
    for (const member of members) {
      const a = member.artists[i];
      if (a && !favorites.some((b) => sameArtist(a, b))) favorites.push(a);
    }
  // Overlap independent network waits, with one pool for this entire search.
  // Each call still reserves the shared D1 rate-limit slot and daily quota.
  const pool = requestPool(3);
  const request: TicketmasterRequest = <T>(
    path: string,
    params: Record<string, string> = {},
  ) => pool(() => tm<T>(path, params));
  const [baseResult, targetedResult, profileResult] = await Promise.allSettled([
    nearbyConcerts(p, request),
    targetedConcerts(p, favorites, checkedAt, request),
    (async () => {
      const profileMetadata = await enrichArtists(favorites, enrich ? 2 : 0);
      const profileById = new Map(profileMetadata.map((a) => [a.id, a]));
      const profiles = members.map((m) => ({
        ...m,
        artists: m.artists.map((a) => profileById.get(a.id) || a),
      }));
      let focused: { events: Concert[]; partial: boolean };
      try {
        focused = await focusedConcerts(p, profiles, request);
      } catch {
        focused = { events: [], partial: true };
      }
      return { profileMetadata, profiles, focused };
    })(),
  ]);
  // Settle every branch before returning or throwing, keeping all I/O attached
  // to this Worker request's lifetime even when the required base query fails.
  if (baseResult.status === "rejected") throw baseResult.reason;
  if (profileResult.status === "rejected") throw profileResult.reason;
  const base = baseResult.value;
  const targeted =
    targetedResult.status === "fulfilled"
      ? targetedResult.value
      : { events: [], partial: true };
  const { profileMetadata, profiles, focused } = profileResult.value;
  const partial = targeted.partial || focused.partial;
  const events = new Map<string, Concert>();
  for (const event of [...base.events, ...targeted.events, ...focused.events])
    if (!events.has(event.id)) events.set(event.id, event);
  const families = profiles.map(
    (m) =>
      new Set(
        [...m.genres, ...m.artists.flatMap((a) => a.genres.slice(0, 3))].map(
          genreKey,
        ),
      ),
  );
  const favoriteNames = new Set(favorites.map((a) => normalize(a.name)));
  // Apply the budget before metadata enrichment or downstream AI assessment.
  // Otherwise a price-limited search waits for work on invisible concerts.
  const bookable = deduplicateConcerts(
    [...events.values()].filter((event) => withinEuroBudget(event, p.budget)),
  );
  const candidates = bookable
    .map((event) => {
      const genres = [
        ...event.genres,
        ...event.artists.flatMap((a) => a.genres),
      ].map(genreKey);
      const shared = families.filter((f) =>
        genres.some((g) => f.has(g)),
      ).length;
      const exact = event.artists.some((a) =>
        favoriteNames.has(normalize(a.name)),
      );
      return { event, priority: shared + (exact ? 10 : 0) };
    })
    .sort(
      (a, b) =>
        b.priority - a.priority ||
        (a.event.providerRank ?? 9999) - (b.event.providerRank ?? 9999),
    );
  const enriched = await enrichArtists(
    candidates.flatMap((e) => e.event.artists),
    enrich ? 4 : 0,
  );
  const byId = new Map(enriched.map((a) => [a.id, a]));
  return {
    ...base,
    events: bookable.map((e) => ({
      ...e,
      artists: e.artists.map((a) => byId.get(a.id) || a),
    })),
    artistMetadata: profileMetadata,
    notice: [
      base.notice,
      partial
        ? "Einzelne gezielte Künstler- oder Genre-Abfragen konnten nicht geladen werden."
        : "",
    ]
      .filter(Boolean)
      .join(" "),
  };
}
