import test from "node:test";
import assert from "node:assert/strict";
import { expandedEventPages } from "../lib/concert-coverage";
import { musicRubrics, parseEventfrogEvent } from "../lib/eventfrog-events";
import { deduplicateConcerts } from "../lib/matching";
import type { TicketmasterEvent } from "../lib/ticketmaster-events";
const checkedAt = "2026-10-05T12:00:00Z";
const venue = {
  id: "42",
  title: { de: "Club" },
  city: "Berlin",
  lat: 52.5,
  lng: 13.4,
};
const raw = {
  id: "1234567890123456789",
  rubricId: 2,
  title: { de: "Band live" },
  url: "https://eventfrog.de/de/p/band",
  presaleLink: "https://tickets.example.org/band",
  begin: "2026-11-01T20:30:00+01:00",
  visible: true,
  published: true,
  cancelled: false,
  soldOut: false,
  agendaEntryOnly: false,
  locationIds: ["42"],
  lowestTicketPrice: 25,
};
const rubrics = musicRubrics([
  { id: 1, parentId: 0, title: { de: "Konzerte" } },
  { id: 2, parentId: 1, title: { de: "Rock" } },
  { id: 3, parentId: 0, title: { de: "Partys" } },
]);
test("Eventfrog preserves long IDs, local dates and ticket links without inventing lineup, currency or images", () => {
  const event = parseEventfrogEvent(raw, venue, rubrics, checkedAt)!;
  assert.equal(event.id, "eventfrog:1234567890123456789");
  assert.equal(event.url, raw.presaleLink);
  assert.equal(event.date, "2026-11-01");
  assert.equal(event.time, "20:30");
  assert.deepEqual(event.artists, []);
  assert.deepEqual(event.genres, ["Rock"]);
  assert.equal(event.price, undefined);
  assert.equal(event.currency, undefined);
  assert.equal(event.image, undefined);
  assert.ok(!rubrics.has(3));
});
test("Eventfrog rejects nonpublic, sold-out, past, invalid-location and nonconcert events", () => {
  for (const patch of [
    { cancelled: true },
    { soldOut: true },
    { visible: false },
    { published: false },
    { begin: "2025-01-01T20:00:00Z" },
    { rubricId: 3 },
    { locationIds: ["42", "43"] },
    { id: 123 },
    { url: "https://example.org/event" },
  ])
    assert.equal(
      parseEventfrogEvent({ ...raw, ...patch }, venue, rubrics, checkedAt),
      null,
    );
  assert.equal(
    parseEventfrogEvent(raw, { ...venue, lat: 120 }, rubrics, checkedAt),
    null,
  );
});
test("Eventfrog agenda listings need ticket links; unsafe links fall back to the actual event page", () => {
  assert.equal(
    parseEventfrogEvent(
      { ...raw, agendaEntryOnly: true, presaleLink: "javascript:alert(1)" },
      venue,
      rubrics,
      checkedAt,
    ),
    null,
  );
  assert.equal(
    parseEventfrogEvent(
      { ...raw, presaleLink: "https://user:pass@example.org/" },
      venue,
      rubrics,
      checkedAt,
    )!.url,
    raw.url,
  );
  assert.equal(
    parseEventfrogEvent(
      { ...raw, agendaEntryOnly: true },
      venue,
      rubrics,
      checkedAt,
    )!.status,
    "unknown",
  );
});
test("duplicate provider offers prefer a known lineup without merging different performances", () => {
  const ef = parseEventfrogEvent(raw, venue, rubrics, checkedAt)!;
  const tm = {
    ...ef,
    id: "tm-event",
    source: "Ticketmaster",
    artists: [{ id: "tm:band", name: "Band", genres: ["Rock"] }],
  };
  assert.deepEqual(deduplicateConcerts([ef, tm]), [tm]);
  assert.equal(deduplicateConcerts([tm, { ...ef, time: "22:30" }]).length, 2);
  assert.equal(
    deduplicateConcerts([tm, { ...ef, venue: "Other club" }]).length,
    2,
  );
});
const tmEvent = (id: string): TicketmasterEvent => ({
  id,
  name: "Band live",
  url: "https://www.ticketmaster.de/event/" + id,
  dates: { start: { localDate: "2026-11-01" } },
  _embedded: {
    venues: [
      {
        name: "Club",
        city: { name: "Berlin" },
        location: { latitude: "52.5", longitude: "13.4" },
      },
    ],
  },
});
test("small catalogues keep the cheap page path without extra date searches", async () => {
  const calls: unknown[] = [];
  const result = await expandedEventPages(
    async (...args) => {
      calls.push(args);
      return {
        _embedded: { events: [tmEvent("small")] },
        page: { totalPages: 1, totalElements: 1 },
      };
    },
    "2026-11-01",
    "2026-11-30",
    checkedAt,
  );
  assert.equal(calls.length, 1);
  assert.equal(result.events.length, 1);
  assert.equal(result.capped, false);
});
test("busy catalogues use gap-free date partitions to recover concerts beyond the first 800", async () => {
  const windows = new Set<string>();
  let calls = 0;
  const result = await expandedEventPages(
    async (from, to, page) => {
      calls++;
      windows.add(from + "/" + to);
      const base = from === "2026-11-01" && to === "2026-11-30";
      return {
        _embedded: { events: [tmEvent(base ? "base-" + page : from)] },
        page: { totalPages: base ? 6 : 1, totalElements: base ? 1200 : 1 },
      };
    },
    "2026-11-01",
    "2026-11-30",
    checkedAt,
  );
  assert.deepEqual(
    [...windows],
    [
      "2026-11-01/2026-11-30",
      "2026-11-01/2026-11-07",
      "2026-11-08/2026-11-15",
      "2026-11-16/2026-11-22",
      "2026-11-23/2026-11-30",
    ],
  );
  assert.equal(calls, 8);
  assert.equal(result.events.length, 8);
  assert.equal(result.capped, false);
});
test("partition failures retain base and successful windows; dense results have a bounded request cost", async () => {
  let calls = 0;
  const result = await expandedEventPages(
    async (from, to, page) => {
      calls++;
      if (from === "2026-11-02") throw new Error("upstream unavailable");
      return {
        _embedded: { events: [tmEvent(from + ":" + to + ":" + page)] },
        page: { totalPages: 99, totalElements: 19000 },
      };
    },
    "2026-11-01",
    "2026-11-04",
    checkedAt,
  );
  assert.ok(result.events.length >= 4);
  assert.ok(result.partial);
  assert.ok(result.capped);
  assert.ok(calls <= 20);
});
test("a dense single day never bypasses Ticketmaster's deep-paging limit", async () => {
  const pages: number[] = [];
  const result = await expandedEventPages(
    async (_from, _to, page) => {
      pages.push(page);
      return { page: { totalPages: 10, totalElements: 2000 } };
    },
    "2026-11-01",
    "2026-11-01",
    checkedAt,
  );
  assert.deepEqual(pages, [0, 1, 2, 3]);
  assert.ok(result.capped);
});
