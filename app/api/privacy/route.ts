import { api, db, loadGroup, rate } from "@/lib/server";
export async function GET(request: Request) {
  return api(request, async (ctx) => {
    await rate(ctx, "privacy", 10);
    const rows = await db()
      .prepare("SELECT DISTINCT group_id as id FROM members WHERE owner=?")
      .bind(ctx.owner)
      .all<{ id: string }>();
    const groups = await Promise.all(
      rows.results.map((r) => loadGroup(r.id, ctx.owner)),
    );
    return {
      exportedAt: new Date().toISOString(),
      profiles: groups.map((g) => ({
        group: g.name,
        members: g.members.filter((m) => m.mine),
        votes: g.votes.filter((v) =>
          g.members.some((m) => m.mine && m.id === v.memberId),
        ),
      })),
    };
  });
}
export async function DELETE(request: Request) {
  return api(request, async (ctx) => {
    await rate(ctx, "privacy-write", 5);
    await db().batch([
      db().prepare("DELETE FROM groups WHERE owner=?").bind(ctx.owner),
      db().prepare("DELETE FROM members WHERE owner=?").bind(ctx.owner),
      db().prepare("DELETE FROM oauth WHERE owner=?").bind(ctx.owner),
    ]);
    return { deleted: true };
  });
}
