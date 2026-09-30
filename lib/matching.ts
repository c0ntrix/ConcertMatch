import { normalize } from "./catalog";
import type {
  Artist,
  Concert,
  Member,
  Match,
  Preferences,
  Recommendations,
} from "./types";
export function genreKey(genre: string): string {
  const key = normalize(genre);
  if (/hiphop|rap|urban/.test(key)) return "hiphop";
  if (/^(rb|rbsoul)$|soul|funk/.test(key)) return "soul";
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
  if (a.id && a.id === b.id) return true;
  if (a.mbid && b.mbid) return a.mbid === b.mbid;
  const left = [a.name, ...(a.aliases || [])].map(normalize).filter(Boolean);
  const right = [b.name, ...(b.aliases || [])].map(normalize).filter(Boolean);
  return left.some((n) => right.includes(n));
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
// Broad families are weak evidence; a shared subgenre is much more useful.
const broad = new Set([
  "hiphop",
  "hiphoprap",
  "rap",
  "urban",
  "pop",
  "rock",
  "indie",
  "alternative",
  "alternativerock",
  "electronic",
  "dance",
  "rb",
  "rbsoul",
  "soul",
  "folk",
  "jazz",
  "blues",
  "metal",
  "punk",
  "classical",
  "klassik",
  "schlager",
  "country",
]);
const styleKey = (genre: string) =>
  ({ trapmusic: "trap", emotrap: "emorap" })[normalize(genre)] ||
  normalize(genre);
const specifics = (genres: string[]) =>
  [...new Set(genres.map(styleKey))].filter((g) => g && !broad.has(g));
function styleAffinity(favorite: Artist, eventGenres: string[]) {
  const families = [...new Set(eventGenres.map(genreKey))];
  const shared = specifics(eventGenres).filter((g) =>
    specifics(favorite.genres).includes(g),
  );
  const overlap = families.filter((g) =>
    favorite.genres.some((x) => genreKey(x) === g),
  );
  if (!overlap.length && !shared.length) return { score: 0, labels: [] };
  const specificPosition = Math.max(
    Math.min(
      ...favorite.genres.map((g, i) =>
        shared.includes(styleKey(g)) ? i : Infinity,
      ),
    ),
    Math.min(
      ...eventGenres.map((g, i) =>
        shared.includes(styleKey(g)) ? i : Infinity,
      ),
    ),
  );
  const familyPosition = Math.max(
    Math.min(
      ...favorite.genres.map((g, i) =>
        overlap.includes(genreKey(g)) ? i : Infinity,
      ),
    ),
    Math.min(
      ...eventGenres.map((g, i) =>
        overlap.includes(genreKey(g)) ? i : Infinity,
      ),
    ),
  );
  // MusicBrainz tags arrive in vote order. A peripheral pop/rock tag on a
  // rapper should not make piano-pop a strong recommendation for the group.
  let score = shared.length
    ? Math.min(82, 64 + shared.length * 6) - Math.min(18, specificPosition * 2)
    : Math.round(
        (26 + (14 * overlap.length) / Math.max(1, families.length)) /
          (1 + familyPosition * 0.35),
      );
  const labels = eventGenres
    .filter((g) => shared.includes(styleKey(g)))
    .slice(0, 2);
  if (shared.length && specificPosition > 4) score = Math.min(score, 40);
  if (shared.length && specificPosition > 6) score = Math.min(score, 24);
  return { score, labels };
}
export function affinity(member: Member, concert: Concert) {
  const direct = concert.artists.find((a) =>
    member.artists.some((b) => sameArtist(a, b)),
  );
  if (direct)
    return { score: 100, reason: direct.name + " gehört zu deinen Favoriten." };
  const favorites = member.artists.filter(
    (a, i, all) => all.findIndex((b) => sameArtist(a, b)) === i,
  );
  const references = [
    ...favorites,
    ...(member.genres.length
      ? [
          {
            id: "genre-selection",
            name: "deiner Genreauswahl",
            genres: member.genres,
          },
        ]
      : []),
  ];
  const candidates = concert.artists.length
    ? concert.artists
    : [{ name: concert.title, genres: concert.genres }];
  let best = {
    score: 0,
    reason: "Bisher keine belastbare musikalische Gemeinsamkeit gefunden.",
  };
  // One peripheral favorite cannot represent a person's whole music taste.
  // The first billed artist represents the main show; support is weaker evidence.
  candidates.forEach((candidate, index) => {
    const eventGenres = candidate.genres.length
      ? candidate.genres
      : concert.genres;
    const pairs = references.map((favorite) => ({
      ...styleAffinity(favorite, eventGenres),
      favorite,
    }));
    const strongest = [...pairs].sort((a, b) => b.score - a.score)[0];
    if (!strongest || !strongest.score) return;
    const average =
      pairs.reduce((total, pair) => total + pair.score, 0) / pairs.length;
    const score = Math.round(
      (0.6 * strongest.score + 0.4 * average) * (index === 0 ? 1 : 0.65),
    );
    if (score > best.score)
      best = {
        score,
        reason:
          (index ? "Support: " : "") +
          (strongest.labels.length
            ? strongest.labels.join(" / ") +
              " verbindet " +
              candidate.name +
              " mit " +
              strongest.favorite.name +
              ". Die übrige Auswahl zählt mit."
            : "Ähnliche Grundrichtung wie " +
              strongest.favorite.name +
              ", aber bisher nur grobe Genre-Daten. Zum Reinhören."),
      };
  });
  return best;
}

export function distanceLabel(match: Match, origin: Preferences) {
  return normalize(match.concert.city) === normalize(origin.city)
    ? "in " + origin.city
    : "ca. " + match.distance + " km Luftlinie";
}

export function prominence(concert: Concert) {
  const listeners = Math.max(
    0,
    ...concert.artists.map((a) => a.listeners || 0),
  );
  // ListenBrainz is a community sample, not Spotify's global listener count.
  const audience = listeners
    ? Math.min(12, Math.max(0, Math.log10(listeners) - 1) * 4)
    : 0;
  return audience;
}

export function deduplicateConcerts(concerts: Concert[]) {
  const seen = new Map<string, Concert>();
  for (const c of concerts) {
    // Upgrades are not independent concerts and may not include admission.
    if (
      /\b(upgrades?|parking|parkplatz|meet ?[&+] ?greet|vip.?package|vip.?paket|loge|logen[ -]?seat|logenticket|box seat|ticketmaster suite|premium (?:seats?|packages?)|hospitality|platinum)\b/i.test(
        c.title,
      )
    )
      continue;
    const identity = c.artists.length
      ? c.artists
          .map((a) => normalize(a.name))
          .sort()
          .join("|")
      : normalize(c.title);
    const key = [
      identity,
      c.date,
      c.time || "",
      normalize(c.venue),
      normalize(c.city),
    ].join(":");
    const previous = seen.get(key);
    if (
      !previous ||
      (/\bvip\b/i.test(previous.title) && !/\bvip\b/i.test(c.title))
    )
      seen.set(key, c);
  }
  return [...seen.values()];
}
export function matchConcert(
  concert: Concert,
  members: Member[],
  prefs: Preferences,
  recommendations?: Recommendations,
): Match {
  const assessment = recommendations?.[concert.id];
  const scores = members.map((m) => ({
    id: m.id,
    name: m.name,
    ...(affinity(m, concert).score === 100 || !recommendations
      ? affinity(m, concert)
      : {
          score: assessment?.scores[m.id] ?? 0,
          reason: assessment
            ? "KI-Einschätzung für deinen Musikgeschmack. " + assessment.reason
            : "Keine ausreichend passende Empfehlung für dieses Profil.",
        }),
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
  recommendations?: Recommendations,
): Match[] {
  const available = concerts.filter(
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
  );
  return deduplicateConcerts(available)
    .map((c) => matchConcert(c, members, prefs, recommendations))
    .filter(
      (c) =>
        c.score > 0 &&
        (!c.discovery ||
          (prefs.discovery && c.members.every((m) => m.score >= 30))),
    )
    .sort(
      (a, b) =>
        b.score + prominence(b.concert) - (a.score + prominence(a.concert)) ||
        b.score - a.score ||
        (a.concert.providerRank ?? 9999) - (b.concert.providerRank ?? 9999) ||
        a.distance - b.distance ||
        a.concert.date.localeCompare(b.concert.date),
    );
}
