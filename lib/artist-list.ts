import { ARTISTS, normalize } from "./catalog";
import type { Artist } from "./types";

export function parseArtistList(text: string): Artist[] {
  // Commas belong to names such as “Tyler, The Creator”; never split on them.
  const names = text
    .split(/[\n;]+/)
    .map((n) => n.replace(/^\s*(?:\d+[.)]\s*|[-•]\s+)/, "").trim())
    .filter(Boolean);
  if (names.length > 50)
    throw new Error("Bitte höchstens 50 Künstler einfügen.");
  if (names.some((n) => n.length > 100 || /^https?:\/\//i.test(n)))
    throw new Error(
      "Bitte nur Künstlernamen einfügen, einen pro Zeile – keine Links oder ganzen Seiten.",
    );
  return [
    ...new Map(
      names.map((name) => [
        normalize(name),
        ARTISTS.find((a) => normalize(a.name) === normalize(name)) || {
          id: "manual:" + normalize(name),
          name,
          genres: [],
        },
      ]),
    ).values(),
  ];
}
