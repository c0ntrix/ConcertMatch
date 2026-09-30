export type Artist = {
  id: string;
  name: string;
  genres: string[];
  url?: string;
  mbid?: string;
  aliases?: string[];
  description?: string;
  listeners?: number;
};
export type Member = {
  id: string;
  name: string;
  artists: Artist[];
  genres: string[];
  mine?: boolean;
};
export type Concert = {
  id: string;
  title: string;
  artists: Artist[];
  date: string;
  time?: string;
  venue: string;
  city: string;
  lat: number;
  lng: number;
  url: string;
  image?: string;
  price?: number;
  currency?: string;
  genres: string[];
  source: string;
  checkedAt: string;
  status: string;
  providerRank?: number;
};
export type Preferences = {
  city: string;
  lat: number;
  lng: number;
  radius: number;
  from: string;
  to: string;
  budget: number;
  discovery: boolean;
};
export type Vote = {
  eventId: string;
  memberId: string;
  value: "yes" | "maybe" | "no";
};
export type Group = {
  id: string;
  name: string;
  owner: boolean;
  members: Member[];
  preferences: Preferences;
  saved: Concert[];
  votes: Vote[];
  expiresAt: number;
};
export type Match = {
  concert: Concert;
  score: number;
  distance: number;
  discovery: boolean;
  members: { id: string; name: string; score: number; reason: string }[];
};
export type Recommendations = Record<
  string,
  {
    scores: Record<string, number>;
    reason: string;
    confidence: "high" | "medium" | "low";
  }
>;
