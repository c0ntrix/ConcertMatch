import test from "node:test";
import assert from "node:assert/strict";
import { strToU8, zipSync } from "fflate";
import { historyAccumulator, rankHistory } from "../lib/history-import";
import { HISTORY_LIMITS, readHistoryFiles } from "../lib/history-files";

const row = (name: string, ts: string, ms_played = 60000) => ({
  master_metadata_album_artist_name: name,
  ts,
  ms_played,
});
const file = (name: string, bytes: Uint8Array) => ({
  name,
  size: bytes.length,
  arrayBuffer: async () => Uint8Array.from(bytes).buffer,
});
const now = new Date("2026-10-01T12:00:00Z");

test("nested multi-year Spotify ZIP reads audio only and matches standalone JSON", async () => {
  const a = JSON.stringify([
    row("Current artist", "2026-09-20T10:00:00Z"),
    row("Current artist", "2026-09-21T10:00:00Z"),
  ]);
  const b = JSON.stringify([
    row("Old favorite", "2020-01-01T10:00:00Z", 900000),
  ]);
  const zip = zipSync({
    "Spotify Extended Streaming History/Streaming_History_Audio_2026.json":
      strToU8(a),
    "Spotify Extended Streaming History/Streaming_History_Audio_2020_0.json":
      strToU8(b),
    "Streaming_History_Video_2026.json": strToU8("invalid video JSON"),
    "ReadMeFirst.pdf": strToU8("not JSON"),
    "Account_data.json": strToU8("private account data"),
    "__MACOSX/._Streaming_History_Audio_2026.json": strToU8("metadata"),
  });
  const packed = await readHistoryFiles([file("Spotify.zip", zip)]);
  const unpacked = await readHistoryFiles([
    file("Streaming_History_Audio_2026.json", strToU8(a)),
    file("Streaming_History_Audio_2020_0.json", strToU8(b)),
  ]);
  assert.deepEqual(
    rankHistory(packed, { period: "all" }),
    rankHistory(unpacked, { period: "all" }),
  );
  assert.equal(packed.files, 2);
  assert.equal(rankHistory(packed, { now }).artists[0].name, "Current artist");
  assert.equal(
    rankHistory(packed, { period: "all" }).artists[0].name,
    "Old favorite",
  );
  assert.equal(rankHistory(packed, { period: "2020" }).plays, 1);
});

test("recent history includes previous calendar year at the boundary, excludes future and undated rows", () => {
  const data = historyAccumulator();
  data.add(
    JSON.stringify([
      row("Boundary", "2025-10-01T00:00:00Z"),
      row("Too old", "2025-09-30T23:59:59Z"),
      row("Future", "2027-01-01T00:00:00Z"),
      { artistName: "Undated", msPlayed: 60000 },
      { artistName: "Standard", endTime: "2026-03-01 12:00", msPlayed: 60000 },
      { ...row("Podcast", "2026-01-01"), episode_name: "Episode" },
      { ...row("Book", "2026-01-01"), audiobook_title: "Book" },
      row("Skipped", "2026-01-01", 29999),
    ]),
  );
  const result = rankHistory(data.result(), { now });
  assert.deepEqual(
    result.artists.map((a) => a.name),
    ["Boundary", "Standard"],
  );
  assert.equal(result.undated, 1);
  assert.equal(result.skipped, 3);
  assert.equal(rankHistory(data.result(), { period: "all" }).plays, 5);
});
test("standard Spotify account ZIP filenames with underscores are supported", async () => {
  const bytes = zipSync({
    "MyData/StreamingHistory_music_0.json": strToU8(
      JSON.stringify([
        {
          artistName: "Standard Artist",
          endTime: "2026-09-01 12:00",
          msPlayed: 180000,
        },
      ]),
    ),
  });
  const result = rankHistory(
    await readHistoryFiles([file("my_spotify_data.zip", bytes)]),
    { now },
  );
  assert.equal(result.artists[0].name, "Standard Artist");
});

test("artist count is editable, ranks hearing time and deduplicates spellings", () => {
  const data = historyAccumulator();
  data.add(
    JSON.stringify(
      Array.from({ length: 60 }, (_, i) =>
        row("Artist " + i, "2026-01-01", 30000 + i * 1000),
      ),
    ),
  );
  data.add(
    JSON.stringify([
      row("Artist 59", "2026-01-02"),
      row("ARTIST 59", "2026-01-02"),
    ]),
  );
  assert.equal(rankHistory(data.result(), { now }).artists.length, 20);
  assert.equal(
    rankHistory(data.result(), { now, limit: 50 }).artists.length,
    50,
  );
  assert.equal(
    rankHistory(data.result(), { now, limit: 10 }).artists[0].name,
    "Artist 59",
  );
});

test("corrupt, unrelated, oversized and empty ZIP archives fail without processing account data", async () => {
  await assert.rejects(
    readHistoryFiles([file("broken.zip", strToU8("broken"))]),
    /ZIP-Datei/,
  );
  await assert.rejects(
    readHistoryFiles([
      file("account.zip", zipSync({ "Account_data.json": strToU8("secret") })),
    ]),
    /Keine Audio/,
  );
  await assert.rejects(
    readHistoryFiles([
      {
        ...file("large.zip", new Uint8Array()),
        size: HISTORY_LIMITS.input + 1,
      },
    ]),
    /100 MB/,
  );
  const tooMany = Object.fromEntries(
    Array.from({ length: 65 }, (_, i) => [
      "Streaming_History_Audio_2026_" + i + ".json",
      strToU8("[]"),
    ]),
  );
  await assert.rejects(
    readHistoryFiles([file("many.zip", zipSync(tooMany))]),
    /zu groß/,
  );
});
