import test from "node:test";
import assert from "node:assert/strict";
import {
  affinity,
  distanceLabel,
  matchConcert,
  rankConcerts,
  sameArtist,
  deduplicateConcerts,
} from "../lib/matching";
import { defaultPreferences, normalize } from "../lib/catalog";
import { parseArtistList } from "../lib/artist-list";
import type { Artist, Concert, Member } from "../lib/types";
const artist = (name: string, genres: string[], listeners = 0): Artist => ({
  id: name,
  name,
  genres,
  listeners,
});
const juice = artist("Juice WRLD", ["hip hop", "emo rap", "trap"]);
const peep = artist("Lil Peep", ["hip hop", "emo rap", "cloud rap"]);
const members: Member[] = [juice, peep].map((a, i) => ({
  id: String(i),
  name: String(i),
  artists: [a],
  genres: [],
}));
const p = defaultPreferences();
const concert = (a: Artist, overrides: Partial<Concert> = {}): Concert => ({
  id: a.id,
  title: a.name,
  artists: [a],
  genres: a.genres,
  date: p.to,
  venue: "Club",
  city: p.city,
  lat: p.lat,
  lng: p.lng,
  status: "onsale",
  source: "Test",
  checkedAt: "",
  url: "https://example.com/",
  ...overrides,
});

test("emo-rap overlap outranks generic hip-hop even with a large audience", () => {
  const small = concert(artist("Small emo act", ["emo rap", "hip hop"], 20));
  const big = concert(
    artist("Big old-school act", ["old school hip hop", "hip hop"], 100000),
  );
  assert.equal(rankConcerts([big, small], members, p)[0].concert.id, small.id);
  assert.ok(
    affinity(members[0], small).score > affinity(members[0], big).score + 20,
  );
});
test("better-known acts lead equally suitable small events, regardless of distance", () => {
  const small = concert(artist("Small", ["hip hop"], 10));
  const big = concert(artist("Big", ["hip hop"], 50000), { lat: p.lat + 0.2 });
  assert.equal(rankConcerts([small, big], members, p)[0].concert.id, big.id);
});
test("a shared small favorite beats a famous inferred recommendation", () => {
  const favorite = artist("Our local band", ["emo rap"], 5);
  const profiles = members.map((m) => ({
    ...m,
    artists: [...m.artists, favorite],
  }));
  const big = concert(artist("Famous", ["emo rap"], 500000));
  assert.equal(
    rankConcerts([big, concert(favorite)], profiles, p)[0].concert.id,
    favorite.id,
  );
});
test("unrelated famous concerts and empty profiles do not create matches", () => {
  const classical = concert(artist("Famous orchestra", ["classical"], 100000));
  assert.deepEqual(rankConcerts([classical], members, p), []);
  assert.deepEqual(rankConcerts([concert(juice)], [], p), []);
});
test("distinct artists with the same name retain their catalogue identity", () => {
  assert.equal(
    sameArtist(
      { ...juice, id: "mb:a", mbid: "a" },
      { ...juice, id: "mb:b", mbid: "b" },
    ),
    false,
  );
  assert.equal(
    sameArtist(
      { ...juice, aliases: ["JuiceTheKidd"] },
      artist("JuiceTheKidd", []),
    ),
    true,
  );
  assert.equal(
    sameArtist(artist("宇多田ヒカル", []), artist("周杰倫", [])),
    false,
  );
  assert.notEqual(normalize("宇多田ヒカル"), "");
});
test("duplicate offers and standalone upgrades do not crowd the results", () => {
  const show = concert(juice);
  assert.deepEqual(
    deduplicateConcerts([
      show,
      { ...show, id: "duplicate" },
      { ...show, id: "vip", title: "Juice WRLD VIP Package" },
    ]).map((c) => c.id),
    [show.id],
  );
  assert.equal(
    deduplicateConcerts([show, { ...show, id: "late-show", time: "22:00:00" }])
      .length,
    2,
  );
});
test("bulk entry preserves commas in artist names and removes numbering and duplicates", () => {
  const list = parseArtistList(
    "1. Juice WRLD\n2. Lil Peep\n3. Tyler, The Creator\nJuice wrld",
  );
  assert.equal(list.length, 3);
  assert.equal(list[2].name, "Tyler, The Creator");
  assert.throws(
    () => parseArtistList("https://open.spotify.com/artist/123"),
    /Künstlernamen/,
  );
});
test("a peripheral hip-hop tag on a pop act does not become a rap recommendation", () => {
  const pop = concert(
    artist("Pop act", ["pop", "dance pop", "dance", "hip hop"], 100000),
  );
  assert.deepEqual(rankConcerts([pop], members, p), []);
  const providerOnly = concert(artist("Generic rap", ["Hip-Hop/Rap"]));
  const imported = [
    { ...members[0], artists: [artist("Imported favorite", ["Hip-Hop/Rap"])] },
  ];
  assert.ok(rankConcerts([providerOnly], imported, p)[0].score <= 40);
});
test("an unavailable duplicate does not hide a bookable concert", () => {
  const live = concert(juice, { price: 40, currency: "EUR" });
  const bad = { ...live, id: "cancelled", status: "cancelled" };
  assert.equal(
    rankConcerts([bad, live], members, { ...p, budget: 50 })[0].concert.id,
    live.id,
  );
});

test("a support act cannot turn an unrelated headliner into a strong match", () => {
  const main = artist("Dance headliner", ["dance pop", "pop"]);
  const support = artist("Rap support", ["emo rap", "hip hop"]);
  const mixed = concert(main, { artists: [main, support] });
  const rapShow = concert(artist("Rap headliner", ["emo rap", "hip hop"]));
  assert.ok(
    affinity(members[0], mixed).score < affinity(members[0], rapShow).score,
  );
  assert.match(affinity(members[0], mixed).reason, /Support/);
  assert.equal(
    affinity({ ...members[0], artists: [support] }, mixed).score,
    100,
  );
});
test("whole-profile fit outranks a connection to only one peripheral favorite", () => {
  const profile = {
    ...members[0],
    artists: [
      juice,
      peep,
      artist("Rap third", ["hip hop", "trap"]),
      artist("Occasional soul", ["neo soul", "r&b"]),
    ],
  };
  const rap = concert(artist("Rap show", ["hip hop", "emo rap", "trap"]));
  const soul = concert(artist("Soul show", ["neo soul", "r&b"]));
  assert.ok(affinity(profile, rap).score > affinity(profile, soul).score);
});
test("matching across a rock profile uses the whole taste without rapper-specific rules", () => {
  const profile = {
    ...members[0],
    artists: [
      artist("Band A", ["indie rock", "rock"]),
      artist("Band B", ["indie rock", "post punk"]),
      artist("Singer", ["piano pop", "pop"]),
    ],
  };
  assert.ok(
    affinity(profile, concert(artist("Indie show", ["indie rock", "rock"])))
      .score >
      affinity(profile, concert(artist("Piano show", ["piano pop", "pop"])))
        .score,
  );
});
test("plural VIP upgrades without admission are excluded even with a different lineup", () => {
  const show = concert(juice);
  assert.deepEqual(
    deduplicateConcerts([
      show,
      {
        ...show,
        id: "extra",
        title: "World Tour | VIP Upgrades (no ticket included)",
        artists: [juice, peep],
      },
    ]).map((c) => c.id),
    [show.id],
  );
});
test("same-city labels do not imply distance from a personal location", () => {
  const sameCity = matchConcert(
    concert(juice, { lat: p.lat + 0.01 }),
    members,
    p,
  );
  assert.equal(distanceLabel(sameCity, p), "in " + p.city);
  const other = {
    ...sameCity,
    concert: { ...sameCity.concert, city: "Other" },
    distance: 257,
  };
  assert.equal(distanceLabel(other, p), "ca. 257 km Luftlinie");
});
