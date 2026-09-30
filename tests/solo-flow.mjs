import assert from "node:assert/strict";

const origin = process.env.TEST_ORIGIN || "http://127.0.0.1:5174";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw new Error("Solo-flow checks only run against a local server.");
function client() {
  let cookie = "";
  return async (path, body) => {
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
    return { status: response.status, data: await response.json() };
  };
}
const owner = client(),
  guest = client(),
  stranger = client();
const profile = (name) => ({
  name,
  artists: [
    { id: "catalog:provinz", name: "Provinz", genres: ["Indie", "Pop"] },
  ],
  genres: [],
});
let groupId;
try {
  const created = await owner("/api/groups", {
    name: "Solo-flow QA — disposable",
    profiles: [profile("Solo Alex")],
  });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  groupId = created.data.group.id;
  assert.equal(created.data.group.members.length, 1);
  assert.equal(created.data.group.members[0].mine, true);
  assert.equal((await stranger("/api/groups/" + groupId)).status, 404);
  const restored = await owner("/api/state?group=" + groupId);
  assert.equal(restored.data.group.members.length, 1);
  const concerts = await owner("/api/concerts?group=" + groupId);
  assert.equal(concerts.status, 200, JSON.stringify(concerts.data));
  assert.ok(
    concerts.data.events.length > 0,
    "A single profile can retrieve real concert candidates",
  );
  const event = concerts.data.events[0];
  const saved = await owner("/api/groups/" + groupId, {
    action: "save",
    eventId: event.id,
  });
  assert.equal(saved.status, 200);
  assert.ok(saved.data.group.saved.some((c) => c.id === event.id));
  const member = saved.data.group.members[0];
  const updated = await owner("/api/groups/" + groupId, {
    action: "selection",
    profiles: [{ memberId: member.id, profile: profile("Solo Alex edited") }],
    preferences: { ...saved.data.group.preferences, radius: 500 },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.group.members.length, 1);
  assert.equal(updated.data.group.members[0].name, "Solo Alex edited");
  assert.deepEqual(updated.data.group.saved, saved.data.group.saved);
  const added = await owner("/api/groups/" + groupId, {
    action: "add",
    profile: profile("Local friend"),
  });
  assert.equal(added.status, 200);
  assert.equal(added.data.group.id, groupId);
  assert.equal(added.data.group.members.length, 2);
  assert.deepEqual(added.data.group.saved, saved.data.group.saved);
  assert.equal(added.data.group.preferences.radius, 500);
  const joined = await guest("/api/join", {
    groupId,
    invite: created.data.invite,
    profile: profile("Invited friend"),
  });
  assert.equal(joined.status, 200);
  assert.equal(joined.data.group.members.length, 3);
  assert.deepEqual(joined.data.group.saved, saved.data.group.saved);
  const after = await owner("/api/state?group=" + groupId);
  assert.equal(after.data.group.id, groupId);
  assert.equal(after.data.group.members.length, 3);
  console.log(
    "PASS: private solo creation, restored profile, real concert candidates, saved shortlist, edited selection and transition to local/invited friends without data loss.",
  );
} finally {
  if (groupId)
    assert.equal(
      (await owner("/api/groups/" + groupId, { action: "delete" })).status,
      200,
    );
}
