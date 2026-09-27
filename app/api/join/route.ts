import {
  api,
  body,
  db,
  hash,
  loadGroup,
  profileSchema,
  rate,
  uuid,
  ApiError,
} from "@/lib/server";
import { z } from "zod";
export async function POST(request: Request) {
  return api(request, async (ctx) => {
    await rate(ctx, "join", 20, 3600);
    const input = z
      .object({
        groupId: z.string().uuid(),
        invite: z.string().regex(/^[a-f0-9]{64}$/),
        profile: profileSchema,
      })
      .parse(await body(request));
    const g = await db()
      .prepare(
        "SELECT id FROM groups WHERE id=? AND invite_hash=? AND expires_at>?",
      )
      .bind(input.groupId, await hash(input.invite), Date.now())
      .first();
    if (!g)
      throw new ApiError(
        "Dieser Einladungslink ist abgelaufen oder wurde erneuert.",
        404,
      );
    const existing = await db()
      .prepare("SELECT id FROM members WHERE group_id=? AND owner=?")
      .bind(input.groupId, ctx.owner)
      .first();
    if (!existing) {
      const p = input.profile;
      const r = await db()
        .prepare(
          "INSERT INTO members(id,group_id,owner,name,artists,genres,created_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT count(*) FROM members WHERE group_id=?)<8",
        )
        .bind(
          uuid(),
          input.groupId,
          ctx.owner,
          p.name,
          JSON.stringify(p.artists),
          JSON.stringify(p.genres),
          Date.now(),
          input.groupId,
        )
        .run();
      if (!r.meta.changes)
        throw new ApiError("Diese Gruppe ist schon voll (acht Personen).");
    }
    return { group: await loadGroup(input.groupId, ctx.owner) };
  });
}
