import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { config, db, putCache } from "@/lib/server";
import {
  isReservixAffiliateLink,
  RESERVIX_BATCH_SIZE,
  RESERVIX_CATALOG_KEY,
  RESERVIX_MAX_BATCHES,
  RESERVIX_TTL,
  reservixBatchKey,
} from "@/lib/reservix-events";

const event = z
  .object({
    id: z.string().regex(/^reservix:\d{1,20}$/),
    title: z.string().min(1).max(500),
    artists: z
      .array(
        z.object({
          id: z.string().max(100),
          name: z.string().min(1).max(200),
          genres: z.array(z.string().max(100)).max(5),
        }),
      )
      .max(2),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    venue: z.string().min(1).max(500),
    city: z.string().min(1).max(200),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    url: z.string().max(200).refine(isReservixAffiliateLink),
    price: z.number().nonnegative().optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
    genres: z.array(z.string().min(1).max(100)).min(1).max(5),
    source: z.literal("Reservix"),
    checkedAt: z.string().datetime(),
    status: z.literal("onsale"),
    offers: z
      .array(
        z
          .object({
            source: z.literal("Reservix"),
            url: z.string().max(200).refine(isReservixAffiliateLink),
          })
          .strict(),
      )
      .min(1)
      .max(20)
      .optional(),
  })
  .strict();
const payload = z
  .object({
    generation: z.string().uuid(),
    checkedAt: z.string().datetime(),
    batch: z
      .number()
      .int()
      .min(0)
      .max(RESERVIX_MAX_BATCHES - 1)
      .optional(),
    events: z.array(event).min(1).max(RESERVIX_BATCH_SIZE).optional(),
    batches: z.number().int().min(1).max(RESERVIX_MAX_BATCHES).optional(),
    count: z
      .number()
      .int()
      .min(1)
      .max(RESERVIX_BATCH_SIZE * RESERVIX_MAX_BATCHES)
      .optional(),
  })
  .strict();

export async function POST(request: Request) {
  const secret = config("RESERVIX_SYNC_TOKEN");
  const supplied =
    request.headers.get("Authorization")?.replace(/^Bearer /, "") || "";
  const encoder = new TextEncoder();
  if (
    !secret ||
    !/^[a-f0-9]{64}$/.test(supplied) ||
    supplied.length !== secret.length ||
    !timingSafeEqual(encoder.encode(supplied), encoder.encode(secret))
  )
    return Response.json({ error: "Nicht autorisiert." }, { status: 401 });
  // This machine endpoint has no browser session or user-group privileges.
  try {
    const reader = request.body?.getReader();
    if (!reader)
      return Response.json({ error: "Daten fehlen." }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 300000) {
          await reader.cancel();
          return Response.json({ error: "Zu viele Daten." }, { status: 413 });
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const parsed = payload.safeParse(
      JSON.parse(new TextDecoder().decode(bytes)),
    );
    if (!parsed.success)
      return Response.json({ error: "Ungültige Feed-Daten." }, { status: 400 });
    const p = parsed.data;
    if (Math.abs(Date.now() - Date.parse(p.checkedAt)) > 3600000)
      return Response.json({ error: "Import ist veraltet." }, { status: 400 });
    if (
      p.batch !== undefined &&
      p.events &&
      p.batches === undefined &&
      p.count === undefined
    ) {
      if (p.events.some((e) => e.checkedAt !== p.checkedAt))
        return Response.json(
          { error: "Zeitstempel stimmen nicht überein." },
          { status: 400 },
        );
      await putCache(
        reservixBatchKey(p.generation, p.batch),
        { events: p.events },
        Date.parse(p.checkedAt) + RESERVIX_TTL - Date.now(),
      );
      return Response.json({ stored: p.events.length });
    }
    if (
      p.batches &&
      p.count &&
      p.batch === undefined &&
      p.events === undefined
    ) {
      // A failed/partial upload never replaces the previous complete generation.
      const first = reservixBatchKey(p.generation, 0),
        last = reservixBatchKey(p.generation, p.batches - 1);
      const complete = await db()
        .prepare(
          "SELECT count(*) AS batches, sum(json_array_length(data,'$.events')) AS count FROM cache WHERE key>=? AND key<=? AND expires_at>?",
        )
        .bind(first, last, Date.now())
        .first<{ batches: number; count: number }>();
      if (complete?.batches !== p.batches || complete.count !== p.count)
        return Response.json(
          { error: "Import ist unvollständig." },
          { status: 409 },
        );
      await putCache(
        RESERVIX_CATALOG_KEY,
        {
          generation: p.generation,
          batches: p.batches,
          count: p.count,
          checkedAt: p.checkedAt,
        },
        Date.parse(p.checkedAt) + RESERVIX_TTL - Date.now(),
      );
      return Response.json({ activated: p.count });
    }
    return Response.json(
      { error: "Ungültiger Importschritt." },
      { status: 400 },
    );
  } catch {
    return Response.json(
      { error: "Reservix-Import konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }
}
