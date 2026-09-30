import assert from "node:assert/strict";

const origin = process.env.TEST_ORIGIN || "http://127.0.0.1:5174";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw new Error("Saved-search checks only run against a local server.");
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
  stranger = client();
const ids = [];
try {
  for (const name of ["Earlier search", "Latest search"]) {
    const created = await owner("/api/groups", {
      name: name + " — disposable QA",
      profiles: [
        {
          name: "Alex",
          artists: [
            {
              id: "catalog:provinz",
              name: "Provinz",
              genres: ["Indie", "Pop"],
            },
          ],
          genres: [],
        },
      ],
    });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    ids.push(created.data.group.id);
  }
  const start = await owner("/api/state");
  assert.equal(start.status, 200);
  assert.equal(
    start.data.group,
    null,
    "A remembered browser opens the homepage without auto-selecting its latest search",
  );
  assert.deepEqual(
    new Set(start.data.groups.map((g) => g.id)),
    new Set(ids),
    "Both saved searches remain available",
  );
  for (const id of ids) {
    const restored = await owner("/api/state?group=" + id);
    assert.equal(restored.status, 200);
    assert.equal(
      restored.data.group.id,
      id,
      "Explicit selection restores the chosen search",
    );
  }
  for (const id of [crypto.randomUUID(), "", "not-a-search"]) {
    const missing = await owner("/api/state?group=" + id);
    assert.equal(missing.status, 200);
    assert.equal(
      missing.data.group,
      null,
      "Unknown or empty search links do not select an unrelated search",
    );
    assert.equal(missing.data.groups.length, 2);
  }
  const privateSearch = await stranger("/api/state?group=" + ids[0]);
  assert.equal(privateSearch.data.group, null);
  assert.deepEqual(privateSearch.data.groups, []);
  assert.equal(
    (await owner("/api/state")).data.group,
    null,
    "Returning home after restoring a search still starts fresh",
  );
  console.log(
    "PASS: remembered visitors start on the homepage; both saved searches can be explicitly restored; unknown and private links cannot trigger unrelated results.",
  );
} finally {
  for (const id of ids)
    assert.equal(
      (await owner("/api/groups/" + id, { action: "delete" })).status,
      200,
    );
}
