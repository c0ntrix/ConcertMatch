import { ARTISTS, normalize } from "@/lib/catalog";
import { config, cookie, db, hash, putCache } from "@/lib/server";
import type { Artist } from "@/lib/types";
export async function GET(request: Request) {
  const finish = (status: string) =>
    new Response(null, {
      status: 303,
      headers: {
        Location: "/?spotify=" + status,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  try {
    const url = new URL(request.url),
      state = url.searchParams.get("state"),
      code = url.searchParams.get("code"),
      session = cookie(request, "cm_session");
    if (
      !state ||
      !code ||
      !session ||
      !(/^[a-f0-9]{64}$/.test(state) && /^[a-f0-9]{64}$/.test(session))
    )
      return finish("error");
    const owner = await hash(session);
    // Atomically consume the state so an authorization response cannot be replayed.
    const entry = await db()
      .prepare(
        "DELETE FROM oauth WHERE state=? AND owner=? AND expires_at>? RETURNING verifier",
      )
      .bind(await hash(state), owner, Date.now())
      .first<{ verifier: string }>();
    if (!entry) return finish("error");
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: config("SPOTIFY_CLIENT_ID"),
        redirect_uri: config("SPOTIFY_REDIRECT_URI"),
        code_verifier: entry.verifier,
      }),
    });
    if (!response.ok) return finish("error");
    const access = (await response.json()) as { access_token?: string };
    if (!access.access_token) return finish("error");
    const top = await fetch(
      "https://api.spotify.com/v1/me/top/artists?time_range=medium_term&limit=30",
      {
        headers: { Authorization: "Bearer " + access.access_token },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!top.ok) return finish("error");
    const data = (await top.json()) as {
      items: {
        id: string;
        name: string;
        genres?: string[];
        external_urls?: { spotify: string };
      }[];
    };
    const artists: Artist[] = data.items.map((a) => ({
      id: "spotify:" + a.id,
      name: a.name,
      genres: a.genres?.length
        ? a.genres
        : ARTISTS.find((x) => normalize(x.name) === normalize(a.name))
            ?.genres || [],
      url: a.external_urls?.spotify,
    }));
    // Access and refresh tokens are never persisted. Only the reviewable selection lives for ten minutes.
    await putCache("spotify-import:" + owner, { artists }, 600000);
    return finish("success");
  } catch {
    return finish("error");
  }
}
