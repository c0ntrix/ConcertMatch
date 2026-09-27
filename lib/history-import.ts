import { ARTISTS, normalize } from "./catalog";
import type { Artist } from "./types";
export type HistoryResult = {
  artists: Artist[];
  plays: number;
  skipped: number;
};
export function parseHistory(texts: string[]): HistoryResult {
  const counts = new Map<
    string,
    { name: string; duration: number; plays: number }
  >();
  let plays = 0,
    skipped = 0;
  for (const text of texts) {
    let input: unknown;
    try {
      input = JSON.parse(text.replace(/^\uFEFF/, ""));
    } catch {
      throw new Error(
        "Eine Datei ist kein gültiges JSON. Bitte die entpackten Spotify-Hörverlaufsdateien wählen.",
      );
    }
    if (!Array.isArray(input))
      throw new Error(
        "Diese Datei ist kein Spotify-Hörverlauf. Gesucht sind StreamingHistory_music…json oder Streaming_History_Audio…json.",
      );
    for (const raw of input) {
      if (!raw || typeof raw !== "object") {
        skipped++;
        continue;
      }
      const row = raw as Record<string, unknown>;
      // Ignore podcast records, short skips, IPs, devices, locations and timestamps.
      if (
        row.episode_name ||
        row.episode_show_name ||
        row.spotify_episode_uri
      ) {
        skipped++;
        continue;
      }
      const name =
        typeof row.master_metadata_album_artist_name === "string"
          ? row.master_metadata_album_artist_name
          : typeof row.artistName === "string"
            ? row.artistName
            : null;
      const duration =
        typeof row.ms_played === "number" ? row.ms_played : row.msPlayed;
      if (
        !name ||
        typeof duration !== "number" ||
        !Number.isFinite(duration) ||
        duration < 30000
      ) {
        skipped++;
        continue;
      }
      const key = normalize(name);
      if (!key) {
        skipped++;
        continue;
      }
      const prior = counts.get(key) || {
        name: name.trim().slice(0, 100),
        duration: 0,
        plays: 0,
      };
      prior.duration += Math.min(duration, 24 * 3600000);
      prior.plays++;
      counts.set(key, prior);
      plays++;
    }
  }
  if (!plays)
    throw new Error(
      "Keine Musikwiedergaben ab 30 Sekunden gefunden. Bitte die Musikdateien deines Spotify-Exports wählen.",
    );
  const artists = [...counts.entries()]
    .sort((a, b) => b[1].duration - a[1].duration)
    .slice(0, 30)
    .map(
      ([key, { name }]) =>
        ARTISTS.find((a) => normalize(a.name) === key) || {
          id: "history:" + key,
          name,
          genres: [],
        },
    );
  return { artists, plays, skipped };
}
