import { genreKey } from "./matching";
import type { Member } from "./types";
export type ProviderGenre = { id: string; name: string };
export type ClassificationCatalogue = {
  _embedded?: {
    classifications?: {
      segment?: { name?: string; _embedded?: { genres?: ProviderGenre[] } };
    }[];
  };
};
export function musicGenres(
  catalogue: ClassificationCatalogue,
): ProviderGenre[] {
  return (
    catalogue._embedded?.classifications?.flatMap((row) =>
      row.segment?.name?.toLowerCase() === "music"
        ? row.segment._embedded?.genres || []
        : [],
    ) || []
  ).map(({ id, name }) => ({ id, name }));
}
export function discoveryGenres(members: Member[], genres: ProviderGenre[]) {
  const tastes = members.map(
    (m) =>
      new Set(
        [...m.genres, ...m.artists.flatMap((a) => a.genres.slice(0, 3))].map(
          genreKey,
        ),
      ),
  );
  const buckets = new Map<string, ProviderGenre[]>();
  for (const genre of genres) {
    const family = genreKey(genre.name);
    buckets.set(family, [...(buckets.get(family) || []), genre]);
  }
  return [...buckets]
    .map(([family, rows]) => ({
      family,
      // Ticketmaster accepts comma-separated genre IDs. Keep both Jazz and Blues,
      // for example, rather than silently picking just the first genre in a family.
      id: rows
        .map((g) => g.id)
        .sort()
        .join(","),
      name: rows
        .map((g) => g.name)
        .sort()
        .join(" / "),
      coverage: tastes.filter(
        (t) =>
          t.has(family) ||
          (family === "rock" && (t.has("indie") || t.has("punk"))),
      ).length,
    }))
    .filter((g) => g.coverage > 0)
    .sort((a, b) => b.coverage - a.coverage || a.name.localeCompare(b.name))
    .slice(0, 3);
}
