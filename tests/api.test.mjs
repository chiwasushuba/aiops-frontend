import test from "node:test";
import assert from "node:assert/strict";
import { createApi, ApiError, submissionIdentity } from "../src/api.ts";

test("an old unauthenticated request cannot expire a newly signed-in session", async () => {
  let finishOld;
  let expired = 0;
  const api = createApi(
    async (url) => {
      if (url.endsWith("/old"))
        return new Promise((resolve) => {
          finishOld = resolve;
        });
      if (url.endsWith("/auth/csrf"))
        return json({ headerName: "X-CSRF-TOKEN", token: "test-only-token" });
      if (url.endsWith("/auth/login"))
        return new Response(null, { status: 204 });
      return json({
        id: "owner",
        displayName: "Owner",
        timezone: "Asia/Manila",
      });
    },
    () => expired++,
  );
  const old = api.request("/old");
  const rejected = assert.rejects(old, (error) => error.status === 401);
  await api.login("owner", "test-only-password");
  finishOld(json({ message: "Previous session expired." }, 401));
  await rejected;
  assert.equal(expired, 0);
});

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

test("login rotates CSRF and mutations use cookies without persisting credentials", async () => {
  const calls = [];
  let csrfCalls = 0;
  const api = createApi(async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/auth/csrf"))
      return json({
        headerName: "X-CSRF-TOKEN",
        token: `token-${++csrfCalls}`,
      });
    if (url.endsWith("/auth/login")) return new Response(null, { status: 204 });
    if (url.endsWith("/me"))
      return json({
        id: "owner",
        displayName: "Owner",
        timezone: "Asia/Manila",
      });
    return json({ id: "job" });
  });
  await api.login("owner", "test-only-password");
  await api.mutate("/work-items", { instruction: "Test" });
  assert.equal(csrfCalls, 2);
  assert.equal(calls[1].init.headers.get("X-CSRF-TOKEN"), "token-1");
  assert.equal(calls.at(-1).init.headers.get("X-CSRF-TOKEN"), "token-2");
  assert.ok(calls.every((call) => call.init.credentials === "include"));
  assert.equal(calls[1].init.body.get("password"), "test-only-password");
  assert.ok(!JSON.stringify(calls.at(-1)).includes("test-only-password"));
});

test("session expiry notifies once and prevents automatic mutation retry", async () => {
  let expired = 0;
  let mutations = 0;
  const api = createApi(
    async (url) => {
      if (url.endsWith("/auth/csrf"))
        return json({ headerName: "X-CSRF-TOKEN", token: "test-only-token" });
      mutations++;
      return json({ code: "unauthenticated", message: "Sign in again." }, 401);
    },
    () => expired++,
  );
  await assert.rejects(
    api.mutate("/tasks", { title: "Test" }),
    (error) => error instanceof ApiError && error.status === 401,
  );
  assert.equal(expired, 1);
  assert.equal(mutations, 1);
});

test("explicit transport retry reuses the same payload identity, edits create a new identity", async () => {
  const payload = { agentId: "employee-a", instruction: "Test", sourceIds: [] };
  const identity = submissionIdentity(null, payload);
  const sent = [];
  const api = createApi(async (url, init) => {
    if (url.endsWith("/auth/csrf"))
      return json({ headerName: "X-CSRF-TOKEN", token: "test-only-token" });
    sent.push(JSON.parse(init.body));
    if (sent.length === 1) throw new Error("connection lost");
    return json({ id: "saved-job" });
  });
  await assert.rejects(
    api.mutate("/work-items", { ...payload, clientRequestId: identity.id }),
    (error) => error.code === "connection_failed",
  );
  const retry = submissionIdentity(identity, payload);
  await api.mutate("/work-items", { ...payload, clientRequestId: retry.id });
  assert.deepEqual(sent[0], sent[1]);
  assert.notEqual(
    submissionIdentity(identity, { ...payload, instruction: "Changed" }).id,
    identity.id,
  );
});

test("stale version errors give a refresh instruction and preserve the request ID", async () => {
  const api = createApi(async () =>
    json(
      {
        code: "stale_version",
        message: "Record changed.",
        requestId: "request-test",
      },
      409,
    ),
  );
  await assert.rejects(
    api.request("/agents/employee"),
    (error) =>
      error.status === 409 &&
      error.message.includes("Refresh") &&
      error.requestId === "request-test",
  );
});

test("pagination preserves filters and exposes totals", async () => {
  let requested;
  const api = createApi(async (url) => {
    requested = url;
    return json({
      content: [{ id: "draft" }],
      page: 2,
      size: 20,
      totalElements: 45,
    });
  });
  const result = await api.page("/proposals?status=pending", 2);
  assert.equal(requested, "/api/proposals?status=pending&page=2&size=20");
  assert.equal(result.totalElements, 45);
});

test("non-JSON proxy success fails visibly instead of pretending to load data", async () => {
  const api = createApi(async () => new Response("<html>frontend</html>"));
  await assert.rejects(
    api.request("/me"),
    (error) =>
      error.code === "invalid_response" && error.message.includes("proxy"),
  );
});
