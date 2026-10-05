import type { Artist, Concert } from "./types";

type Classification = {
  genre?: { name?: string };
  subGenre?: { name?: string };
};
export type Attraction = {
  id: string;
  name: string;
  url?: string;
  classifications?: Classification[];
};
export type TicketmasterEvent = {
  id: string;
  name: string;
  url: string;
  images?: { url: string; width: number; ratio?: string }[];
  dates?: {
    start?: {
      localDate?: string;
      localTime?: string;
      dateTBD?: boolean;
      dateTBA?: boolean;
      timeTBA?: boolean;
      noSpecificTime?: boolean;
    };
    status?: { code?: string };
  };
  sales?: { public?: { endDateTime?: string } };
  priceRanges?: {
    type?: string;
    min: number;
    max?: number;
    currency: string;
  }[];
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
export type EventPage = {
  _embedded?: { events: TicketmasterEvent[] };
  page?: { totalPages: number; totalElements?: number };
};
const genres = (cs: Classification[] = []) => [
  ...new Set(
    cs
      .flatMap((c) => [c?.genre?.name, c?.subGenre?.name])
      .filter(
        (x): x is string =>
          typeof x === "string" &&
          !!x.trim() &&
          !/undefined|other|miscellaneous/i.test(x),
      ),
  ),
];
export function validAttraction(a: Attraction) {
  return (
    a &&
    typeof a.id === "string" &&
    !!a.id.trim() &&
    typeof a.name === "string" &&
    !!a.name.trim()
  );
}
export function ticketmasterArtist(a: Attraction): Artist {
  return {
    id: "tm:" + a.id,
    name: a.name,
    genres: genres(a.classifications),
    url: a.url?.startsWith("https://") ? a.url : undefined,
  };
}
function ticketProvider(url: string) {
  const host = new URL(url).hostname.toLowerCase();
  const from = (domains: string[]) =>
    domains.some((domain) => host === domain || host.endsWith("." + domain));
  if (
    from([
      "ticketweb.com",
      "ticketweb.ca",
      "ticketweb.uk",
      "ticketweb.co.uk",
      "ticketweb.ie",
    ])
  )
    return "TicketWeb";
  if (from(["universe.com"])) return "Universe";
  if (from(["frontgatetickets.com"])) return "Front Gate Tickets";
  return "Ticketmaster";
}
export function parseEvent(
  e: TicketmasterEvent,
  checkedAt: string,
): Concert | null {
  const v = e._embedded?.venues?.[0];
  const start = e.dates?.start;
  const status = e.dates?.status?.code?.toLowerCase() || "unknown";
  const saleEnd = Date.parse(e.sales?.public?.endDateTime || "");
  // Discovery status is not live inventory. Reject only explicit unavailable
  // states or an ended sale; never invent an onsale status for missing data.
  if (
    typeof e.id !== "string" ||
    !e.id.trim() ||
    typeof e.name !== "string" ||
    !e.name.trim() ||
    !v ||
    typeof v.name !== "string" ||
    !v.name.trim() ||
    !start?.localDate ||
    start.dateTBD ||
    start.dateTBA ||
    !e.url?.startsWith("https://") ||
    ["canceled", "cancelled", "offsale", "postponed"].includes(status) ||
    (Number.isFinite(saleEnd) && saleEnd <= Date.parse(checkedAt))
  )
    return null;
  const lat = Number(v.location?.latitude),
    lng = Number(v.location?.longitude);
  if (
    !v.location?.latitude?.trim() ||
    !v.location.longitude?.trim() ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    return null;
  let source: string;
  try {
    source = ticketProvider(e.url);
  } catch {
    return null;
  }
  const images = (e.images || [])
    .filter((i) => i?.url?.startsWith("https://s1.ticketm.net/"))
    .sort((a, b) => Math.abs(a.width - 500) - Math.abs(b.width - 500));
  const price = e.priceRanges
    ?.filter(
      (p) =>
        (!p.type || p.type === "standard") &&
        Number.isFinite(p.min) &&
        p.min >= 0 &&
        (p.max === undefined || (Number.isFinite(p.max) && p.max >= p.min)) &&
        /^[A-Z]{3}$/.test(p.currency),
    )
    // The budget is in EUR. Do not compare numeric amounts across currencies
    // or let a foreign-currency offer hide a valid EUR price range.
    .sort(
      (a, b) =>
        Number(b.currency === "EUR") - Number(a.currency === "EUR") ||
        a.min - b.min,
    )[0];
  return {
    id: e.id,
    title: e.name,
    artists: (e._embedded?.attractions || [])
      .filter(validAttraction)
      .map(ticketmasterArtist),
    date: start.localDate,
    time: start.timeTBA || start.noSpecificTime ? undefined : start.localTime,
    venue: v.name,
    city: v.city?.name || "",
    lat,
    lng,
    url: e.url,
    image: images[0]?.url,
    price: price?.min,
    currency: price?.currency,
    genres: genres(e.classifications),
    source,
    checkedAt,
    status,
  };
}

export async function eventPages(
  fetchPage: (page: number) => Promise<EventPage>,
  maxPages: number,
  checkedAt: string,
) {
  const first = await fetchPage(0);
  const pageCount = Math.max(
    1,
    Math.min(first.page?.totalPages || 1, maxPages),
  );
  // Only fan out once page zero establishes how many pages actually exist.
  // The caller's request pool still bounds network activity across all searches.
  const remaining = await Promise.allSettled(
    Array.from({ length: pageCount - 1 }, (_, i) => fetchPage(i + 1)),
  );
  const pages = [
    first,
    ...remaining.map((result) =>
      result.status === "fulfilled" ? result.value : null,
    ),
  ];
  const events = new Map<string, Concert>();
  for (const [page, data] of pages.entries())
    for (const [index, item] of (data?._embedded?.events || []).entries()) {
      const event = parseEvent(item, checkedAt);
      if (event && !events.has(event.id))
        events.set(event.id, { ...event, providerRank: page * 200 + index });
    }
  return {
    events: [...events.values()],
    total: first.page?.totalElements || 0,
    partial: remaining.some((result) => result.status === "rejected"),
  };
}
