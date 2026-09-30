import { env } from "cloudflare:workers";
import { z } from "zod";
import type { Group, Member } from "./types";
export function db() {
  if (!env.DB)
    throw new ApiError(
      "Der Gruppenspeicher ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal.",
      503,
    );
  return env.DB;
}
export function config(name: string): string {
  return (
    (env as unknown as Record<string, string>)[name] || process.env[name] || ""
  );
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const uuid = () => crypto.randomUUID();
export function token() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
export async function hash(value: string) {
  const b = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(b), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}
export function cookie(request: Request, name: string) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(name + "="))
    ?.slice(name.length + 1);
}
export type Context = { owner: string; request: Request };
export async function api(
  request: Request,
  handler: (ctx: Context) => Promise<unknown>,
) {
  const existing = cookie(request, "cm_session");
  const session =
    existing && /^[a-f0-9]{64}$/.test(existing) ? existing : token();
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  if (session !== existing)
    headers.append(
      "Set-Cookie",
      "cm_session=" +
        session +
        "; HttpOnly; SameSite=Lax; Path=/; Max-Age=15552000" +
        (new URL(request.url).protocol === "https:" ? "; Secure" : ""),
    );
  try {
    if (!["GET", "HEAD"].includes(request.method)) {
      const origin = request.headers.get("origin");
      const target = new URL(request.url).origin;
      if (!origin || (origin !== target && origin !== config("APP_ORIGIN")))
        throw new ApiError("Diese Anfrage stammt nicht von ConcertMatch.", 403);
      const length = Number(request.headers.get("content-length") || 0);
      if (length > 65536) throw new ApiError("Die Eingabe ist zu groß.", 413);
    }
    const owner = await hash(session);
    return new Response(JSON.stringify(await handler({ owner, request })), {
      headers,
    });
  } catch (error) {
    const known = error instanceof ApiError || error instanceof z.ZodError;
    if (!known)
      console.error(
        "ConcertMatch request failed",
        error instanceof Error ? error.name : "unknown",
      );
    const status =
      error instanceof ApiError
        ? error.status
        : error instanceof z.ZodError
          ? 400
          : 503;
    if (status === 429) headers.set("Retry-After", "60");
    return new Response(
      JSON.stringify({
        error: known
          ? error instanceof z.ZodError
            ? "Bitte prüfe deine Angaben."
            : (error as Error).message
          : "Gerade klappt es nicht. Deine Eingabe bleibt erhalten. Bitte erneut versuchen.",
      }),
      { status, headers },
    );
  }
}
export async function body(request: Request) {
  const raw = await request.text();
  if (raw.length > 65536) throw new ApiError("Die Eingabe ist zu groß.", 413);
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new ApiError("Die Anfrage ist ungültig.");
    return value;
  } catch {
    throw new ApiError("Die Anfrage ist ungültig.");
  }
}
export async function rate(
  ctx: Context,
  key: string,
  limit = 60,
  seconds = 60,
) {
  const now = Math.floor(Date.now() / 1000);
  const window = Math.floor(now / seconds);
  const identity = ctx.request.headers.get("cf-connecting-ip") || ctx.owner;
  const k = key + ":" + (await hash(identity)) + ":" + window;
  const row = await db()
    .prepare(
      "INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
    )
    .bind(k, now + seconds)
    .first<{ count: number }>();
  if (row && row.count > limit)
    throw new ApiError(
      "Kurz durchatmen: zu viele Anfragen. Bitte später erneut versuchen.",
      429,
    );
}
export async function clean() {
  const now = Date.now();
  await db().batch([
    db().prepare("DELETE FROM groups WHERE expires_at < ?").bind(now),
    db()
      .prepare("DELETE FROM rate_limits WHERE expires_at < ?")
      .bind(Math.floor(now / 1000)),
    db().prepare("DELETE FROM oauth WHERE expires_at < ?").bind(now),
    db().prepare("DELETE FROM cache WHERE expires_at < ?").bind(now),
  ]);
}
type GroupRow = {
  id: string;
  name: string;
  owner: string;
  preferences: string;
  expires_at: number;
  invite_hash: string;
};
export async function groupRow(id: string, owner: string) {
  if (!/^[a-f0-9-]{36}$/.test(id))
    throw new ApiError("Diese Gruppe wurde nicht gefunden.", 404);
  const g = await db()
    .prepare(
      "SELECT * FROM groups WHERE id=? AND expires_at>? AND (owner=? OR EXISTS (SELECT 1 FROM members WHERE group_id=groups.id AND owner=?))",
    )
    .bind(id, Date.now(), owner, owner)
    .first<GroupRow>();
  if (!g)
    throw new ApiError(
      "Diese Gruppe ist abgelaufen oder du brauchst einen Einladungslink.",
      404,
    );
  return g;
}
export async function loadGroup(id: string, owner: string): Promise<Group> {
  const g = await groupRow(id, owner);
  const [m, s, v] = await Promise.all([
    db()
      .prepare("SELECT * FROM members WHERE group_id=? ORDER BY created_at,id")
      .bind(id)
      .all<{
        id: string;
        owner: string;
        name: string;
        artists: string;
        genres: string;
      }>(),
    db()
      .prepare(
        "SELECT data FROM saved WHERE group_id=? ORDER BY created_at DESC",
      )
      .bind(id)
      .all<{ data: string }>(),
    db()
      .prepare(
        "SELECT event_id as eventId,member_id as memberId,value FROM votes WHERE group_id=?",
      )
      .bind(id)
      .all(),
  ]);
  return {
    id: g.id,
    name: g.name,
    owner: g.owner === owner,
    preferences: JSON.parse(g.preferences),
    expiresAt: g.expires_at,
    members: m.results.map(
      (x) =>
        ({
          id: x.id,
          name: x.name,
          artists: JSON.parse(x.artists),
          genres: JSON.parse(x.genres),
          mine: x.owner === owner,
        }) as Member,
    ),
    saved: s.results.map((x) => JSON.parse(x.data)),
    votes: v.results as Group["votes"],
  };
}
export const artistSchema = z.object({
  mbid: z.string().uuid().optional(),
  aliases: z.array(z.string().max(100)).max(12).optional(),
  description: z.string().max(180).optional(),
  listeners: z.number().int().nonnegative().optional(),
  id: z.string().min(1).max(150),
  name: z.string().trim().min(1).max(100),
  genres: z.array(z.string().max(60)).max(12),
  url: z.string().url().max(500).optional(),
});
export const profileSchema = z.object({
  name: z.string().trim().min(1).max(40),
  artists: z.array(artistSchema).min(1).max(50),
  genres: z.array(z.string().max(60)).max(12),
});
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !Number.isNaN(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s,
  );
export const preferencesSchema = z
  .object({
    city: z.string().trim().min(1).max(80),
    lat: z.number().min(47).max(55.2),
    lng: z.number().min(5.5).max(15.5),
    radius: z.number().int().min(10).max(1000),
    from: isoDate,
    to: isoDate,
    budget: z.number().int().min(0).max(500),
    discovery: z.boolean(),
  })
  .refine(
    (x) =>
      x.from <= x.to && Date.parse(x.to) - Date.parse(x.from) <= 366 * 86400000,
    "Bitte einen Zeitraum von höchstens einem Jahr auswählen.",
  );
export async function cached<T>(key: string): Promise<T | null> {
  const row = await db()
    .prepare("SELECT data FROM cache WHERE key=? AND expires_at>?")
    .bind(key, Date.now())
    .first<{ data: string }>();
  return row ? JSON.parse(row.data) : null;
}
export async function putCache(
  key: string,
  data: unknown,
  ttl = 15 * 60 * 1000,
) {
  await db()
    .prepare(
      "INSERT INTO cache(key,data,expires_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data,expires_at=excluded.expires_at",
    )
    .bind(key, JSON.stringify(data), Date.now() + ttl)
    .run();
}
