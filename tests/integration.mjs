import assert from "node:assert/strict";
const base = process.env.TEST_ORIGIN || "http://localhost:5173";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw new Error("Integration tests only run against a local server.");
const origin = new URL(base).origin;
function client() {
  let cookie = "";
  return async (path, body, options = {}) => {
    const method = options.method || (body ? "POST" : "GET");
    const headers = { Origin: origin, ...options.headers };
    if (cookie) headers.Cookie = cookie;
    if (body) headers["Content-Type"] = "application/json";
    const r = await fetch(base + path, {
      method,
      headers,
      body: options.rawBody ?? (body ? JSON.stringify(body) : undefined),
    });
    const set = r.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const data = await r.json().catch(() => null);
    return { status: r.status, data, headers: r.headers };
  };
}
const a = client(),
  b = client(),
  stranger = client();
const profile = (name) => ({
  name,
  artists: [
    { id: "catalog:provinz", name: "Provinz", genres: ["Indie", "Pop"] },
  ],
  genres: [],
});
let id;
try {
  assert.equal((await a("/api/state")).status, 200);
  const create = await a("/api/groups", {
    name: "Integration QA – disposable",
    profiles: [profile("Alex"), profile("Sam")],
  });
  assert.equal(create.status, 200, JSON.stringify(create.data));
  id = create.data.group.id;
  assert.equal(create.data.group.members.length, 2);
  for (const rawBody of ["null", "[]", "42"]) {
    assert.equal(
      (await a("/api/groups/" + id, undefined, { method: "POST", rawBody }))
        .status,
      400,
    );
  }
  assert.equal((await stranger("/api/groups/" + id)).status, 404);
  const forged = await stranger("/api/groups/" + id, {
    action: "preferences",
    preferences: create.data.group.preferences,
  });
  assert.equal(forged.status, 404);
  const csrf = await a(
    "/api/groups/" + id,
    { action: "add", profile: profile("CSRF") },
    { headers: { Origin: "https://attacker.example" } },
  );
  assert.equal(csrf.status, 403);
  const join = await b("/api/join", {
    groupId: id,
    invite: create.data.invite,
    profile: profile("Taylor"),
  });
  assert.equal(join.status, 200);
  assert.equal(join.data.group.members.length, 3);
  assert.equal(join.data.group.owner, false);
  const alex = join.data.group.members.find((m) => m.name === "Alex");
  assert.equal(
    (
      await b("/api/groups/" + id, {
        action: "profile",
        memberId: alex.id,
        profile: profile("Hijacked"),
      })
    ).status,
    403,
  );
  assert.equal(
    (await b("/api/groups/" + id, { action: "delete" })).status,
    403,
  );
  const own = join.data.group.members.find((m) => m.mine);
  assert.equal(
    (
      await b("/api/groups/" + id, {
        action: "profile",
        memberId: own.id,
        profile: profile("Taylor updated"),
      })
    ).status,
    200,
  );
  const rotate = await a("/api/groups/" + id, { action: "invite" });
  const c = client();
  assert.equal(
    (
      await c("/api/join", {
        groupId: id,
        invite: create.data.invite,
        profile: profile("Old invitation"),
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await c("/api/join", {
        groupId: id,
        invite: rotate.data.invite,
        profile: profile("New invitation"),
      })
    ).status,
    200,
  );
  for (let i = 0; i < 4; i++)
    assert.equal(
      (
        await a("/api/groups/" + id, {
          action: "add",
          profile: profile("Guest " + i),
        })
      ).status,
      200,
    );
  assert.equal(
    (
      await a("/api/groups/" + id, {
        action: "add",
        profile: profile("Overflow"),
      })
    ).status,
    400,
  );
  const concerts = await a("/api/concerts?group=" + id);
  assert.equal(concerts.status, 200, JSON.stringify(concerts.data));
  assert.ok(
    concerts.data.events.length > 0,
    "Live event provider should return actual events",
  );
  const event = concerts.data.events[0];
  const save = await a("/api/groups/" + id, {
    action: "save",
    eventId: event.id,
  });
  assert.equal(save.status, 200, JSON.stringify(save.data));
  assert.ok(save.data.group.saved.some((e) => e.id === event.id));
  assert.equal(
    (
      await b("/api/groups/" + id, {
        action: "vote",
        memberId: alex.id,
        eventId: event.id,
        value: "yes",
      })
    ).status,
    403,
  );
  const vote = await b("/api/groups/" + id, {
    action: "vote",
    memberId: own.id,
    eventId: event.id,
    value: "yes",
  });
  assert.equal(vote.status, 200);
  assert.ok(
    vote.data.group.votes.some(
      (v) => v.memberId === own.id && v.value === "yes",
    ),
  );
  const selectedPreferences = { ...vote.data.group.preferences, radius: 500 };
  const foreignSelection = await b("/api/groups/" + id, {
    action: "selection",
    profiles: [
      { memberId: own.id, profile: profile("Must not partially save") },
      { memberId: alex.id, profile: profile("Hijacked") },
    ],
    preferences: selectedPreferences,
  });
  assert.equal(foreignSelection.status, 403);
  const unchanged = await b("/api/groups/" + id);
  assert.equal(
    unchanged.data.group.members.find((m) => m.id === own.id).name,
    "Taylor updated",
  );
  assert.equal(
    unchanged.data.group.preferences.radius,
    vote.data.group.preferences.radius,
  );
  const reselected = await b("/api/groups/" + id, {
    action: "selection",
    profiles: [{ memberId: own.id, profile: profile("Taylor reselected") }],
    preferences: selectedPreferences,
  });
  assert.equal(reselected.status, 200, JSON.stringify(reselected.data));
  assert.equal(reselected.data.group.id, id);
  assert.equal(reselected.data.group.preferences.radius, 500);
  assert.equal(
    reselected.data.group.members.find((m) => m.id === own.id).name,
    "Taylor reselected",
  );
  assert.deepEqual(reselected.data.group.saved, vote.data.group.saved);
  assert.deepEqual(reselected.data.group.votes, vote.data.group.votes);
  assert.deepEqual(
    reselected.data.group.members.map((m) => m.id),
    vote.data.group.members.map((m) => m.id),
  );
  const exp = await b("/api/privacy");
  assert.equal(exp.status, 200);
  assert.equal(exp.data.profiles[0].members.length, 1);
  assert.ok(!JSON.stringify(exp.data).includes('"owner"'));
  const del = await b("/api/privacy", undefined, { method: "DELETE" });
  assert.equal(del.status, 200);
  assert.equal((await b("/api/groups/" + id)).status, 404);
  const after = await a("/api/groups/" + id);
  assert.equal(after.data.group.members.length, 7);
  assert.ok(!after.data.group.votes.some((v) => v.memberId === own.id));
  const safeImage = await fetch(
    base +
      "/api/image?url=" +
      encodeURIComponent("https://example.com/private"),
  );
  assert.equal(safeImage.status, 400);
  console.log(
    "PASS: anonymous sessions, atomic group creation, invite rotation, profile isolation, CSRF, eight-person limit, live concerts, shared saves, owned votes, export and deletion.",
  );
  console.log(
    "Live provider returned " +
      concerts.data.events.length +
      " concerts; first: " +
      event.title +
      " (" +
      event.date +
      ").",
  );
} finally {
  if (id) {
    const cleanup = await a("/api/groups/" + id, { action: "delete" });
    assert.equal(cleanup.status, 200);
    assert.equal((await a("/api/groups/" + id)).status, 404);
  }
}
