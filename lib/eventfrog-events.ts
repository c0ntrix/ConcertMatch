import { z } from "zod";
import type { Concert } from "./types";

const text = z.record(z.string().nullable());
export const eventfrogEvent = z.object({
  id: z.string().regex(/^\d{1,20}$/),
  rubricId: z.number().int(),
  title: text,
  url: z.string(),
  presaleLink: z.string().nullish(),
  begin: z.string().datetime({ offset: true }),
  cancelled: z.boolean(),
  visible: z.boolean(),
  published: z.boolean(),
  soldOut: z.boolean(),
  agendaEntryOnly: z.boolean(),
  locationIds: z.array(z.string()),
});
export const eventfrogLocation = z.object({
  id: z.string(),
  title: text,
  city: z.string(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export const eventfrogRubric = z.object({
  id: z.number().int(),
  parentId: z.number().int(),
  title: text,
});
export type EventfrogEvent = z.infer<typeof eventfrogEvent>;
export type EventfrogLocation = z.infer<typeof eventfrogLocation>;
export type EventfrogRubric = z.infer<typeof eventfrogRubric>;
export const localized = (value: Record<string, string | null>) =>
  value.de || value.en || Object.values(value).find((v) => v?.trim()) || "";

export function musicRubrics(rubrics: EventfrogRubric[]) {
  const roots = new Set(
    rubrics
      .filter((r) =>
        /\b(konzerte?|concerts?|musikfestivals?|music festivals?)\b/i.test(
          localized(r.title),
        ),
      )
      .map((r) => r.id),
  );
  const selected = new Map<number, string[]>();
  for (const rubric of rubrics) {
    const lineage: EventfrogRubric[] = [];
    const visited = new Set<number>();
    let current: EventfrogRubric | undefined = rubric;
    while (current && !visited.has(current.id)) {
      lineage.push(current);
      visited.add(current.id);
      if (roots.has(current.id)) break;
      current = rubrics.find((r) => r.id === current?.parentId);
    }
    if (!lineage.some((r) => roots.has(r.id))) continue;
    const genres = lineage
      .map((r) => localized(r.title))
      .filter((s) =>
        /jazz|rock|pop|hip.?hop|rap|metal|folk|blues|klassik|classical|country|reggae|electronic|elektroni/i.test(
          s,
        ),
      );
    selected.set(rubric.id, genres);
  }
  return selected;
}

function httpsUrl(value?: string | null) {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function parseEventfrogEvent(
  raw: unknown,
  location: unknown,
  rubrics: Map<number, string[]>,
  checkedAt: string,
): Concert | null {
  const parsed = eventfrogEvent.safeParse(raw),
    venue = eventfrogLocation.safeParse(location);
  if (!parsed.success || !venue.success) return null;
  const e = parsed.data,
    v = venue.data;
  // Multi-location and online events cannot be placed reliably on this radius search.
  if (
    e.cancelled ||
    e.soldOut ||
    !e.visible ||
    !e.published ||
    e.locationIds.length !== 1 ||
    e.locationIds[0] !== v.id ||
    !rubrics.has(e.rubricId) ||
    Date.parse(e.begin) < Date.parse(checkedAt)
  )
    return null;
  const title = localized(e.title),
    name = localized(v.title);
  const eventUrl = httpsUrl(e.url);
  if (
    !title.trim() ||
    !name.trim() ||
    !v.city.trim() ||
    !eventUrl ||
    !/(^|\.)eventfrog\.(de|ch|net)$/.test(new URL(eventUrl).hostname)
  )
    return null;
  const ticket = httpsUrl(e.presaleLink);
  if (e.agendaEntryOnly && !ticket) return null;
  return {
    id: "eventfrog:" + e.id,
    title,
    artists: [],
    date: e.begin.slice(0, 10),
    time: e.begin.slice(11, 16),
    venue: name,
    city: v.city,
    lat: v.lat,
    lng: v.lng,
    url: ticket || eventUrl,
    genres: rubrics.get(e.rubricId) || [],
    source: "Eventfrog",
    checkedAt,
    status: e.agendaEntryOnly ? "unknown" : "onsale",
    // Public API V1 has neither a verified artist lineup nor a currency field.
    // Never invent either, or hotlink images (forbidden by the API documentation).
  };
}
