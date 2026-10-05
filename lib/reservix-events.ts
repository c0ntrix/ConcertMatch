import type { Concert } from "./types";

export const RESERVIX_PUBLISHER = "3113053";
export const RESERVIX_MERCHANT = "31293";
export const RESERVIX_CATALOG_KEY = "reservix:catalog:v1";
export const RESERVIX_TTL = 36 * 3600000;
export const RESERVIX_BATCH_SIZE = 100;
export const RESERVIX_MAX_BATCHES = 250;
export function reservixBatchKey(generation: string, batch: number) {
  return `reservix:v1:${generation}:${String(batch).padStart(3, "0")}`;
}

// Exact, observed Reservix music categories. Shows, tourism and generic parties
// are not evidence of a concert. Never infer a billed artist from a show title.
const musicGenres = new Set([
  "Rock",
  "Pop",
  "Jazz",
  "Schlager",
  "Singer Songwriter",
  "Classic Rock",
  "Weltmusik",
  "A cappella",
  "Metal",
  "Indie Pop",
  "Blues Rock",
  "Blues",
  "Punk",
  "Liedermacher",
  "Folk Rock",
  "Chanson",
  "Deutschrock",
  "Swing",
  "Irish Folk",
  "Hard Rock",
  "Folk",
  "Elektronische Musik",
  "Country",
  "Alternative",
  "Deutsch Hip Hop",
  "Soul",
  "Hip Hop",
  "Reggae",
  "R&B",
  "Klassisches Konzert",
  "Konzert Klavier",
  "Kammermusik",
  "Chormusik",
  "Kirchenmusik",
  "Gospels & Spirituals",
  "Sinfonische Musik",
  "Lieder",
  "Barockmusik",
  "Orgelmusik",
  "Weihnachtskonzert",
  "Kinderkonzert",
  "Festival / Jazz-Rock-Pop",
  "Festival / Klassik",
]);

export function isReservixAffiliateLink(value: string) {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      u.hostname === "www.awin1.com" &&
      !u.username &&
      !u.password &&
      u.pathname === "/pclick.php" &&
      u.searchParams.get("a") === RESERVIX_PUBLISHER &&
      u.searchParams.get("m") === RESERVIX_MERCHANT &&
      /^\d{1,20}$/.test(u.searchParams.get("p") || "")
    );
  } catch {
    return false;
  }
}

export function parseReservixEvent(
  row: Record<string, string>,
  checkedAt: string,
): Concert | null {
  const id = row.merchant_product_id;
  const product = row.aw_product_id;
  const title = row.product_name?.trim();
  const genre = row["Tickets:genre"]?.trim();
  const dateTime = row["Tickets:event_date"]?.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2})?$/,
  );
  const venue = row["Tickets:venue_name"]?.trim();
  const city = row["Tickets:event_location_city"]?.trim();
  const latText = row["Tickets:latitude"]?.trim();
  const lngText = row["Tickets:longitude"]?.trim();
  const lat = Number(latText),
    lng = Number(lngText);
  if (
    row.merchant_id !== RESERVIX_MERCHANT ||
    !/^\d{1,20}$/.test(id || "") ||
    !/^\d{1,20}$/.test(product || "") ||
    !title ||
    title.length > 500 ||
    !musicGenres.has(genre) ||
    !dateTime ||
    !venue ||
    !city ||
    !latText ||
    !lngText ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180 ||
    (!lat && !lng) ||
    row.in_stock === "0" ||
    /^(?:out of stock|unavailable|ausverkauft|nicht verfügbar)$/i.test(
      row.stock_status || "",
    )
  )
    return null;
  const [date, time] = dateTime.slice(1);
  const parsedDate = new Date(date + "T" + time + ":00Z");
  if (
    !Number.isFinite(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 16) !== date + "T" + time ||
    date < checkedAt.slice(0, 10) ||
    date >
      new Date(Date.parse(checkedAt) + 366 * 86400000)
        .toISOString()
        .slice(0, 10)
  )
    return null;
  try {
    const destination = new URL(row.merchant_deep_link);
    if (
      destination.protocol !== "https:" ||
      destination.hostname !== "www.reservix.de" ||
      destination.username ||
      destination.password ||
      !destination.pathname.endsWith("/e" + id)
    )
      return null;
  } catch {
    return null;
  }
  if (
    !isReservixAffiliateLink(row.aw_deep_link) ||
    new URL(row.aw_deep_link).searchParams.get("p") !== product
  )
    return null;
  const url = new URL("https://www.awin1.com/pclick.php");
  // Canonicalize: discard any unverified redirect/click-reference parameters.
  url.search = new URLSearchParams({
    p: product,
    a: RESERVIX_PUBLISHER,
    m: RESERVIX_MERCHANT,
  }).toString();
  const artists = [row["Tickets:primary_artist"], row["Tickets:second_artist"]]
    .filter((name): name is string => !!name?.trim())
    .map((name, index) => ({
      id: `reservix:${id}:artist:${index}`,
      name: name.trim(),
      genres: [genre],
    }));
  const price = row.search_price?.trim() ? Number(row.search_price) : undefined;
  const currency = row.currency?.trim().toUpperCase();
  return {
    id: "reservix:" + id,
    title,
    artists,
    date,
    time,
    venue,
    city,
    lat,
    lng,
    url: url.toString(),
    genres: [genre],
    source: "Reservix",
    checkedAt,
    // Feed membership is not a real-time stock guarantee. No images are hotlinked.
    status: "onsale",
    ...(price !== undefined &&
    Number.isFinite(price) &&
    price >= 0 &&
    /^[A-Z]{3}$/.test(currency || "")
      ? { price, currency }
      : {}),
  };
}
