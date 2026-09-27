import {
  api,
  body,
  db,
  hash,
  loadGroup,
  preferencesSchema,
  profileSchema,
  rate,
  token,
  uuid,
  ApiError,
} from "@/lib/server";
import { defaultPreferences } from "@/lib/catalog";
import { z } from "zod";
export async function POST(request: Request) {
  return api(request, async (ctx) => {
    await rate(ctx, "create-group", 8, 3600);
    const input = z
      .object({
        name: z.string().trim().min(1).max(60),
        profiles: z.array(profileSchema).min(1).max(8),
        preferences: preferencesSchema.optional(),
      })
      .parse(await body(request));
    const count = await db()
      .prepare("SELECT count(*) as count FROM groups WHERE owner=?")
      .bind(ctx.owner)
      .first<{ count: number }>();
    if (count && count.count >= 20)
      throw new ApiError(
        "Du kannst bis zu 20 Gruppen anlegen. Lösche zuerst eine alte Gruppe.",
      );
    const id = uuid(),
      invite = token(),
      now = Date.now();
    await db().batch([
      db()
        .prepare(
          "INSERT INTO groups(id,name,owner,invite_hash,preferences,created_at,expires_at) VALUES(?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          input.name,
          ctx.owner,
          await hash(invite),
          JSON.stringify(input.preferences || defaultPreferences()),
          now,
          now + 90 * 86400000,
        ),
      ...input.profiles.map((p, i) =>
        db()
          .prepare(
            "INSERT INTO members(id,group_id,owner,name,artists,genres,created_at) VALUES(?,?,?,?,?,?,?)",
          )
          .bind(
            uuid(),
            id,
            ctx.owner,
            p.name,
            JSON.stringify(p.artists),
            JSON.stringify(p.genres),
            now + i,
          ),
      ),
    ]);
    return { group: await loadGroup(id, ctx.owner), invite };
  });
}
