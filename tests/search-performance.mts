// Controlled network simulation; this is not a production speed measurement.
// Run: node --import tsx tests/search-performance.mts
import assert from "node:assert/strict";
import { eventPages, type EventPage } from "../lib/ticketmaster-events";
import { requestPool } from "../lib/request-pool";

const latencyMs = 600;
const slotSpacingMs = 280;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
function provider() {
  let nextSlot = 0,
    active = 0,
    maximum = 0,
    requests = 0;
  return {
    stats: () => ({ requests, maximum }),
    fetchPage: async (page: number): Promise<EventPage> => {
      const now = Date.now();
      const slot = Math.max(now, nextSlot);
      nextSlot = slot + slotSpacingMs;
      await delay(Math.max(0, slot - now));
      requests++;
      active++;
      maximum = Math.max(maximum, active);
      await delay(latencyMs);
      active--;
      return {
        page: { totalPages: 4, totalElements: 4 },
        _embedded: {
          events: [
            {
              id: String(page),
              name: "Show " + page,
              url: "https://www.ticketmaster.de/event/" + page,
              dates: {
                start: { localDate: "2026-11-01" },
                status: { code: "onsale" },
              },
              _embedded: {
                venues: [
                  {
                    name: "Venue " + page,
                    location: { latitude: "52.52", longitude: "13.405" },
                  },
                ],
              },
            },
          ],
        },
      };
    },
  };
}
const sequential = provider();
let start = Date.now();
const before: EventPage[] = [];
for (let page = 0; page < 4; page++)
  before.push(await sequential.fetchPage(page));
const beforeMs = Date.now() - start;
const parallel = provider();
const pool = requestPool(3);
start = Date.now();
const after = await eventPages(
  (page) => pool(() => parallel.fetchPage(page)),
  4,
  "2026-10-01T12:00:00Z",
);
const afterMs = Date.now() - start;
assert.deepEqual(
  after.events.map((e) => e.id),
  before.flatMap((p) => p._embedded!.events.map((e) => e.id)),
);
assert.equal(sequential.stats().requests, parallel.stats().requests);
assert.ok(parallel.stats().maximum <= 3);
console.log(
  JSON.stringify(
    {
      measurement: "controlled network simulation, not production timing",
      latencyMs,
      slotSpacingMs,
      pages: 4,
      beforeMs,
      afterMs,
      before: sequential.stats(),
      after: parallel.stats(),
      sameResults: true,
    },
    null,
    2,
  ),
);
