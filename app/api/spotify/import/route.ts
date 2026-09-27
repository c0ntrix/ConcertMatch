import { api, ApiError, db, rate } from "@/lib/server";
export async function GET(request: Request) {
  return api(request, async (ctx) => {
    await rate(ctx, "spotify-import", 10);
    const data = await db()
      .prepare("DELETE FROM cache WHERE key=? AND expires_at>? RETURNING data")
      .bind("spotify-import:" + ctx.owner, Date.now())
      .first<{ data: string }>();
    if (!data)
      throw new ApiError(
        "Der Spotify-Import ist abgelaufen. Bitte erneut verbinden.",
        404,
      );
    return JSON.parse(data.data);
  });
}
