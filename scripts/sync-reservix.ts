import fs from "node:fs";
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import { parse } from "csv-parse";
import {
  parseReservixEvent,
  RESERVIX_BATCH_SIZE,
  RESERVIX_MAX_BATCHES,
} from "../lib/reservix-events";
import { deduplicateConcerts } from "../lib/matching";
import type { Concert } from "../lib/types";

const checkedAt = new Date().toISOString();
const localFile = process.argv[2];
let input: Readable;
if (localFile) input = fs.createReadStream(localFile);
else {
  const url = process.env.RESERVIX_FEED_URL;
  if (!url) throw new Error("RESERVIX_FEED_URL fehlt.");
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    !["productdata.awin.com", "ui.awin.com"].includes(parsed.hostname)
  )
    throw new Error("Ungültiger Feedanbieter.");
  const response = await fetch(url, { signal: AbortSignal.timeout(180000) });
  if (!response.ok || !response.body)
    throw new Error(
      "Awin-Feed konnte nicht abgerufen werden: " + response.status,
    );
  input = Readable.fromWeb(
    response.body as import("node:stream/web").ReadableStream,
  );
}
// Awin's download is a gzip file, not an HTTP content-encoding response.
const parser = input
  .pipe(createGunzip())
  .pipe(parse({ columns: true, bom: true, max_record_size: 2_000_000 }));
const events = new Map<string, Concert>();
let rows = 0;
for await (const row of parser) {
  if (++rows > 100000) throw new Error("Unerwartet großer Feed.");
  const event = parseReservixEvent(row, checkedAt);
  if (event) events.set(event.id, event);
}
const concerts = deduplicateConcerts([...events.values()]).sort(
  (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
);
const batches = Math.ceil(concerts.length / RESERVIX_BATCH_SIZE);
if (!batches || batches > RESERVIX_MAX_BATCHES)
  throw new Error("Unerwartete Anzahl von Konzertangeboten.");
if (process.env.RESERVIX_DRY_RUN === "1") {
  console.log(
    JSON.stringify(
      {
        feedRows: rows,
        concerts: concerts.length,
        batches,
        sample: concerts.slice(0, 2),
      },
      null,
      2,
    ),
  );
} else {
  const origin = process.env.CONCERTMATCH_ORIGIN;
  const secret = process.env.RESERVIX_SYNC_TOKEN;
  if (!origin || !secret || new URL(origin).protocol !== "https:")
    throw new Error("Import-Ziel oder Zugang fehlt.");
  const generation = crypto.randomUUID();
  const send = async (data: unknown) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch(
        new URL("/api/providers/reservix/sync", origin),
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + secret,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ generation, checkedAt, ...(data as object) }),
          signal: AbortSignal.timeout(30000),
        },
      );
      await response.body?.cancel();
      if (response.ok) return;
      if (response.status < 500 || attempt === 2)
        throw new Error("Import fehlgeschlagen: " + response.status);
      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
    }
  };
  for (let batch = 0; batch < batches; batch++)
    await send({
      batch,
      events: concerts.slice(
        batch * RESERVIX_BATCH_SIZE,
        (batch + 1) * RESERVIX_BATCH_SIZE,
      ),
    });
  await send({ batches, count: concerts.length });
  console.log(
    JSON.stringify({
      feedRows: rows,
      importedConcerts: concerts.length,
      batches,
      checkedAt,
    }),
  );
}
