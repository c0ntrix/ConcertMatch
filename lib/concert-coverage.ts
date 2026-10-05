import { eventPages, type EventPage } from "./ticketmaster-events";

// Ticketmaster only permits deep paging through the first 1,000 items.
// Date partitions cover busy areas without fetching forbidden later pages.
export async function expandedEventPages(
  fetchPage: (from: string, to: string, page: number) => Promise<EventPage>,
  from: string,
  to: string,
  checkedAt: string,
) {
  const base = await eventPages(
    (page) => fetchPage(from, to, page),
    4,
    checkedAt,
  );
  const start = Date.parse(from + "T00:00:00Z");
  const days =
    Math.round((Date.parse(to + "T00:00:00Z") - start) / 86400000) + 1;
  if (base.total <= 800 || days <= 1)
    return { ...base, capped: base.total > 800 };
  const count = Math.min(4, days);
  const date = (offset: number) =>
    new Date(start + offset * 86400000).toISOString().slice(0, 10);
  const windows = await Promise.allSettled(
    Array.from({ length: count }, (_, i) => {
      const first = date(Math.floor((i * days) / count));
      const last = date(Math.floor(((i + 1) * days) / count) - 1);
      return eventPages((page) => fetchPage(first, last, page), 4, checkedAt);
    }),
  );
  const successful = windows.flatMap((w) =>
    w.status === "fulfilled" ? [w.value] : [],
  );
  return {
    events: [
      ...new Map(
        [...base.events, ...successful.flatMap((w) => w.events)].map((e) => [
          e.id,
          e,
        ]),
      ).values(),
    ],
    total: base.total,
    partial:
      base.partial ||
      windows.some((w) => w.status === "rejected" || w.value.partial),
    capped: windows.some((w) => w.status === "rejected" || w.value.total > 800),
  };
}
