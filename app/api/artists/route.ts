import { api, rate } from "@/lib/server";
import { searchArtists } from "@/lib/ticketmaster";
export async function GET(request: Request) {
  return api(request, async (ctx) => {
    await rate(ctx, "artists", 30);
    const q =
      new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) || "";
    return { artists: q.length >= 2 ? await searchArtists(q) : [] };
  });
}
