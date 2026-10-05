import { ApiError, cached, config, db } from "./server";
import { haversine } from "./matching";
import { RESERVIX_CATALOG_KEY, reservixBatchKey } from "./reservix-events";
import type { Concert, Preferences } from "./types";

export type ReservixCatalog = {
  generation: string;
  batches: number;
  count: number;
  checkedAt: string;
};
export async function searchReservix(p: Preferences) {
  if (!config("RESERVIX_SYNC_TOKEN"))
    return { events: [] as Concert[], notice: "" };
  const catalog = await cached<ReservixCatalog>(RESERVIX_CATALOG_KEY);
  if (!catalog)
    return {
      events: [] as Concert[],
      notice:
        "Reservix wird gerade aktualisiert. Bis dahin erscheinen die weiteren Ticketquellen.",
    };
  const prefix = reservixBatchKey(catalog.generation, 0).slice(0, -3);
  const latitude = p.radius / 111;
  const longitude = p.radius / (111 * Math.cos((p.lat * Math.PI) / 180));
  const rows = await db()
    .prepare(
      `SELECT j.value AS data FROM cache c, json_each(c.data, '$.events') j
     WHERE c.key >= ? AND c.key < ? AND c.expires_at > ?
     AND json_extract(j.value,'$.date') BETWEEN ? AND ?
     AND json_extract(j.value,'$.lat') BETWEEN ? AND ?
     AND json_extract(j.value,'$.lng') BETWEEN ? AND ?
     ORDER BY json_extract(j.value,'$.date'), json_extract(j.value,'$.id') LIMIT 3001`,
    )
    .bind(
      prefix,
      prefix + "~",
      Date.now(),
      p.from,
      p.to,
      p.lat - latitude,
      p.lat + latitude,
      p.lng - longitude,
      p.lng + longitude,
    )
    .all<{ data: string }>();
  const events = rows.results
    .slice(0, 3000)
    .map((r) => JSON.parse(r.data) as Concert)
    .filter((c) => haversine(p, c) <= p.radius);
  return {
    events,
    notice:
      rows.results.length > 3000
        ? "Die Reservix-Auswahl ist begrenzt. Ein kleinerer Umkreis oder Zeitraum kann weitere Termine zeigen."
        : "",
  };
}
export async function findReservixConcert(id: string) {
  if (!/^reservix:\d{1,20}$/.test(id))
    throw new ApiError("Ungültige Konzert-ID.");
  const catalog = await cached<ReservixCatalog>(RESERVIX_CATALOG_KEY);
  if (!catalog)
    throw new ApiError(
      "Reservix wird gerade aktualisiert. Bitte prüfe den Anbieter direkt.",
      503,
    );
  const prefix = reservixBatchKey(catalog.generation, 0).slice(0, -3);
  const row = await db()
    .prepare(
      `SELECT j.value AS data FROM cache c, json_each(c.data, '$.events') j
     WHERE c.key >= ? AND c.key < ? AND c.expires_at > ? AND json_extract(j.value,'$.id') = ? LIMIT 1`,
    )
    .bind(prefix, prefix + "~", Date.now(), id)
    .first<{ data: string }>();
  if (!row)
    throw new ApiError(
      "Dieser Reservix-Termin ist nicht mehr im aktuellen Angebot.",
      404,
    );
  return JSON.parse(row.data) as Concert;
}
