import {
  inferenceCharge,
  INFERENCE_RESERVATION,
  INFERENCE_DAILY_LIMIT,
  type InferenceUsage,
} from "./ai-budget";
import { ZodError } from "zod";
import { env } from "cloudflare:workers";
import { db, cached, hash } from "./server";
import {
  MODEL,
  recommendationSystem,
  recommendationInput,
  parseRecommendations,
  mapRecommendations,
  RecommendationValidationError,
} from "./recommendations";
import type { Artist, Concert, Group, RecommendationDebug } from "./types";

const fallback = {
  mode: "genres" as const,
  notice:
    "Erweiterte KI-Suche ist momentan deaktiviert. Die Ergebnisse beruhen auf Favoriten und Genres.",
};
type CachedAssessment = {
  rows: ReturnType<typeof parseRecommendations>;
  output: string;
  usage?: InferenceUsage;
};
function displayOutput(raw: unknown) {
  const text = typeof raw === "string" ? raw : JSON.stringify(raw);
  return text === undefined ? undefined : text.slice(0, 24000);
}
export async function recommendConcerts(
  group: Group,
  events: Concert[],
  artistMetadata: Artist[] = [],
) {
  const started = Date.now();
  const input = recommendationInput(
    events,
    group.members,
    group.preferences,
    artistMetadata,
  );
  const debug: RecommendationDebug = {
    status: "no-candidates",
    model: MODEL,
    candidateCount: input.lineups.length,
    input: input.content,
  };
  const diagnostics = () => ({ ...debug, durationMs: Date.now() - started });
  const unavailable = (status: RecommendationDebug["status"]) => {
    debug.status = status;
    return { ...fallback, debug: diagnostics() };
  };
  if (!input.lineups.length)
    return {
      mode: "genres" as const,
      notice: "Keine geeigneten Kandidaten für den KI-Abgleich.",
      debug: diagnostics(),
    };
  const key =
    `recommendations:${group.id}:` + (await hash("v4:" + input.content));
  // Keep the existing key and accept legacy row-only entries to avoid spending
  // inference budget again just because debugging has been added.
  const hit = await cached<
    CachedAssessment | ReturnType<typeof parseRecommendations>
  >(key);
  if (hit) {
    const legacy = Array.isArray(hit);
    const rows = parseRecommendations(
      { recommendations: legacy ? hit : hit.rows },
      input,
    );
    debug.status = "cache";
    debug.assessedCount = rows.length;
    debug.output = legacy
      ? JSON.stringify({ recommendations: rows })
      : hit.output;
    debug.outputSource = legacy ? "validated-cache" : "raw";
    debug.usage = legacy ? undefined : hit.usage;
    return {
      mode: "ai" as const,
      recommendations: mapRecommendations(rows, input, group.members),
      notice: "",
      debug: diagnostics(),
    };
  }
  if (!env.AI) return unavailable("missing-binding");
  const now = Date.now();
  const leaseKey = "ai:lease:" + (await hash(key));
  const lease = await db()
    .prepare(
      "INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET expires_at=excluded.expires_at WHERE rate_limits.expires_at<? RETURNING count",
    )
    .bind(leaseKey, Math.ceil(now / 1000) + 60, Math.floor(now / 1000))
    .first();
  if (!lease) return unavailable("in-progress");
  // At most 15 KB data + system prompt, 3000 output tokens. Reserve well above
  // that model's worst-case token charge; refund only when usage is reported.
  const reservation = INFERENCE_RESERVATION;
  const day = Math.floor(now / 86400000);
  const dayKey = "ai:day:" + day;
  const budget = await db()
    .prepare(
      "INSERT INTO rate_limits(key,count,expires_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET count=count+excluded.count WHERE rate_limits.count+excluded.count<=? RETURNING count",
    )
    .bind(dayKey, reservation, (day + 1) * 86400, INFERENCE_DAILY_LIMIT)
    .first<{ count: number }>();
  debug.budget = {
    used:
      budget?.count ??
      (
        await db()
          .prepare("SELECT count FROM rate_limits WHERE key=?")
          .bind(dayKey)
          .first<{ count: number }>()
      )?.count ??
      0,
    limit: INFERENCE_DAILY_LIMIT,
    reservation,
    resetsAt: new Date((day + 1) * 86400000).toISOString(),
  };
  if (!budget) {
    await db()
      .prepare("DELETE FROM rate_limits WHERE key=?")
      .bind(leaseKey)
      .run();
    return unavailable("budget-exhausted");
  }
  let phase: "provider-error" | "invalid-output" | "storage-error" =
    "provider-error";
  try {
    const output = await env.AI.run(
      MODEL,
      {
        messages: [
          { role: "system", content: recommendationSystem(input.memberCount) },
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
    debug.output = displayOutput(envelope.response);
    debug.outputSource = "raw";
    // Only expose usage fields, never the provider envelope or headers.
    if (envelope.usage)
      debug.usage = {
        neurons: envelope.usage.neurons,
        prompt_tokens: envelope.usage.prompt_tokens,
        completion_tokens: envelope.usage.completion_tokens,
      };
    const charge = inferenceCharge(envelope.usage);
    phase = "storage-error";
    if (charge < reservation) {
      await db()
        .prepare("UPDATE rate_limits SET count=max(0,count-?) WHERE key=?")
        .bind(reservation - charge, dayKey)
        .run();
      debug.budget.used -= reservation - charge;
    }
    phase = "invalid-output";
    const rows = parseRecommendations(envelope.response, input);
    debug.assessedCount = rows.length;
    phase = "storage-error";
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
        JSON.stringify({ rows, output: debug.output, usage: debug.usage }),
        now + 24 * 3600000,
        group.id,
        ...snapshot.flat(),
      )
      .run();
    debug.status = "live";
    return {
      mode: "ai" as const,
      recommendations: mapRecommendations(rows, input, group.members),
      notice: "",
      debug: diagnostics(),
    };
  } catch (error) {
    debug.error =
      error instanceof RecommendationValidationError
        ? error.message
        : error instanceof ZodError
          ? JSON.stringify(
              error.issues.map((i) => ({ code: i.code, path: i.path })),
            )
          : error instanceof Error
            ? error.name
            : "unknown";
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
    return unavailable(phase);
  } finally {
    await db()
      .prepare("DELETE FROM rate_limits WHERE key=?")
      .bind(leaseKey)
      .run();
  }
}
