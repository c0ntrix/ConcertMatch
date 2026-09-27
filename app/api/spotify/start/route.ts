import { config, cookie, db, hash, rate, token } from "@/lib/server";
export async function GET(request: Request) {
  const origin = config("APP_ORIGIN");
  const client = config("SPOTIFY_CLIENT_ID"),
    redirect = config("SPOTIFY_REDIRECT_URI"),
    session = cookie(request, "cm_session");
  if (
    !origin ||
    !client ||
    !redirect ||
    !session ||
    !/^[a-f0-9]{64}$/.test(session)
  )
    return new Response(null, {
      status: 303,
      headers: { Location: "/?spotify=error", "Cache-Control": "no-store" },
    });
  try {
    const owner = await hash(session);
    await rate({ owner, request }, "spotify", 8, 3600);
    const state = token(),
      verifier = token();
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(verifier),
    );
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    await db()
      .prepare(
        "INSERT INTO oauth(state,owner,verifier,expires_at) VALUES(?,?,?,?)",
      )
      .bind(await hash(state), owner, verifier, Date.now() + 600000)
      .run();
    const url = new URL("https://accounts.spotify.com/authorize");
    url.search = new URLSearchParams({
      response_type: "code",
      client_id: client,
      scope: "user-top-read",
      redirect_uri: redirect,
      state,
      code_challenge_method: "S256",
      code_challenge: challenge,
    }).toString();
    return new Response(null, {
      status: 303,
      headers: {
        Location: url.toString(),
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return new Response(null, {
      status: 303,
      headers: { Location: "/?spotify=error", "Cache-Control": "no-store" },
    });
  }
}
