export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url");
  let url: URL;
  try {
    url = new URL(raw || "");
  } catch {
    return new Response(null, { status: 400 });
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "s1.ticketm.net" ||
    url.port ||
    url.username ||
    url.password
  )
    return new Response(null, { status: 400 });
  try {
    const r = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(12000),
    });
    const type = r.headers.get("content-type") || "";
    if (
      !r.ok ||
      !/^image\/(jpeg|png|webp|gif)$/.test(type.split(";")[0]) ||
      Number(r.headers.get("content-length")) > 3000000
    )
      return new Response(null, { status: 404 });
    const body = await r.arrayBuffer();
    if (body.byteLength > 3000000) return new Response(null, { status: 413 });
    return new Response(body, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
      },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}
