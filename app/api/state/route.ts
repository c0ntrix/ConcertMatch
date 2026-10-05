import { api, clean, config, db, loadGroup, rate } from "@/lib/server";
export async function GET(request: Request) {
  return api(request, async (ctx) => {
    await rate(ctx, "state", 90);
    await clean();
    const rows = await db()
      .prepare(
        "SELECT DISTINCT g.id,g.name FROM groups g LEFT JOIN members m ON m.group_id=g.id WHERE (g.owner=? OR m.owner=?) AND g.expires_at>? ORDER BY g.created_at DESC LIMIT 20",
      )
      .bind(ctx.owner, ctx.owner, Date.now())
      .all<{ id: string; name: string }>();
    const requested = new URL(request.url).searchParams.get("group");
    const id =
      requested && rows.results.some((g) => g.id === requested)
        ? requested
        : undefined;
    return {
      groups: rows.results,
      group: id ? await loadGroup(id, ctx.owner) : null,
      providers: {
        ticketmaster: !!config("TICKETMASTER_API_KEY"),
        eventfrog: !!config("EVENTFROG_API_KEY"),
        reservix: !!config("RESERVIX_SYNC_TOKEN"),
        spotify: !!config("SPOTIFY_CLIENT_ID"),
      },
    };
  });
}
