import {
  api,
  body,
  db,
  groupRow,
  hash,
  loadGroup,
  preferencesSchema,
  profileSchema,
  rate,
  token,
  uuid,
  ApiError,
} from "@/lib/server";
import { z } from "zod";
import { findConcert } from "@/lib/ticketmaster";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return api(request, async (ctx) => {
    await rate(ctx, "group", 90);
    return { group: await loadGroup(id, ctx.owner) };
  });
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return api(request, async (ctx) => {
    await rate(ctx, "group-write", 45);
    const g = await groupRow(id, ctx.owner);
    const input = await body(request);
    switch (input.action) {
      case "selection": {
        const selected = z
          .object({
            profiles: z
              .array(
                z.object({
                  memberId: z.string().uuid(),
                  profile: profileSchema,
                }),
              )
              .min(1)
              .max(8)
              .refine(
                (ps) => new Set(ps.map((p) => p.memberId)).size === ps.length,
              ),
            preferences: preferencesSchema,
          })
          .parse(input);
        const owned = await db()
          .prepare("SELECT id FROM members WHERE group_id=? AND owner=?")
          .bind(id, ctx.owner)
          .all<{ id: string }>();
        const ids = new Set(owned.results.map((m) => m.id));
        if (selected.profiles.some((p) => !ids.has(p.memberId)))
          throw new ApiError("Du kannst nur eigene Profile bearbeiten.", 403);
        // One transaction preserves group/member identities, invitations, saves and votes.
        await db().batch([
          ...selected.profiles.map(({ memberId, profile: p }) =>
            db()
              .prepare(
                "UPDATE members SET name=?,artists=?,genres=? WHERE id=? AND group_id=? AND owner=?",
              )
              .bind(
                p.name,
                JSON.stringify(p.artists),
                JSON.stringify(p.genres),
                memberId,
                id,
                ctx.owner,
              ),
          ),
          db()
            .prepare("UPDATE groups SET preferences=? WHERE id=?")
            .bind(JSON.stringify(selected.preferences), id),
          db()
            .prepare("DELETE FROM cache WHERE instr(key,?)=1")
            .bind("recommendations:" + id + ":"),
        ]);
        break;
      }
      case "profile": {
        const p = profileSchema.parse(input.profile);
        const memberId = z.string().uuid().parse(input.memberId);
        const result = await db()
          .prepare(
            "UPDATE members SET name=?,artists=?,genres=? WHERE id=? AND group_id=? AND owner=?",
          )
          .bind(
            p.name,
            JSON.stringify(p.artists),
            JSON.stringify(p.genres),
            memberId,
            id,
            ctx.owner,
          )
          .run();
        if (!result.meta.changes)
          throw new ApiError("Du kannst nur eigene Profile bearbeiten.", 403);
        break;
      }
      case "add": {
        const p = profileSchema.parse(input.profile);
        const result = await db()
          .prepare(
            "INSERT INTO members(id,group_id,owner,name,artists,genres,created_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT count(*) FROM members WHERE group_id=?)<8",
          )
          .bind(
            uuid(),
            id,
            ctx.owner,
            p.name,
            JSON.stringify(p.artists),
            JSON.stringify(p.genres),
            Date.now(),
            id,
          )
          .run();
        if (!result.meta.changes)
          throw new ApiError("In einer Gruppe ist Platz für acht Personen.");
        break;
      }
      case "remove": {
        const memberId = z.string().uuid().parse(input.memberId);
        const count = await db()
          .prepare(
            "SELECT count(*) as n FROM members WHERE group_id=? AND owner=?",
          )
          .bind(id, ctx.owner)
          .first<{ n: number }>();
        if (g.owner === ctx.owner && count?.n === 1)
          throw new ApiError(
            "Dein letztes Profil bleibt in der Gruppe. Du kannst die gesamte Gruppe löschen.",
          );
        const r = await db()
          .prepare("DELETE FROM members WHERE id=? AND group_id=? AND owner=?")
          .bind(memberId, id, ctx.owner)
          .run();
        if (!r.meta.changes)
          throw new ApiError("Du kannst nur eigene Profile entfernen.", 403);
        const remaining = await db()
          .prepare("SELECT id FROM members WHERE group_id=? AND owner=?")
          .bind(id, ctx.owner)
          .first();
        await db()
          .prepare("DELETE FROM cache WHERE instr(key,?)=1")
          .bind("recommendations:" + id + ":")
          .run();
        if (!remaining && g.owner !== ctx.owner) return { left: true };
        break;
      }
      case "preferences": {
        const p = preferencesSchema.parse(input.preferences);
        await db()
          .prepare("UPDATE groups SET preferences=? WHERE id=?")
          .bind(JSON.stringify(p), id)
          .run();
        break;
      }
      case "save": {
        const eventId = z.string().min(1).max(100).parse(input.eventId);
        const exists = await db()
          .prepare("SELECT event_id FROM saved WHERE group_id=? AND event_id=?")
          .bind(id, eventId)
          .first();
        if (exists) {
          await db().batch([
            db()
              .prepare("DELETE FROM votes WHERE group_id=? AND event_id=?")
              .bind(id, eventId),
            db()
              .prepare("DELETE FROM saved WHERE group_id=? AND event_id=?")
              .bind(id, eventId),
          ]);
        } else {
          const count = await db()
            .prepare("SELECT count(*) as n FROM saved WHERE group_id=?")
            .bind(id)
            .first<{ n: number }>();
          if (count && count.n >= 50)
            throw new ApiError("Eure Merkliste hat Platz für 50 Konzerte.");
          const concert = await findConcert(eventId);
          await db()
            .prepare(
              "INSERT OR IGNORE INTO saved(group_id,event_id,data,created_at) VALUES(?,?,?,?)",
            )
            .bind(id, eventId, JSON.stringify(concert), Date.now())
            .run();
        }
        break;
      }
      case "vote": {
        const v = z
          .object({
            eventId: z.string().min(1).max(100),
            memberId: z.string().uuid(),
            value: z.enum(["yes", "maybe", "no"]),
          })
          .parse(input);
        const owns = await db()
          .prepare(
            "SELECT id FROM members WHERE id=? AND group_id=? AND owner=?",
          )
          .bind(v.memberId, id, ctx.owner)
          .first();
        if (!owns)
          throw new ApiError(
            "Du kannst nur für eigene Profile abstimmen.",
            403,
          );
        const saved = await db()
          .prepare("SELECT event_id FROM saved WHERE group_id=? AND event_id=?")
          .bind(id, v.eventId)
          .first();
        if (!saved) throw new ApiError("Merkt euch das Konzert zuerst.");
        await db()
          .prepare(
            "INSERT INTO votes(group_id,event_id,member_id,value) VALUES(?,?,?,?) ON CONFLICT(group_id,event_id,member_id) DO UPDATE SET value=excluded.value",
          )
          .bind(id, v.eventId, v.memberId, v.value)
          .run();
        break;
      }
      case "invite": {
        if (g.owner !== ctx.owner)
          throw new ApiError(
            "Nur die Person, die die Gruppe erstellt hat, kann Einladungen erneuern.",
            403,
          );
        const invite = token();
        await db()
          .prepare("UPDATE groups SET invite_hash=? WHERE id=?")
          .bind(await hash(invite), id)
          .run();
        return { group: await loadGroup(id, ctx.owner), invite };
      }
      case "delete": {
        if (g.owner !== ctx.owner)
          throw new ApiError(
            "Nur die erstellende Person kann diese Gruppe löschen.",
            403,
          );
        await db().batch([
          db()
            .prepare("DELETE FROM cache WHERE instr(key,?)=1")
            .bind("recommendations:" + id + ":"),
          db().prepare("DELETE FROM groups WHERE id=?").bind(id),
        ]);
        return { deleted: true };
      }
      default:
        throw new ApiError("Unbekannte Aktion.");
    }
    return { group: await loadGroup(id, ctx.owner) };
  });
}
