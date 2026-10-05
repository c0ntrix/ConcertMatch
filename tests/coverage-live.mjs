import assert from "node:assert/strict";
const origin = process.argv[2];
if (!origin?.startsWith("https://") || new URL(origin).origin !== origin)
  throw new Error("Provide the exact HTTPS deployment origin.");
let cookie = "",
  groupId;
async function api(path, body) {
  const response = await fetch(origin + path, {
    method: body ? "POST" : "GET",
    headers: {
      Origin: origin,
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const session = response.headers.get("set-cookie");
  if (session) cookie = session.split(";")[0];
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  return data;
}
try {
  await api("/api/state");
  const from = new Date().toISOString().slice(0, 10);
  const to = new Date(Date.parse(from) + 365 * 86400000)
    .toISOString()
    .slice(0, 10);
  const created = await api("/api/groups", {
    name: "Coverage check " + crypto.randomUUID().slice(0, 8),
    profiles: [
      {
        name: "Test",
        artists: [
          { id: "test-provinz", name: "Provinz", genres: ["Indie", "Pop"] },
        ],
        genres: [],
      },
    ],
    preferences: {
      city: "Berlin",
      lat: 52.52,
      lng: 13.405,
      radius: 1000,
      from,
      to,
      budget: 0,
      discovery: true,
      aiSearch: false,
    },
  });
  groupId = created.group.id;
  const started = Date.now();
  const result = await api("/api/concerts?group=" + groupId);
  assert.ok(result.events.length > 0);
  assert.equal(
    new Set(result.events.map((event) => event.id)).size,
    result.events.length,
  );
  for (const event of result.events) {
    assert.equal(new URL(event.url).protocol, "https:");
    assert.ok(event.date >= from && event.date <= to);
  }
  console.log(
    JSON.stringify({
      origin,
      from,
      to,
      radius: 1000,
      count: result.events.length,
      durationMs: Date.now() - started,
      sources: [...new Set(result.events.map((event) => event.source))],
      notice: result.notice,
    }),
  );
} finally {
  if (groupId) await api("/api/groups/" + groupId, { action: "delete" });
}
