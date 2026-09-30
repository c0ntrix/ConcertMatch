import { api, body, loadGroup, rate } from "@/lib/server";
import { searchConcerts } from "@/lib/ticketmaster";
import { recommendConcerts } from "@/lib/ai-matching";
import { z } from "zod";
export async function POST(request: Request) {
  return api(request, async (ctx) => {
    await rate(ctx, "recommendations", 6);
    const { groupId } = z
      .object({ groupId: z.string().uuid() })
      .parse(await body(request));
    const group = await loadGroup(groupId, ctx.owner);
    const data = await searchConcerts(group.preferences, group.members, false);
    return recommendConcerts(group, data.events, data.artistMetadata);
  });
}
