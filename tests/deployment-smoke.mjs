import assert from "node:assert/strict";
const origin = process.argv[2];
if (
  !origin ||
  new URL(origin).origin !== origin ||
  !origin.startsWith("https://")
) {
  throw new Error("Pass the exact HTTPS origin of your deployment.");
}
function client() {
  let cookie = "";
  return async (path, body, method = body ? "POST" : "GET") => {
    const r = await fetch(origin + path, {
      method,
      redirect: "manual",
      headers: {
        Origin: origin,
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const session = r.headers.get("set-cookie");
    if (session) {
      assert.match(session, /HttpOnly/);
      assert.match(session, /Secure/);
      cookie = session.split(";")[0];
    }
    return { status: r.status, data: await r.json() };
  };
}
const owner = client(),
  guest = client(),
  stranger = client();
const artist = {
  id: "catalog:provinz",
  name: "Provinz",
  genres: ["Indie", "Pop"],
};
const profile = (name) => ({ name, artists: [artist], genres: [] });
let groupId;
try {
  for (const path of ["/", "/datenschutz", "/impressum", "/methode"]) {
    const r = await fetch(origin + path, { redirect: "manual" });
    assert.equal(r.status, 200, path);
    assert.match(r.headers.get("content-type"), /text\/html/);
    assert.match(await r.text(), /ConcertMatch/);
  }
  const state = await owner("/api/state");
  assert.equal(state.status, 200);
  assert.equal(state.data.providers.ticketmaster, true);
  const created = await owner("/api/groups", {
    name: "Release check " + crypto.randomUUID().slice(0, 8),
    profiles: [profile("Test Alex"), profile("Test Sam")],
  });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  groupId = created.data.group.id;
  assert.equal((await stranger("/api/groups/" + groupId)).status, 404);
  const joined = await guest("/api/join", {
    groupId,
    invite: created.data.invite,
    profile: profile("Test Taylor"),
  });
  assert.equal(joined.status, 200);
  assert.equal(joined.data.group.members.length, 3);
  assert.equal(
    (await owner("/api/state?group=" + groupId)).data.group.members.length,
    3,
  );
  const concerts = await owner("/api/concerts?group=" + groupId);
  assert.equal(concerts.status, 200, JSON.stringify(concerts.data));
  assert.ok(concerts.data.events.length > 0);
  const event = concerts.data.events[0];
  const saved = await owner("/api/groups/" + groupId, {
    action: "save",
    eventId: event.id,
  });
  assert.equal(saved.status, 200);
  assert.ok(saved.data.group.saved.some((item) => item.id === event.id));
  const member = joined.data.group.members.find((item) => item.mine);
  const voted = await guest("/api/groups/" + groupId, {
    action: "vote",
    eventId: event.id,
    memberId: member.id,
    value: "yes",
  });
  assert.equal(voted.status, 200);
  const reselected = await guest("/api/groups/" + groupId, {
    action: "selection",
    profiles: [{ memberId: member.id, profile: profile("Test Taylor edited") }],
    preferences: { ...voted.data.group.preferences, radius: 500 },
  });
  assert.equal(reselected.status, 200, JSON.stringify(reselected.data));
  assert.equal(reselected.data.group.id, groupId);
  assert.equal(reselected.data.group.preferences.radius, 500);
  assert.deepEqual(reselected.data.group.saved, voted.data.group.saved);
  assert.deepEqual(reselected.data.group.votes, voted.data.group.votes);
  const exported = await guest("/api/privacy");
  assert.equal(exported.status, 200);
  assert.equal(exported.data.profiles[0].members.length, 1);
  assert.equal((await guest("/api/privacy", undefined, "DELETE")).status, 200);
  assert.equal((await guest("/api/groups/" + groupId)).status, 404);
  console.log(
    "PASS: public pages without sign-in, secure sessions, persistent groups, invitations, isolated profiles, live concert search, shared saves, votes and data deletion.",
  );
  console.log("Live concerts returned: " + concerts.data.events.length);
} finally {
  if (groupId) {
    assert.equal(
      (await owner("/api/groups/" + groupId, { action: "delete" })).status,
      200,
    );
    assert.equal((await owner("/api/groups/" + groupId)).status, 404);
    console.log("Removed only the disposable group created by this check.");
  }
}
