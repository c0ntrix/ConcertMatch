import { resolveMetadataBatch } from "./artist-metadata";
import { ARTISTS, normalize } from "./catalog";
import { ApiError, cached, db, putCache } from "./server";
import type { Artist } from "./types";

const agent =
  "ConcertMatch/0.2 (https://concertmatch.ticore.workers.dev; tilowill02@gmail.com)";
const week = 7 * 86400000;
type MBArtist = {
  id: string;
  name: string;
  score?: number;
  country?: string;
  disambiguation?: string;
  aliases?: { name: string; type?: string }[];
  tags?: { name: string; count: number }[];
};
const literal = (s: string) => '"' + s.replace(/[\\"]/g, "\\$&") + '"';

// A shared lease, rather than an isolate-local timer, respects MusicBrainz's
// one-request-per-second limit even when several visitors search at once.
async function queryMusicBrainz(
  query: string,
  limit = 16,
): Promise<{ artists: MBArtist[]; complete: boolean }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const now = Date.now();
    const slot = await db()
      .prepare(
        "INSERT INTO rate_limits(key,count,expires_at) VALUES('mb:lease',?,?) ON CONFLICT(key) DO UPDATE SET count=excluded.count,expires_at=excluded.expires_at WHERE rate_limits.count<=? RETURNING count",
      )
      .bind(now + 1100, Math.ceil(now / 1000) + 60, now)
      .first();
    if (!slot) {
      await new Promise((resolve) => setTimeout(resolve, 1100));
      continue;
    }
    const url = new URL("https://musicbrainz.org/ws/2/artist/");
    url.search = new URLSearchParams({
      query,
      fmt: "json",
      limit: String(limit),
    }).toString();
    const response = await fetch(url, {
      headers: { "User-Agent": agent, Accept: "application/json" },
      signal: AbortSignal.timeout(6500),
    });
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      await response.body?.cancel();
      await new Promise((resolve) => setTimeout(resolve, 1100));
      continue;
    }
    if (!response.ok)
      throw new ApiError(
        "Der Musikkatalog ist gerade ausgelastet. Bitte erneut versuchen.",
        503,
      );
    const data = (await response.json()) as {
      artists?: MBArtist[];
      count?: number;
    };
    const artists = data.artists || [];
    return {
      artists,
      complete:
        typeof data.count === "number"
          ? data.count <= artists.length
          : artists.length < limit,
    };
  }
  throw new ApiError(
    "Der Musikkatalog ist gerade ausgelastet. Bitte erneut versuchen.",
    503,
  );
}

async function musicBrainz(query: string, limit = 16) {
  return (await queryMusicBrainz(query, limit)).artists;
}

function fromMB(a: MBArtist): Artist {
  const genres = (a.tags || [])
    .filter(
      (t) =>
        t.count > 0 &&
        t.name.length <= 60 &&
        /\b(rap|hip.hop|trap|drill|pop|rock|metal|punk|indie|folk|jazz|blues|soul|r&b|electronic|electronica|techno|house|dance|disco|ambient|classical|reggae|reggaeton|country|schlager|emo|shoegaze|grunge|synthwave|funk|hardcore)\b/i.test(
          t.name,
        ),
    )
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
    .map((t) => t.name);
  return {
    id: "mb:" + a.id,
    mbid: a.id,
    name: a.name.slice(0, 100),
    genres,
    aliases: (a.aliases || [])
      .filter((v) => v.type !== "Search hint")
      .map((v) => v.name)
      .filter((v) => v.length <= 100)
      .slice(0, 12),
    description: [a.disambiguation, a.country]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 180),
    url: "https://musicbrainz.org/artist/" + a.id,
  };
}

async function withPopularity(artists: Artist[]): Promise<Artist[]> {
  const ids = [...new Set(artists.flatMap((a) => (a.mbid ? [a.mbid] : [])))];
  if (!ids.length) return artists;
  try {
    const response = await fetch(
      "https://api.listenbrainz.org/1/popularity/artist",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": agent },
        body: JSON.stringify({ artist_mbids: ids }),
        signal: AbortSignal.timeout(4000),
      },
    );
    if (!response.ok) return artists;
    const rows = (await response.json()) as {
      artist_mbid: string;
      total_user_count: number | null;
    }[];
    const counts = new Map(
      rows.map((r) => [r.artist_mbid, r.total_user_count]),
    );
    return artists.map((a) => {
      const count = counts.get(a.mbid || "");
      return typeof count === "number" && Number.isFinite(count) && count >= 0
        ? { ...a, listeners: Math.floor(count) }
        : a;
    });
  } catch {
    return artists;
  }
}

export async function searchMusic(
  query: string,
): Promise<{ artists: Artist[]; notice?: string }> {
  const key = "music:v2:" + normalize(query);
  const hit = await cached<{ artists: Artist[]; notice?: string }>(key);
  if (hit) return hit;
  let artists: Artist[];
  let notice: string | undefined;
  try {
    const words = query
      .trim()
      .split(/\s+/)
      .map(
        (word, i, all) =>
          word.replace(/[+\-!(){}\[\]^"~*?:\\/&|]/g, "\\$&") +
          (i === all.length - 1 ? "*" : ""),
      )
      .join(" AND ");
    artists = await withPopularity(
      (await musicBrainz(`artist:(${words}) OR alias:${literal(query)}`)).map(
        fromMB,
      ),
    );
    // Textual relevance comes first. Listener counts disambiguate same-name acts.
    artists.sort(
      (a, b) =>
        Number(normalize(b.name) === normalize(query)) -
          Number(normalize(a.name) === normalize(query)) ||
        Number(normalize(b.name).startsWith(normalize(query))) -
          Number(normalize(a.name).startsWith(normalize(query))) ||
        Number(!!b.description?.endsWith("· DE")) -
          Number(!!a.description?.endsWith("· DE")) ||
        (b.listeners || 0) - (a.listeners || 0),
    );
  } catch {
    // Apple's recording-artist catalogue also includes artists who never tour.
    const minute = Math.floor(Date.now() / 60000);
    const budget = await db()
      .prepare(
        "INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
      )
      .bind("itunes:" + minute, (minute + 1) * 60)
      .first<{ count: number }>();
    if (!budget || budget.count > 18)
      throw new ApiError(
        "Die Künstlersuche ist gerade ausgelastet. Deine Auswahl bleibt erhalten; bitte gleich erneut versuchen.",
        503,
      );
    const url = new URL("https://itunes.apple.com/search");
    url.search = new URLSearchParams({
      term: query,
      entity: "musicArtist",
      limit: "16",
      country: "DE",
    }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!response.ok)
      throw new ApiError(
        "Die Künstlersuche ist gerade nicht erreichbar. Bitte erneut versuchen.",
        503,
      );
    const data = (await response.json()) as {
      results?: {
        artistId: number;
        artistName: string;
        primaryGenreName?: string;
        artistLinkUrl?: string;
      }[];
    };
    artists = (data.results || []).map((a) => ({
      id: "apple:" + a.artistId,
      name: a.artistName.slice(0, 100),
      genres: a.primaryGenreName ? [a.primaryGenreName] : [],
      url: a.artistLinkUrl,
    }));
    notice =
      "Zusätzlicher Musikkatalog · detaillierte Stilrichtungen sind gerade teilweise nicht verfügbar.";
  }
  const local = ARTISTS.filter(
    (a) =>
      normalize(a.name).includes(normalize(query)) &&
      !artists.some((b) => normalize(a.name) === normalize(b.name)),
  );
  const result = { artists: [...artists, ...local].slice(0, 20), notice };
  await putCache(key, result, notice ? 60000 : 86400000);
  return result;
}

// Resolve names in small batches, cache public metadata across groups, and leave
// ambiguous names unresolved rather than silently assigning another musician.
export async function enrichArtists(
  input: Artist[],
  maxBatches = 4,
): Promise<Artist[]> {
  const names = [
    ...new Map(input.map((a) => [normalize(a.name), a.name])).values(),
  ];
  const resolved = new Map<string, Artist | null>();
  for (let offset = 0; offset < names.length; offset += 40) {
    const keys = names
      .slice(offset, offset + 40)
      .flatMap((n) => [
        "artist-meta:v3:" + normalize(n),
        "artist-meta:v4:" + normalize(n),
      ]);
    if (!keys.length) continue;
    const rows = await db()
      .prepare(
        `SELECT key,data FROM cache WHERE key IN (${keys.map(() => "?").join(",")}) AND expires_at>?`,
      )
      .bind(...keys, Date.now())
      .all<{ key: string; data: string }>();
    for (const row of rows.results.sort((a, b) => a.key.localeCompare(b.key))) {
      const value = JSON.parse(row.data) as Artist | null;
      // Keep valid old metadata, but retry old negative entries from truncated queries.
      if (value || row.key.startsWith("artist-meta:v4:"))
        resolved.set(row.key.slice("artist-meta:v4:".length), value);
    }
  }
  const missing = names.filter((n) => !resolved.has(normalize(n)));
  const pending: string[][] = [];
  for (
    let offset = 0;
    offset < Math.min(missing.length, maxBatches * 30);
    offset += 30
  )
    pending.push(missing.slice(offset, offset + 30));
  for (let request = 0; request < maxBatches * 2 && pending.length; request++) {
    const batch = pending.shift()!;
    try {
      const result = await queryMusicBrainz(
        batch.map((n) => "artist:" + literal(n)).join(" OR "),
        100,
      );
      if (!result.complete) {
        // Retry smaller batches before later names. Never cache a truncated miss.
        if (batch.length > 1) {
          const middle = Math.ceil(batch.length / 2);
          pending.unshift(batch.slice(0, middle), batch.slice(middle));
        }
        continue;
      }
      const candidates = await withPopularity(result.artists.map(fromMB));
      const metadata = resolveMetadataBatch(batch, candidates, true);
      const statements = [...metadata].map(([name, best]) => {
        resolved.set(name, best);
        return db()
          .prepare(
            "INSERT INTO cache(key,data,expires_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data,expires_at=excluded.expires_at",
          )
          .bind(
            "artist-meta:v4:" + name,
            JSON.stringify(best),
            Date.now() + (best ? week : 86400000),
          );
      });
      if (statements.length) await db().batch(statements);
    } catch {
      break;
    }
  }

  return input.map((a) => {
    const meta = resolved.get(normalize(a.name));
    if (!meta || (a.mbid && a.mbid !== meta.mbid)) return a;
    return {
      ...meta,
      ...a,
      mbid: meta.mbid,
      genres: [...new Set([...meta.genres, ...a.genres])].slice(0, 12),
      aliases: meta.aliases,
      listeners: meta.listeners,
    };
  });
}
