import { api, loadGroup, rate } from "@/lib/server";
import { searchConcerts } from "@/lib/ticketmaster";
export async function GET(request: Request) {
  return api(request, async (ctx) => {
    await rate(ctx, "concerts", 12);
    const id = new URL(request.url).searchParams.get("group") || "";
    const group = await loadGroup(id, ctx.owner);
    return searchConcerts(group.preferences, group.members);
  });
}
