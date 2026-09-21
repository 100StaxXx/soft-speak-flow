import assert from "node:assert/strict";
import test from "node:test";
import worker, { buildNotification } from "./index.mjs";

const createKv = () => {
  const values = new Map();
  return {
    values,
    async put(key, value) {
      values.set(key, value);
    },
    async get(key, type) {
      const value = values.get(key);
      return type === "json" && value ? JSON.parse(value) : value ?? null;
    },
    async list() {
      return { keys: [...values.keys()].sort().map((name) => ({ name })) };
    },
  };
};

test("buildNotification redacts user identifiers and personal data", () => {
  const notification = buildNotification({
    alert_type: "budget_blocked",
    scope_type: "user",
    scope_key: "ca71ca71-0000-4000-8000-000000000001",
    current_estimated_cost_usd: 251.239,
    threshold_percent: 100,
    message:
      "User ca71ca71-0000-4000-8000-000000000001 at owner@example.com exceeded https://internal.example/trace",
    metadata: { must_not_forward: "private" },
  });

  assert.equal(notification.priority, 5);
  assert.match(notification.message, /\$251\.24/);
  assert.match(notification.message, /\[redacted-user\]/);
  assert.match(notification.message, /\[redacted-email\]/);
  assert.match(notification.message, /\[redacted-url\]/);
  assert.doesNotMatch(notification.message, /ca71ca71|owner@example|must_not_forward/);
});

test("receiver rejects requests without the configured bearer token", async () => {
  const response = await worker.fetch(
    new Request("https://alerts.example/v1/cost-alert", {
      method: "POST",
      body: "{}",
    }),
    { ALERT_INGEST_TOKEN: "secret", ALERTS: createKv() },
  );

  assert.equal(response.status, 401);
});

test("receiver durably stores and forwards only sanitized data", async () => {
  const originalFetch = globalThis.fetch;
  let forwardedBody;
  const kv = createKv();
  const backgroundTasks = [];
  globalThis.fetch = async (_url, init) => {
    forwardedBody = {
      url: String(_url),
      body: init.body,
      headers: init.headers,
    };
    return new Response("{}", { status: 200 });
  };

  try {
    const response = await worker.fetch(
      new Request("https://alerts.example/v1/cost-alert", {
        method: "POST",
        headers: {
          Authorization: "Bearer secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          alert_type: "threshold",
          scope_type: "endpoint",
          scope_key: "process-companion-cinema-event",
          current_estimated_cost_usd: 25,
          threshold_percent: 80,
          message: "Cinema crossed the warning threshold",
          metadata: { user_id: "ca71ca71-0000-4000-8000-000000000001" },
        }),
      }),
      { ALERT_INGEST_TOKEN: "secret", NTFY_TOPIC: "private-topic", ALERTS: kv },
      { waitUntil: (promise) => backgroundTasks.push(promise) },
    );
    await Promise.all(backgroundTasks);

    assert.equal(response.status, 204);
    assert.equal(forwardedBody.url, "https://ntfy.sh/private-topic");
    assert.equal(forwardedBody.headers["X-Priority"], "4");
    assert.match(forwardedBody.body, /Cinema crossed the warning threshold/);
    assert.doesNotMatch(JSON.stringify(forwardedBody), /ca71ca71/);
    const stored = [...kv.values.values()].map(JSON.parse)[0];
    assert.equal(stored.notification_delivery, "delivered");
    assert.doesNotMatch(JSON.stringify(stored), /ca71ca71|user_id/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("receiver preserves the alert when best-effort push is rate limited", async () => {
  const originalFetch = globalThis.fetch;
  const kv = createKv();
  const backgroundTasks = [];
  globalThis.fetch = async () => new Response("limited", { status: 429 });

  try {
    const response = await worker.fetch(
      new Request("https://alerts.example/v1/cost-alert", {
        method: "POST",
        headers: { Authorization: "Bearer secret" },
        body: JSON.stringify({ current_estimated_cost_usd: 10 }),
      }),
      { ALERT_INGEST_TOKEN: "secret", NTFY_TOPIC: "private-topic", ALERTS: kv },
      { waitUntil: (promise) => backgroundTasks.push(promise) },
    );
    await Promise.all(backgroundTasks);

    assert.equal(response.status, 204);
    const stored = [...kv.values.values()].map(JSON.parse)[0];
    assert.equal(stored.notification_delivery, "failed_429");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("private dashboard escapes stored content", async () => {
  const kv = createKv();
  await kv.put("alert:1:test", JSON.stringify({
    alert_type: "<script>alert(1)</script>",
    current_estimated_cost_usd: 10,
    message: "safe",
    scope_type: "global",
    scope_key: "all",
    received_at: "2026-08-19T00:00:00.000Z",
    threshold_percent: 80,
    notification_delivery: "delivered",
  }));

  const response = await worker.fetch(
    new Request("https://alerts.example/alerts/view-secret"),
    { ALERT_VIEW_TOKEN: "view-secret", ALERTS: kv },
  );
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /&lt;script&gt;/);
  assert.doesNotMatch(body, /<script>alert/);
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow, noarchive");
});

test("JSON alert view requires its dedicated credential", async () => {
  const kv = createKv();
  await kv.put("alert:1:test", JSON.stringify({ id: "safe-alert" }));

  const denied = await worker.fetch(
    new Request("https://alerts.example/v1/alerts"),
    { ALERT_VIEW_TOKEN: "view-secret", ALERTS: kv },
  );
  const allowed = await worker.fetch(
    new Request("https://alerts.example/v1/alerts", {
      headers: { "X-Cosmiq-Alert-View-Token": "view-secret" },
    }),
    { ALERT_VIEW_TOKEN: "view-secret", ALERTS: kv },
  );

  assert.equal(denied.status, 401);
  assert.equal(allowed.status, 200);
  assert.deepEqual(await allowed.json(), { alerts: [{ id: "safe-alert" }] });
});

test("private JSON view supports credentialed operational checks", async () => {
  const kv = createKv();
  await kv.put("alert:1:test", JSON.stringify({ id: "safe-alert" }));

  const response = await worker.fetch(
    new Request("https://alerts.example/alerts/view-secret.json"),
    { ALERT_VIEW_TOKEN: "view-secret", ALERTS: kv },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { alerts: [{ id: "safe-alert" }] });
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});
