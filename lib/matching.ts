import { normalize } from "./catalog";
import type { Artist, Concert, Member, Match, Preferences } from "./types";
export function genreKey(genre: string): string {
  const key = normalize(genre);
  if (/hiphop|rap|urban/.test(key)) return "hiphop";
  if (/rb|soul|funk/.test(key)) return "soul";
  if (/electro|dance|techno|house|edm|ambient/.test(key)) return "electronic";
  if (/indie|alternative|dreampop/.test(key)) return "indie";
  if (/metal|hardcore/.test(key)) return "metal";
  if (/punk/.test(key)) return "punk";
  if (/rock/.test(key)) return "rock";
  if (/folk|singersongwriter|country/.test(key)) return "folk";
  if (/jazz|blues/.test(key)) return "jazz";
  if (/classical|klassik|orchestra/.test(key)) return "klassik";
  if (/schlager/.test(key)) return "schlager";
  if (/pop|chanson/.test(key)) return "pop";
  return key;
}
export function sameArtist(a: Artist, b: Artist) {
  return normalize(a.name) === normalize(b.name) || (!!a.id && a.id === b.id);
}
export function haversine(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat),
    dLng = rad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
}
export function affinity(member: Member, concert: Concert) {
  const direct = concert.artists.find((a) =>
    member.artists.some((b) => sameArtist(a, b)),
  );
  if (direct)
    return { score: 100, reason: direct.name + " gehört zu deinen Favoriten." };
  const eventGenres = [
    ...new Set(
      [...concert.genres, ...concert.artists.flatMap((a) => a.genres)].map(
        genreKey,
      ),
    ),
  ];
  const profile = [
    ...new Set(
      [...member.genres, ...member.artists.flatMap((a) => a.genres)].map(
        genreKey,
      ),
    ),
  ];
  const overlap = eventGenres.filter((g) => profile.includes(g));
  if (!overlap.length)
    return {
      score: 0,
      reason:
        profile.length && eventGenres.length
          ? "Bisher keine musikalische Gemeinsamkeit gefunden."
          : "Zu wenig Genre-Daten für eine Einschätzung.",
    };
  const score = Math.round(
    45 + (30 * overlap.length) / Math.max(1, eventGenres.length),
  );
  const labels = concert.genres
    .filter((g) => overlap.includes(genreKey(g)))
    .slice(0, 2);
  return {
    score,
    reason:
      (labels.length ? labels.join(" / ") : "Der Stil") +
      " passt zu deinen Lieblingskünstlern. Eine Vermutung, kein sicherer Treffer.",
  };
}
export function matchConcert(
  concert: Concert,
  members: Member[],
  prefs: Preferences,
): Match {
  const scores = members.map((m) => ({
    id: m.id,
    name: m.name,
    ...affinity(m, concert),
  }));
  const values = scores.map((m) => m.score);
  const score = values.length
    ? Math.round(
        0.65 * Math.min(...values) +
          (0.35 * values.reduce((a, b) => a + b, 0)) / values.length,
      )
    : 0;
  return {
    concert,
    score,
    distance: Math.round(haversine(prefs, concert)),
    discovery: !members.some((m) =>
      concert.artists.some((a) => m.artists.some((b) => sameArtist(a, b))),
    ),
    members: scores,
  };
}
export function rankConcerts(
  concerts: Concert[],
  members: Member[],
  prefs: Preferences,
): Match[] {
  return concerts
    .filter(
      (c) =>
        c.status !== "cancelled" &&
        c.status !== "offsale" &&
        c.date >= prefs.from &&
        c.date <= prefs.to &&
        haversine(prefs, c) <= prefs.radius &&
        (!prefs.budget ||
          (c.price !== undefined &&
            c.currency === "EUR" &&
            c.price <= prefs.budget)),
    )
    .map((c) => matchConcert(c, members, prefs))
    .filter((c) => prefs.discovery || !c.discovery)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.distance - b.distance ||
        a.concert.date.localeCompare(b.concert.date),
    );
}
