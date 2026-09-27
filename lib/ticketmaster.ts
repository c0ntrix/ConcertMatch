import type { Artist, Concert, Preferences } from "./types";
import { ARTISTS, normalize } from "./catalog";
import { ApiError, cached, config, db, putCache } from "./server";
type Classification = {
  genre?: { name?: string };
  subGenre?: { name?: string };
};
type Attraction = {
  id: string;
  name: string;
  url?: string;
  classifications?: Classification[];
};
type Event = {
  id: string;
  name: string;
  url: string;
  images?: { url: string; width: number; ratio?: string }[];
  dates?: {
    start?: { localDate?: string; localTime?: string; dateTBD?: boolean };
    status?: { code: string };
  };
  priceRanges?: { min: number; max: number; currency: string }[];
  classifications?: Classification[];
  _embedded?: {
    attractions?: Attraction[];
    venues?: {
      name: string;
      city?: { name: string };
      location?: { latitude: string; longitude: string };
    }[];
  };
};
const genres = (cs: Classification[] = []) => [
  ...new Set(
    cs
      .flatMap((c) => [c.genre?.name, c.subGenre?.name])
      .filter(
        (x): x is string => !!x && !/undefined|other|miscellaneous/i.test(x),
      ),
  ),
];
function artist(a: Attraction): Artist {
  const known = ARTISTS.find((x) => normalize(x.name) === normalize(a.name));
  return {
    id: "tm:" + a.id,
    name: a.name,
    genres: known?.genres || genres(a.classifications),
    url: a.url?.startsWith("https://") ? a.url : undefined,
  };
}
function parseEvent(e: Event, checkedAt: string): Concert | null {
  const v = e._embedded?.venues?.[0];
  const start = e.dates?.start;
  if (
    !e.id ||
    !e.name ||
    !v ||
    !start?.localDate ||
    start.dateTBD ||
    !e.url?.startsWith("https://")
  )
    return null;
  const lat = Number(v.location?.latitude),
    lng = Number(v.location?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const images = (e.images || [])
    .filter((i) => i.url.startsWith("https://s1.ticketm.net/"))
    .sort((a, b) => Math.abs(a.width - 500) - Math.abs(b.width - 500));
  const price = e.priceRanges
    ?.filter(
      (p) =>
        Number.isFinite(p.min) && p.min >= 0 && /^[A-Z]{3}$/.test(p.currency),
    )
    .sort((a, b) => a.min - b.min)[0];
  const artists = (e._embedded?.attractions || []).map(artist);
  return {
    id: e.id,
    title: e.name,
    artists,
    date: start.localDate,
    time: start.localTime,
    venue: v.name,
    city: v.city?.name || "",
    lat,
    lng,
    url: e.url,
    image: images[0]?.url,
    price: price?.min,
    currency: price?.currency,
    genres: genres(e.classifications),
    source: "Ticketmaster",
    checkedAt,
    status: e.dates?.status?.code || "onsale",
  };
}
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
  // Shared budgets protect the provider quota across all visitors and isolates.
  const second = Math.floor(Date.now() / 1000),
    day = Math.floor(second / 86400);
  const budget = await db().batch([
    db()
      .prepare(
        "INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
      )
      .bind("tm:sec:" + second, second + 2),
    db()
      .prepare(
        "INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
      )
      .bind("tm:day:" + day, (day + 1) * 86400),
  ]);
  if (
    Number((budget[0].results[0] as { count: number }).count) > 4 ||
    Number((budget[1].results[0] as { count: number }).count) > 4500
  )
    throw new ApiError(
      "Die Konzertsuche ist gerade stark ausgelastet. Bitte versuche es später noch einmal.",
      429,
    );
  const url = new URL("https://app.ticketmaster.com/discovery/v2/" + path);
  url.search = new URLSearchParams({ ...params, apikey: key }).toString();
  const response = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    headers: { Accept: "application/json" },
  });
  if (response.status === 429)
    throw new ApiError(
      "Ticketmaster ist gerade ausgelastet. Bitte versuche es später erneut.",
      429,
    );
  if (!response.ok)
    throw new ApiError(
      "Die Konzertdaten sind gerade nicht erreichbar. Bitte später erneut versuchen.",
      502,
    );
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
  const artists = (data._embedded?.attractions || []).map(artist);
  await putCache(key, artists, 24 * 3600000);
  return artists;
}
export async function searchConcerts(p: Preferences) {
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
    countryCode: "DE",
    classificationName: "music",
    startDateTime: from + "T00:00:00Z",
    endDateTime: p.to + "T23:59:59Z",
    size: "200",
    sort: "date,asc",
    locale: "*",
  };
  const cacheKey = "events:" + JSON.stringify(query);
  const hit = await cached<{
    events: Concert[];
    notice: string;
    checkedAt: string;
  }>(cacheKey);
  if (hit) return hit;
  const checkedAt = new Date().toISOString();
  const events: Concert[] = [];
  let total = 0;
  let pages = 1;
  let partial = false;
  for (let page = 0; page < Math.min(pages, 4); page++) {
    try {
      const data = await tm<{
        _embedded?: { events: Event[] };
        page?: { totalPages: number; totalElements: number };
      }>("events.json", { ...query, page: String(page) });
      pages = data.page?.totalPages || 1;
      total = data.page?.totalElements || 0;
      for (const item of data._embedded?.events || []) {
        const c = parseEvent(item, checkedAt);
        if (c && !events.some((e) => e.id === c.id)) events.push(c);
      }
    } catch (error) {
      if (page === 0) throw error;
      partial = true;
      break;
    }
  }
  const notice = partial
    ? "Ein Teil der Konzertdaten konnte nicht geladen werden. Die angezeigte Auswahl ist unvollständig."
    : total > 800
      ? "Die nächsten 800 Termine in eurem Umkreis werden berücksichtigt. Ein kürzerer Zeitraum macht die Auswahl genauer."
      : "Aus dem Ticketmaster-Katalog. Nicht alle Veranstalter und Clubs sind enthalten.";
  const result = { events, notice, checkedAt };
  await putCache(cacheKey, result, partial ? 60000 : 15 * 60000);
  return result;
}
export async function findConcert(id: string) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id))
    throw new ApiError("Ungültige Konzert-ID.");
  const key = "event:" + id;
  const hit = await cached<Concert>(key);
  if (hit) return hit;
  const raw = await tm<Event>("events/" + encodeURIComponent(id) + ".json", {
    locale: "*",
  });
  const c = parseEvent(raw, new Date().toISOString());
  if (!c) throw new ApiError("Dieser Termin ist nicht mehr verfügbar.", 404);
  await putCache(key, c);
  return c;
}
