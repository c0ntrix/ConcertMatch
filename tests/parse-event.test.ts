import test from "node:test";
import assert from "node:assert/strict";
import { rankConcerts } from "../lib/matching";
import {
  eventPages,
  parseEvent,
  type EventPage,
  type TicketmasterEvent,
} from "../lib/ticketmaster-events";
import { requestPool } from "../lib/request-pool";
import { withinEuroBudget } from "../lib/concert-budget";
import type { Member, Preferences } from "../lib/types";

const checkedAt = "2026-10-01T12:00:00Z";
const event: TicketmasterEvent = {
  id: "show",
  name: "Example artist",
  url: "https://www.ticketmaster.de/event/show",
  dates: {
    start: { localDate: "2026-11-02", localTime: "20:00:00" },
    status: { code: "onsale" },
  },
  _embedded: {
    attractions: [{ id: "act", name: "Example artist" }],
    venues: [
      {
        name: "Venue",
        city: { name: "Berlin" },
        location: { latitude: "52.52", longitude: "13.405" },
      },
    ],
  },
};
const prefs: Preferences = {
  city: "Berlin",
  lat: 52.52,
  lng: 13.405,
  radius: 50,
  from: "2026-10-01",
  to: "2026-12-31",
  budget: 50,
  discovery: true,
};
const members: Member[] = [
  {
    id: "me",
    name: "Me",
    genres: [],
    artists: [{ id: "tm:act", name: "Example artist", genres: [] }],
  },
];

test("only valid standard price ranges feed the displayed EUR budget", () => {
  const concert = parseEvent(
    {
      ...event,
      priceRanges: [
        { type: "vip", min: 5, max: 5, currency: "EUR" },
        { type: "standard", min: 10, max: 50, currency: "USD" },
        { type: "standard", min: -1, max: 20, currency: "EUR" },
        { type: "standard", min: 20, max: 10, currency: "EUR" },
        { type: "standard", min: 80, max: 90, currency: "EUR" },
        { type: "standard", min: 45, max: 60, currency: "EUR" },
      ],
    },
    checkedAt,
  )!;
  assert.equal(concert.price, 45);
  assert.equal(concert.currency, "EUR");
  assert.equal(rankConcerts([concert], members, prefs).length, 1);
  assert.equal(
    rankConcerts([concert], members, { ...prefs, budget: 44 }).length,
    0,
  );
});
test("missing and foreign prices stay unknown to the EUR budget", () => {
  const unknown = parseEvent(event, checkedAt)!;
  const foreign = parseEvent(
    { ...event, priceRanges: [{ min: 20, max: 30, currency: "GBP" }] },
    checkedAt,
  )!;
  assert.equal(unknown.price, undefined);
  assert.equal(unknown.currency, undefined);
  assert.equal(foreign.currency, "GBP");
  assert.equal(withinEuroBudget(unknown, prefs.budget), false);
  assert.equal(withinEuroBudget(foreign, prefs.budget), false);
  assert.equal(withinEuroBudget(unknown, 0), true);
  assert.equal(rankConcerts([unknown, foreign], members, prefs).length, 0);
  assert.equal(
    rankConcerts([unknown], members, { ...prefs, budget: 0 }).length,
    1,
  );
});
test("the server budget excludes hidden candidates before enrichment and AI", () => {
  const candidates = [
    {},
    { price: 20, currency: "GBP" },
    { price: -1, currency: "EUR" },
    { price: Infinity, currency: "EUR" },
    { price: 51, currency: "EUR" },
    { price: 50, currency: "EUR" },
    { price: 0, currency: "EUR" },
  ];
  assert.deepEqual(
    candidates.filter((c) => withinEuroBudget(c, 50)),
    [
      { price: 50, currency: "EUR" },
      { price: 0, currency: "EUR" },
    ],
  );
});
test("zero is a valid provider price, malformed prices are never invented", () => {
  assert.equal(
    parseEvent(
      { ...event, priceRanges: [{ min: 0, max: 0, currency: "EUR" }] },
      checkedAt,
    )!.price,
    0,
  );
  for (const range of [
    { min: NaN, currency: "EUR" },
    { min: Infinity, currency: "EUR" },
    { min: "30" as unknown as number, currency: "EUR" },
    { min: 30, currency: "euro" },
  ])
    assert.equal(
      parseEvent({ ...event, priceRanges: [range] }, checkedAt)!.price,
      undefined,
    );
});
test("known unavailable dates and expired public sales never enter results", () => {
  for (const code of ["canceled", "cancelled", "offsale", "postponed"])
    assert.equal(
      parseEvent(
        { ...event, dates: { ...event.dates, status: { code } } },
        checkedAt,
      ),
      null,
    );
  assert.equal(
    parseEvent(
      { ...event, sales: { public: { endDateTime: checkedAt } } },
      checkedAt,
    ),
    null,
  );
  assert.equal(
    parseEvent(
      {
        ...event,
        dates: {
          ...event.dates,
          start: { localDate: "2026-11-02", dateTBA: true },
        },
      },
      checkedAt,
    ),
    null,
  );
  assert.equal(
    parseEvent(
      { ...event, dates: { ...event.dates, status: { code: "rescheduled" } } },
      checkedAt,
    )!.status,
    "rescheduled",
  );
});
test("missing status stays unknown and TicketWeb links retain their actual provider", () => {
  const concert = parseEvent(
    {
      ...event,
      url: "https://www.ticketweb.uk/event/show/123?REFERRAL_ID=tmfeed",
      dates: { start: event.dates!.start },
    },
    checkedAt,
  )!;
  assert.equal(concert.status, "unknown");
  assert.equal(concert.source, "TicketWeb");
  assert.equal(
    concert.url,
    "https://www.ticketweb.uk/event/show/123?REFERRAL_ID=tmfeed",
  );
  assert.equal(
    parseEvent(
      { ...event, url: "https://ticketweb.uk.evil.example/show" },
      checkedAt,
    )!.source,
    "Ticketmaster",
  );
});
test("concurrent pages preserve provider order and retain successful pages after a failure", async () => {
  const requested: number[] = [];
  const gates = new Map<number, (value: EventPage) => void>();
  const result = eventPages(
    async (page) => {
      requested.push(page);
      if (!page)
        return {
          _embedded: { events: [event] },
          page: { totalPages: 20, totalElements: 4000 },
        };
      if (page === 2) throw new Error("Provider timeout");
      return await new Promise<EventPage>((resolve) =>
        gates.set(page, resolve),
      );
    },
    4,
    checkedAt,
  );
  await new Promise(setImmediate);
  assert.deepEqual(requested, [0, 1, 2, 3]);
  gates.get(3)!({ _embedded: { events: [{ ...event, id: "last" }] } });
  gates.get(1)!({ _embedded: { events: [event, { ...event, id: "second" }] } });
  const found = await result;
  assert.deepEqual(
    found.events.map((c) => [c.id, c.providerRank]),
    [
      ["show", 0],
      ["second", 201],
      ["last", 600],
    ],
  );
  assert.equal(found.partial, true);
  assert.equal(found.total, 4000);
});
test("pagination never fetches nonexistent pages or fans out after a failed first page", async () => {
  const requested: number[] = [];
  await eventPages(
    async (page) => {
      requested.push(page);
      return { page: { totalPages: 1 } };
    },
    4,
    checkedAt,
  );
  assert.deepEqual(requested, [0]);
  requested.length = 0;
  await assert.rejects(
    eventPages(
      async (page) => {
        requested.push(page);
        throw new Error("Provider unavailable");
      },
      4,
      checkedAt,
    ),
  );
  assert.deepEqual(requested, [0]);
});
test(
  "the request pool caps concurrency and releases slots after errors",
  { timeout: 2000 },
  async () => {
    const pool = requestPool(3);
    let active = 0,
      maximum = 0;
    const started: number[] = [];
    const gates = new Map<number, () => void>();
    const pending = Array.from({ length: 9 }, (_, i) =>
      pool(async () => {
        active++;
        maximum = Math.max(maximum, active);
        started.push(i);
        await new Promise<void>((resolve) => gates.set(i, resolve));
        active--;
        if (i === 1) throw new Error("One request fails");
        return i;
      }),
    );
    const settled = Promise.allSettled(pending);
    assert.deepEqual(started, [0, 1, 2]);
    for (let i = 0; i < 9; i++) {
      while (!gates.has(i)) await new Promise(setImmediate);
      gates.get(i)!();
    }
    const results = await settled;
    assert.equal(maximum, 3);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 8);
    assert.deepEqual(started, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  },
);
