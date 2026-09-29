import { api, rate } from "@/lib/server";
import { searchMusic } from "@/lib/music-catalog";
export async function GET(request: Request) {
  return api(request, async (ctx) => {
    await rate(ctx, "artists", 45);
    const q =
      new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) || "";
    return q.length >= 2 ? searchMusic(q) : { artists: [] };
  });
}
