import test from "node:test";
import assert from "node:assert/strict";
import {
  isReservixAffiliateLink,
  parseReservixEvent,
} from "../lib/reservix-events";
import { deduplicateConcerts } from "../lib/matching";

const now = "2026-10-05T12:00:00Z";
const row = {
  merchant_id: "31293",
  merchant_product_id: "1234",
  aw_product_id: "5678",
  product_name: "Künstler – Konzert",
  merchant_deep_link: "https://www.reservix.de/tickets-test/e1234",
  aw_deep_link: "https://www.awin1.com/pclick.php?p=5678&a=3113053&m=31293",
  "Tickets:event_date": "2026-10-06 20:00",
  "Tickets:genre": "Rock",
  "Tickets:venue_name": "Bühne",
  "Tickets:event_location_city": "Berlin",
  "Tickets:latitude": "52.52",
  "Tickets:longitude": "13.40",
  search_price: "29.90",
};
test("Reservix maps actual event and correct publisher without inventing artists, currency or images", () => {
  const c = parseReservixEvent(row, now)!;
  assert.equal(c.id, "reservix:1234");
  assert.equal(c.time, "20:00");
  assert.equal(c.source, "Reservix");
  assert.deepEqual(c.artists, []);
  assert.equal(c.image, undefined);
  assert.equal(c.price, undefined);
  assert.ok(isReservixAffiliateLink(c.url));
  const withCurrency = parseReservixEvent({ ...row, currency: "EUR" }, now)!;
  assert.equal(withCurrency.price, 29.9);
});
test("Reservix rejects expired, invalid, non-concert and malformed location entries", () => {
  const invalid: Record<string, string>[] = [
    { "Tickets:event_date": "2026-02-30 20:00" },
    { "Tickets:event_date": "2026-10-04 20:00" },
    { "Tickets:event_date": "2026-10-06 25:00" },
    { "Tickets:genre": "Comedy" },
    { "Tickets:latitude": "" },
    { "Tickets:latitude": "0", "Tickets:longitude": "0" },
    { "Tickets:longitude": "NaN" },
    { in_stock: "0" },
    { stock_status: "ausverkauft" },
    { merchant_id: "11388" },
    { merchant_deep_link: "https://www.reservix.de.evil.test/e1234" },
    { merchant_deep_link: "https://www.reservix.de/tickets-test/e9999" },
  ];
  for (const changes of invalid)
    assert.equal(parseReservixEvent({ ...row, ...changes }, now), null);
});
test("Reservix rejects other publisher/product links and canonicalizes untrusted parameters", () => {
  for (const url of [
    "https://www.awin1.com/pclick.php?p=5678&a=123&m=31293",
    "http://www.awin1.com/pclick.php?p=5678&a=3113053&m=31293",
    "https://www.awin1.com.evil.test/pclick.php?p=5678&a=3113053&m=31293",
    "https://www.awin1.com/pclick.php?p=1111&a=3113053&m=31293",
  ])
    assert.equal(parseReservixEvent({ ...row, aw_deep_link: url }, now), null);
  assert.equal(
    parseReservixEvent(
      {
        ...row,
        aw_deep_link:
          row.aw_deep_link + "&ued=https://evil.test&clickref=private",
      },
      now,
    )?.url,
    row.aw_deep_link,
  );
});
test("Deduplication retains Reservix offer and confirmed lineup without changing the primary event", () => {
  const reservix = parseReservixEvent(row, now)!;
  const tm = {
    ...reservix,
    id: "tm123",
    source: "Ticketmaster",
    url: "https://www.ticketmaster.de/event/123",
    artists: [{ id: "artist", name: "Künstler", genres: ["Rock"] }],
  };
  const merged = deduplicateConcerts([tm, reservix]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, tm.id);
  assert.deepEqual(merged[0].artists, tm.artists);
  assert.deepEqual(merged[0].offers, [
    { source: "Ticketmaster", url: tm.url },
    { source: "Reservix", url: reservix.url },
  ]);
  assert.equal(
    deduplicateConcerts([reservix, { ...reservix, id: "other" }]).length,
    1,
  );
});
