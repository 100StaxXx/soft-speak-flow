const MAX_BODY_BYTES = 32_768;
const ALERT_RETENTION_SECONDS = 30 * 24 * 60 * 60;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

const redactSensitiveText = (value) =>
  String(value ?? "")
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
      "[redacted-user]",
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .slice(0, 1_000);

const costLabel = (value) => {
  if (value === null || value === undefined || value === "") return "unknown cost";
  const cost = Number(value);
  return Number.isFinite(cost) && cost >= 0 ? `$${cost.toFixed(2)}` : "unknown cost";
};

const finiteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]);

const html = (body, status = 200) => new Response(body, {
  status,
  headers: {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  },
});

export const buildNotification = (payload) => {
  const alertType = redactSensitiveText(payload?.alert_type || "cost_alert");
  const scopeType = redactSensitiveText(payload?.scope_type || "unknown");
  const scopeKey = scopeType.toLowerCase() === "user"
    ? "[redacted-user]"
    : redactSensitiveText(payload?.scope_key || "unknown");
  const threshold = Number(payload?.threshold_percent);
  const priority = alertType.includes("blocked") || threshold >= 100
    ? 5
    : threshold >= 80
    ? 4
    : 3;
  const message = redactSensitiveText(payload?.message || "Cost guardrail triggered");

  return {
    title: "Cosmiq cost guardrail",
    message: `[${alertType}] ${scopeType}:${scopeKey} reached ${costLabel(
      payload?.current_estimated_cost_usd,
    )}. ${message}`,
    priority,
    tags: ["warning", "money_with_wings"],
  };
};

const buildStoredAlert = (payload, notification) => ({
  id: crypto.randomUUID(),
  received_at: new Date().toISOString(),
  alert_type: redactSensitiveText(payload?.alert_type || "cost_alert"),
  scope_type: redactSensitiveText(payload?.scope_type || "unknown"),
  scope_key: String(payload?.scope_type || "").toLowerCase() === "user"
    ? "[redacted-user]"
    : redactSensitiveText(payload?.scope_key || "unknown"),
  current_estimated_cost_usd: finiteNumber(payload?.current_estimated_cost_usd),
  threshold_percent: finiteNumber(payload?.threshold_percent),
  message: notification.message,
  priority: notification.priority,
  notification_delivery: "pending",
});

const alertKey = (alert) => {
  const reverseTimestamp = String(9_999_999_999_999 - Date.parse(alert.received_at))
    .padStart(13, "0");
  return `alert:${reverseTimestamp}:${alert.id}`;
};

const writeAlert = (env, key, alert) => env.ALERTS.put(
  key,
  JSON.stringify(alert),
  { expirationTtl: ALERT_RETENTION_SECONDS },
);

const deliverNotification = async (env, key, alert, notification) => {
  const ntfyTopic = env.NTFY_TOPIC?.trim();
  if (!ntfyTopic) {
    alert.notification_delivery = "not_configured";
    await writeAlert(env, key, alert);
    return;
  }

  try {
    const upstream = await fetch(
      `https://ntfy.sh/${encodeURIComponent(ntfyTopic)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Title": notification.title,
          "X-Priority": String(notification.priority),
          "X-Tags": notification.tags.join(","),
        },
        body: notification.message,
      },
    );
    alert.notification_delivery = upstream.ok ? "delivered" : `failed_${upstream.status}`;
    if (!upstream.ok) {
      console.error("Best-effort ntfy delivery failed", { status: upstream.status });
    }
  } catch (error) {
    alert.notification_delivery = "failed_network";
    console.error("Best-effort ntfy delivery failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }
  await writeAlert(env, key, alert);
};

const listAlerts = async (env) => {
  const listed = await env.ALERTS.list({ prefix: "alert:", limit: 100 });
  const alerts = await Promise.all(listed.keys.map(({ name }) => env.ALERTS.get(name, "json")));
  return alerts.filter(Boolean);
};

const renderDashboard = (alerts) => html(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Cosmiq cost alerts</title>
  <style>
    :root{color-scheme:dark;font-family:ui-sans-serif,system-ui,sans-serif;background:#080b18;color:#f7f7ff}
    body{max-width:980px;margin:0 auto;padding:32px 20px 64px}
    h1{margin:0 0 8px;font-size:clamp(1.8rem,5vw,3rem)}
    .lede{color:#aeb4d6;margin:0 0 28px}.grid{display:grid;gap:14px}
    article{border:1px solid #293052;border-radius:16px;padding:18px;background:#11162b;box-shadow:0 12px 30px #0005}
    .row{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}
    .badge{border-radius:999px;padding:5px 10px;background:#33255b;color:#e9dcff;font-size:.82rem}
    .cost{font-size:1.55rem;font-weight:750}.meta{color:#aeb4d6;font-size:.88rem}.message{line-height:1.55;overflow-wrap:anywhere}
    .empty{padding:30px;border:1px dashed #3b4265;border-radius:16px;color:#aeb4d6}
  </style>
</head>
<body>
  <h1>Cosmiq cost alerts</h1>
  <p class="lede">Private, sanitized production guardrail events · 30-day retention · refresh to update</p>
  <main class="grid">${alerts.length ? alerts.map((alert) => `
    <article>
      <div class="row"><span class="badge">${escapeHtml(alert.alert_type)}</span><span class="cost">${escapeHtml(costLabel(alert.current_estimated_cost_usd))}</span></div>
      <p class="message">${escapeHtml(alert.message)}</p>
      <div class="row meta"><span>${escapeHtml(alert.scope_type)}:${escapeHtml(alert.scope_key)}</span><span>${escapeHtml(alert.received_at)}</span></div>
      <div class="row meta"><span>Threshold: ${escapeHtml(alert.threshold_percent ?? "unknown")}%</span><span>Push: ${escapeHtml(alert.notification_delivery)}</span></div>
    </article>`).join("") : '<div class="empty">No cost alerts have been received.</div>'}</main>
</body>
</html>`);

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "cosmiq-cost-alerts" });
    }

    const viewToken = env.ALERT_VIEW_TOKEN?.trim();
    if (request.method === "GET" && viewToken && url.pathname === `/alerts/${viewToken}`) {
      return renderDashboard(await listAlerts(env));
    }
    if (request.method === "GET" && viewToken && url.pathname === `/alerts/${viewToken}.json`) {
      return json({ alerts: await listAlerts(env) });
    }
    if (request.method === "GET" && url.pathname === "/v1/alerts") {
      const suppliedViewToken = request.headers.get("X-Cosmiq-Alert-View-Token")?.trim();
      const bearerMatches = request.headers.get("Authorization")?.trim() === `Bearer ${viewToken}`;
      if (!viewToken || (!bearerMatches && suppliedViewToken !== viewToken)) {
        return json({ error: "Unauthorized" }, 401);
      }
      return json({ alerts: await listAlerts(env) });
    }

    if (request.method !== "POST" || url.pathname !== "/v1/cost-alert") {
      return json({ error: "Not found" }, 404);
    }

    const ingestToken = env.ALERT_INGEST_TOKEN?.trim();
    if (!ingestToken || !env.ALERTS) {
      return json({ error: "Receiver is not configured" }, 503);
    }
    if (request.headers.get("Authorization")?.trim() !== `Bearer ${ingestToken}`) {
      return json({ error: "Unauthorized" }, 401);
    }

    const declaredLength = Number(request.headers.get("Content-Length") ?? 0);
    if (declaredLength > MAX_BODY_BYTES) {
      return json({ error: "Payload too large" }, 413);
    }

    let payload;
    try {
      const rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
        return json({ error: "Payload too large" }, 413);
      }
      payload = JSON.parse(rawBody);
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const notification = buildNotification(payload);
    const alert = buildStoredAlert(payload, notification);
    const key = alertKey(alert);
    try {
      await writeAlert(env, key, alert);
    } catch (error) {
      console.error("Durable alert write failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
      return json({ error: "Durable alert storage failed" }, 503);
    }

    const delivery = deliverNotification(env, key, alert, notification);
    if (context?.waitUntil) context.waitUntil(delivery);
    else await delivery;

    return new Response(null, { status: 204 });
  },
};
