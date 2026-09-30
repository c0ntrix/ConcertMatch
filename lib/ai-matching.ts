import {
  inferenceCharge,
  INFERENCE_RESERVATION,
  type InferenceUsage,
} from "./ai-budget";
import { ZodError } from "zod";
import { env } from "cloudflare:workers";
import { db, cached, hash } from "./server";
import {
  MODEL,
  SYSTEM,
  recommendationInput,
  parseRecommendations,
  mapRecommendations,
} from "./recommendations";
import type { Artist, Concert, Group } from "./types";

const fallback = {
  mode: "genres" as const,
  notice:
    "Die vertiefte Musikeinschätzung ist gerade nicht verfügbar. Die Ergebnisse beruhen vorläufig auf Favoriten und Genres.",
};
export async function recommendConcerts(
  group: Group,
  events: Concert[],
  artistMetadata: Artist[] = [],
) {
  const input = recommendationInput(
    events,
    group.members,
    group.preferences,
    artistMetadata,
  );
  if (!input.lineups.length)
    return { mode: "ai" as const, recommendations: {}, notice: "" };
  const key =
    `recommendations:${group.id}:` + (await hash("v4:" + input.content));
  const hit = await cached<ReturnType<typeof parseRecommendations>>(key);
  if (hit)
    return {
      mode: "ai" as const,
      recommendations: mapRecommendations(
        parseRecommendations({ recommendations: hit }, input),
        input,
        group.members,
      ),
      notice: "",
    };
  if (!env.AI) return fallback;
  const now = Date.now();
  const leaseKey = "ai:lease:" + (await hash(key));
  const lease = await db()
    .prepare(
      "INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET expires_at=excluded.expires_at WHERE rate_limits.expires_at<? RETURNING count",
    )
    .bind(leaseKey, Math.ceil(now / 1000) + 60, Math.floor(now / 1000))
    .first();
  if (!lease) return fallback;
  // At most 15 KB data + system prompt, 3000 output tokens. Reserve well above
  // that model's worst-case token charge; refund only when usage is reported.
  const reservation = INFERENCE_RESERVATION;
  const day = Math.floor(now / 86400000);
  const dayKey = "ai:day:" + day;
  const budget = await db()
    .prepare(
      "INSERT INTO rate_limits(key,count,expires_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET count=count+excluded.count WHERE rate_limits.count+excluded.count<=8000 RETURNING count",
    )
    .bind(dayKey, reservation, (day + 1) * 86400)
    .first();
  if (!budget) {
    await db()
      .prepare("DELETE FROM rate_limits WHERE key=?")
      .bind(leaseKey)
      .run();
    return {
      ...fallback,
      notice:
        "Das Tageskontingent für die vertiefte Musikeinschätzung ist aufgebraucht. Die Ergebnisse verwenden Favoriten und Musikstile. Es wird täglich um 00:00 UTC erneuert.",
    };
  }
  try {
    const output = await env.AI.run(
      MODEL,
      {
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: input.content },
        ],
        max_tokens: 3000,
        temperature: 0.1,
        response_format: { type: "json_object" },
      },
      { signal: AbortSignal.timeout(40000) },
    );
    const envelope = output as {
      response?: unknown;
      usage?: InferenceUsage;
    };
    const charge = inferenceCharge(envelope.usage);
    if (charge < reservation)
      await db()
        .prepare("UPDATE rate_limits SET count=max(0,count-?) WHERE key=?")
        .bind(reservation - charge, dayKey)
        .run();
    const rows = parseRecommendations(envelope.response, input);
    // Store only if this exact set of profiles still exists. This prevents an
    // in-flight response from recreating a cache after profile/data deletion.
    const snapshot = group.members.map((m) => [
      m.id,
      JSON.stringify(m.artists),
      JSON.stringify(m.genres),
    ]);
    const checks = snapshot
      .map(
        () =>
          "EXISTS(SELECT 1 FROM members WHERE id=? AND artists=? AND genres=?)",
      )
      .join(" AND ");
    await db()
      .prepare(
        `INSERT INTO cache(key,data,expires_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM groups WHERE id=?) AND ${checks} ON CONFLICT(key) DO UPDATE SET data=excluded.data,expires_at=excluded.expires_at`,
      )
      .bind(
        key,
        JSON.stringify(rows),
        now + 24 * 3600000,
        group.id,
        ...snapshot.flat(),
      )
      .run();
    return {
      mode: "ai" as const,
      recommendations: mapRecommendations(rows, input, group.members),
      notice: "",
    };
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "recommendation_fallback",
        reason: error instanceof Error ? error.name : "unknown",
        issues:
          error instanceof ZodError
            ? error.issues.map((i) => ({ code: i.code, path: i.path }))
            : undefined,
      }),
    );
    return fallback;
  } finally {
    await db()
      .prepare("DELETE FROM rate_limits WHERE key=?")
      .bind(leaseKey)
      .run();
  }
}
