import { normalize } from "./catalog";
import type { Artist } from "./types";

// An incomplete result cannot prove that a name is missing or unambiguous.
export function resolveMetadataBatch(
  names: string[],
  candidates: Artist[],
  complete: boolean,
) {
  const resolved = new Map<string, Artist | null>();
  if (!complete) return resolved;
  for (const name of names) {
    const exact = candidates.filter(
      (a) => normalize(a.name) === normalize(name),
    );
    const unique = [...new Map(exact.map((a) => [a.mbid || a.id, a])).values()];
    resolved.set(normalize(name), unique.length === 1 ? unique[0] : null);
  }
  return resolved;
}
