import { ARTISTS, normalize } from "./catalog";
import type { Artist } from "./types";

export type HistoryData = {
  buckets: { name: string; day: string; duration: number; plays: number }[];
  skipped: number;
  files: number;
};
export type HistoryResult = {
  artists: Artist[];
  plays: number;
  skipped: number;
  availableArtists: number;
  undated: number;
};
export type HistoryPeriod = "recent" | "all" | `${number}`;

export function historyAccumulator() {
  const buckets = new Map<string, HistoryData["buckets"][number]>();
  let skipped = 0,
    files = 0;
  return {
    add(text: string) {
      let input: unknown;
      try {
        input = JSON.parse(text.replace(/^\uFEFF/, ""));
      } catch {
        throw new Error(
          "Eine Hörverlaufsdatei ist kein gültiges JSON. Bitte den Spotify-Export erneut herunterladen.",
        );
      }
      if (!Array.isArray(input))
        throw new Error(
          "Diese Datei ist kein Spotify-Hörverlauf. Gesucht sind StreamingHistory_music…json oder Streaming_History_Audio…json.",
        );
      files++;
      for (const raw of input) {
        if (!raw || typeof raw !== "object") {
          skipped++;
          continue;
        }
        const row = raw as Record<string, unknown>;
        const name =
          typeof row.master_metadata_album_artist_name === "string"
            ? row.master_metadata_album_artist_name
            : typeof row.artistName === "string"
              ? row.artistName
              : null;
        const duration =
          typeof row.ms_played === "number" ? row.ms_played : row.msPlayed;
        if (
          row.episode_name ||
          row.episode_show_name ||
          row.spotify_episode_uri ||
          row.audiobook_title ||
          row.audiobook_uri ||
          row.audiobook_chapter_uri ||
          !name ||
          typeof duration !== "number" ||
          !Number.isFinite(duration) ||
          duration < 30000 ||
          !normalize(name)
        ) {
          skipped++;
          continue;
        }
        const timestamp = typeof row.ts === "string" ? row.ts : row.endTime;
        // Standard exports use a UTC date without the trailing Z.
        const time =
          typeof timestamp === "string"
            ? Date.parse(
                /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(timestamp)
                  ? timestamp.replace(" ", "T") + ":00Z"
                  : timestamp,
              )
            : NaN;
        const day = Number.isFinite(time)
          ? new Date(time).toISOString().slice(0, 10)
          : "";
        const key = normalize(name) + "|" + day;
        const prior = buckets.get(key) || {
          name: name.trim().slice(0, 100),
          day,
          duration: 0,
          plays: 0,
        };
        prior.duration += Math.min(duration, 24 * 3600000);
        prior.plays++;
        buckets.set(key, prior);
      }
    },
    result(): HistoryData {
      if (!buckets.size)
        throw new Error(
          "Keine Musikwiedergaben ab 30 Sekunden gefunden. Bitte die Musikdateien deines Spotify-Exports wählen.",
        );
      return { buckets: [...buckets.values()], skipped, files };
    },
  };
}

export function rankHistory(
  data: HistoryData,
  {
    period = "recent",
    limit = 20,
    now = new Date(),
  }: {
    period?: HistoryPeriod;
    limit?: number;
    now?: Date;
  } = {},
): HistoryResult {
  const today = now.toISOString().slice(0, 10);
  const start = new Date(now);
  start.setUTCFullYear(start.getUTCFullYear() - 1);
  const cutoff = start.toISOString().slice(0, 10);
  const counts = new Map<
    string,
    { name: string; duration: number; plays: number }
  >();
  let plays = 0,
    undated = 0;
  for (const item of data.buckets) {
    if (!item.day) undated += item.plays;
    if (
      period !== "all" &&
      (!item.day ||
        (period === "recent"
          ? item.day < cutoff || item.day > today
          : !item.day.startsWith(period + "-")))
    )
      continue;
    const key = normalize(item.name);
    const prior = counts.get(key) || { name: item.name, duration: 0, plays: 0 };
    prior.duration += item.duration;
    prior.plays += item.plays;
    counts.set(key, prior);
    plays += item.plays;
  }
  const artists = [...counts.entries()]
    .sort((a, b) => b[1].duration - a[1].duration || a[0].localeCompare(b[0]))
    .slice(0, Math.max(1, Math.min(50, Math.floor(limit))))
    .map(
      ([key, { name }]) =>
        ARTISTS.find((a) => normalize(a.name) === key) || {
          id: "history:" + key,
          name,
          genres: [],
        },
    );
  return {
    artists,
    plays,
    skipped: data.skipped,
    availableArtists: counts.size,
    undated,
  };
}

export function parseHistory(texts: string[]): HistoryResult {
  const accumulator = historyAccumulator();
  texts.forEach((text) => accumulator.add(text));
  return rankHistory(accumulator.result(), { period: "all", limit: 30 });
}
