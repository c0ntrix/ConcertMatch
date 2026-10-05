import { z } from "zod";
import { ApiError, cached, config, db, putCache } from "./server";
import { requestPool } from "./request-pool";
import {
  eventfrogEvent,
  eventfrogLocation,
  eventfrogRubric,
  musicRubrics,
  parseEventfrogEvent,
  type EventfrogEvent,
  type EventfrogLocation,
} from "./eventfrog-events";
import { haversine } from "./matching";
import type { Preferences, Concert } from "./types";

async function request<T>(
  path: string,
  params: URLSearchParams,
  schema: z.ZodType<T>,
  ttl = 30 * 60000,
) {
  const key = config("EVENTFROG_API_KEY");
  if (!key) throw new ApiError("Eventfrog ist noch nicht freigeschaltet.", 503);
  const cacheKey = "eventfrog:v1:" + path + "?" + params;
  const hit = await cached<{ data: T; checkedAt: string }>(cacheKey);
  if (hit) return hit;
  // Public API limit: 30/minute and 2,000/day per account, shared by keys.
  let acquired = false;
  for (let attempt = 0; attempt < 10; attempt++) {
    const now = Date.now();
    const slot = await db()
      .prepare(
        "INSERT INTO rate_limits(key,count,expires_at) VALUES('ef:lease',?,?) ON CONFLICT(key) DO UPDATE SET count=excluded.count,expires_at=excluded.expires_at WHERE rate_limits.count<=? RETURNING count",
      )
      .bind(now + 2100, Math.ceil(now / 1000) + 60, now)
      .first();
    if (slot) {
      acquired = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 2100));
  }
  if (!acquired) throw new ApiError("Eventfrog ist gerade ausgelastet.", 429);
  const day = Math.floor(Date.now() / 86400000);
  const budget = await db()
    .prepare(
      "INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
    )
    .bind("ef:day:" + day, (day + 1) * 86400)
    .first<{ count: number }>();
  if (budget && budget.count > 1800)
    throw new ApiError("Das Eventfrog-Tageskontingent ist ausgeschöpft.", 429);
  const url = new URL("https://api.eventfrog.net/public/v1/" + path);
  url.search = params.toString();
  const response = await fetch(url, {
    headers: { Authorization: "Bearer " + key, Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new ApiError("Eventfrog ist gerade nicht erreichbar.", 502);
  }
  // Bound upstream bodies as well as page counts; descriptions can be large.
  const reader = response.body?.getReader();
  if (!reader) throw new ApiError("Eventfrog hat keine Daten geliefert.", 502);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4_000_000) {
        await reader.cancel();
        throw new ApiError("Die Eventfrog-Antwort ist zu groß.", 502);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const result = {
    data: schema.parse(JSON.parse(new TextDecoder().decode(body))),
    checkedAt: new Date().toISOString(),
  };
  await putCache(cacheKey, result, ttl);
  return result;
}
const eventPage = z.object({
  events: z.array(z.unknown()),
  totalNumberOfResources: z.number().int().nonnegative(),
});
async function rubrics() {
  const result = await request(
    "rubrics",
    new URLSearchParams(),
    z.object({ rubrics: z.array(eventfrogRubric) }),
    24 * 3600000,
  );
  return musicRubrics(result.data.rubrics);
}
async function locations(events: EventfrogEvent[]) {
  const ids = [...new Set(events.flatMap((e) => e.locationIds))];
  const pool = requestPool(2);
  const results = await Promise.allSettled(
    Array.from({ length: Math.ceil(ids.length / 100) }, (_, i) =>
      pool(async () => {
        const query = new URLSearchParams({ perPage: "100" });
        for (const id of ids.slice(i * 100, (i + 1) * 100))
          query.append("id", id);
        return (
          await request(
            "locations",
            query,
            z.object({ locations: z.array(z.unknown()) }),
            24 * 3600000,
          )
        ).data.locations;
      }),
    ),
  );
  const byId = new Map<string, EventfrogLocation>();
  for (const result of results)
    if (result.status === "fulfilled")
      for (const raw of result.value) {
        const parsed = eventfrogLocation.safeParse(raw);
        if (parsed.success) byId.set(parsed.data.id, parsed.data);
      }
  return { byId, partial: results.some((r) => r.status === "rejected") };
}
export async function searchEventfrog(p: Preferences) {
  if (
    !config("EVENTFROG_API_KEY") ||
    p.to < new Date().toISOString().slice(0, 10)
  )
    return { events: [] as Concert[], notice: "" };
  const categories = await rubrics();
  if (!categories.size)
    throw new ApiError("Eventfrog hat keine Konzertkategorien geliefert.", 502);
  const query = new URLSearchParams({
    lat: String(p.lat),
    lng: String(p.lng),
    r: String(p.radius),
    country: "ALL",
    from: p.from,
    to: p.to,
    perPage: "200",
    page: "1",
  });
  for (const id of categories.keys()) query.append("rubId", String(id));
  const first = await request("events", query, eventPage);
  const pool = requestPool(2);
  const other = await Promise.allSettled(
    Array.from(
      {
        length:
          Math.min(3, Math.ceil(first.data.totalNumberOfResources / 200)) - 1,
      },
      (_, i) =>
        pool(() => {
          const next = new URLSearchParams(query);
          next.set("page", String(i + 2));
          return request("events", next, eventPage);
        }),
    ),
  );
  const pages = [
    first,
    ...other.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])),
  ];
  const events = pages.flatMap((page) =>
    page.data.events.flatMap((raw) => {
      const parsed = eventfrogEvent.safeParse(raw);
      return parsed.success
        ? [{ event: parsed.data, checkedAt: page.checkedAt }]
        : [];
    }),
  );
  const places = await locations(events.map((e) => e.event));
  const concerts = events.flatMap(({ event, checkedAt }) => {
    const concert = parseEventfrogEvent(
      event,
      places.byId.get(event.locationIds[0]),
      categories,
      checkedAt,
    );
    return concert &&
      concert.date >= p.from &&
      concert.date <= p.to &&
      haversine(p, concert) <= p.radius
      ? [concert]
      : [];
  });
  const partial = places.partial || other.some((r) => r.status === "rejected");
  return {
    events: [...new Map(concerts.map((e) => [e.id, e])).values()],
    notice: partial
      ? "Ein Teil der Eventfrog-Termine konnte nicht geladen werden."
      : first.data.totalNumberOfResources > 600
        ? "Die Eventfrog-Auswahl ist begrenzt. Ein kleinerer Umkreis oder Zeitraum kann weitere Termine zeigen."
        : "",
  };
}
export async function findEventfrogConcert(id: string) {
  if (!/^eventfrog:\d{1,20}$/.test(id))
    throw new ApiError("Ungültige Konzert-ID.");
  const result = await request(
    "events",
    new URLSearchParams({ id: id.slice(10), country: "ALL" }),
    eventPage,
  );
  const raw = result.data.events.find(
    (e) =>
      eventfrogEvent.safeParse(e).success &&
      (e as EventfrogEvent).id === id.slice(10),
  );
  const event = eventfrogEvent.safeParse(raw);
  if (!event.success)
    throw new ApiError("Dieser Termin ist nicht mehr verfügbar.", 404);
  const [categories, places] = await Promise.all([
    rubrics(),
    locations([event.data]),
  ]);
  const concert = parseEventfrogEvent(
    event.data,
    places.byId.get(event.data.locationIds[0]),
    categories,
    result.checkedAt,
  );
  if (!concert)
    throw new ApiError("Dieser Termin ist nicht mehr verfügbar.", 404);
  return concert;
}
