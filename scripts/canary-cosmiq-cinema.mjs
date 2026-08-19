#!/usr/bin/env node

const args = new Map(
  process.argv.slice(2).map((argument) => {
    const [key, ...value] = argument.split("=");
    return [key, value.join("=") || true];
  }),
);

const numberArg = (name, fallback) => {
  const value = Number(args.get(name) ?? fallback);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return value;
};

const eventType = String(args.get("--event-type") ?? "evolution");
const durationSeconds = numberArg("--duration", 12);
const candidates = numberArg("--candidates", 2);
const portraitAttempts = eventType === "evolution"
  ? numberArg("--portrait-attempts", 2)
  : 0;
const audioEnabled = args.get("--audio") !== "off";
const videoRate = audioEnabled ? 0.126 : 0.084;
const estimate = {
  eventType,
  model: "fal-ai/kling-video/v3/standard/image-to-video",
  durationSeconds,
  candidates,
  audioEnabled,
  videoCostUsd: Number((durationSeconds * candidates * videoRate).toFixed(3)),
  maximumPortraitCostUsd: Number((portraitAttempts * 0.052).toFixed(3)),
};
estimate.maximumModelCostUsd = Number(
  (estimate.videoCostUsd + estimate.maximumPortraitCostUsd).toFixed(3),
);

const executing = args.has("--execute");
if (!executing) {
  process.stdout.write(`${JSON.stringify({
    mode: "dry-run",
    paidProviderCallsMade: false,
    estimate,
    executeRequirements: [
      "--execute",
      "--confirm-paid-generation=COSMIQ_STANDARD_CANARY",
      "--event-id=<existing queued canary event UUID>",
      "SUPABASE_URL, SUPABASE_ANON_KEY, INTERNAL_FUNCTION_SECRET",
    ],
  }, null, 2)}\n`);
  process.exit(0);
}

if (
  args.get("--confirm-paid-generation") !== "COSMIQ_STANDARD_CANARY"
) {
  throw new Error(
    "Paid canary blocked: pass --confirm-paid-generation=COSMIQ_STANDARD_CANARY",
  );
}

const eventId = args.get("--event-id");
if (typeof eventId !== "string" || !eventId) {
  throw new Error("--event-id=<queued canary event UUID> is required");
}
const baseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
const anonKey = process.env.SUPABASE_ANON_KEY;
const internalSecret = process.env.INTERNAL_FUNCTION_SECRET;
if (!baseUrl || !anonKey || !internalSecret) {
  throw new Error(
    "SUPABASE_URL, SUPABASE_ANON_KEY, and INTERNAL_FUNCTION_SECRET are required",
  );
}

const terminal = new Set([
  "ready",
  "failed",
  "cancelled",
  "superseded",
]);
let lastResult = null;
for (let attempt = 1; attempt <= 60; attempt += 1) {
  const response = await fetch(
    `${baseUrl}/functions/v1/process-companion-cinema-event`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        "x-internal-key": internalSecret,
      },
      body: JSON.stringify({ eventId }),
    },
  );
  const result = await response.json().catch(() => ({}));
  lastResult = result;
  process.stdout.write(`${JSON.stringify({ attempt, httpStatus: response.status, result })}\n`);
  if (terminal.has(result.status)) break;
  await new Promise((resolve) => setTimeout(resolve, 30_000));
}

if (lastResult?.status !== "ready") {
  throw new Error(
    `Canary did not become ready: ${JSON.stringify(lastResult)}`,
  );
}

process.stdout.write(`${JSON.stringify({
  status: "ready",
  eventId,
  estimate,
  requiredHumanChecks: [
    "Play the signed film on iOS and web with sound enabled",
    "Confirm exact companion identity at the opening and final frames",
    "Confirm no anatomy, style, text, or hard-cut defects",
    "Reveal or claim the event and verify private candidates are removed",
    "Confirm the next evolution boundary is queued",
  ],
}, null, 2)}\n`);
