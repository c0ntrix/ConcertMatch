import test from "node:test";
import assert from "node:assert/strict";
import { discoveryGenres, musicGenres } from "../lib/discovery-plan";
import type { Member } from "../lib/types";
const member = (genres: string[]): Member => ({
  id: "a",
  name: "A",
  artists: [{ id: "x", name: "Favorite", genres }],
  genres: [],
});
const genres = [
  { id: "rap", name: "Hip-Hop/Rap" },
  { id: "rock", name: "Rock" },
  { id: "jazz", name: "Jazz" },
  { id: "blues", name: "Blues" },
  { id: "dance", name: "Dance/Electronic" },
];
test("genre discovery prioritizes group coverage rather than a curated list of artist names", () => {
  assert.equal(
    discoveryGenres(
      [member(["hip hop", "trap"]), member(["trap", "hip hop"])],
      genres,
    )[0].id,
    "rap",
  );
  assert.equal(discoveryGenres([member(["indie rock"])], genres)[0].id, "rock");
  assert.equal(discoveryGenres([member(["techno"])], genres)[0].id, "dance");
  assert.deepEqual(discoveryGenres([member([])], genres), []);
});
test("provider genres in the same music family are all queried, within three family slots", () => {
  assert.equal(discoveryGenres([member(["jazz"])], genres)[0].id, "blues,jazz");
  assert.ok(discoveryGenres([member([])], genres).length <= 3);
});
test("the classification catalogue only contributes actual music genres", () => {
  assert.deepEqual(
    musicGenres({
      _embedded: {
        classifications: [
          { segment: { name: "Music", _embedded: { genres } } },
          {
            segment: {
              name: "Sports",
              _embedded: { genres: [{ id: "sport", name: "Rock" }] },
            },
          },
        ],
      },
    }),
    genres,
  );
});
