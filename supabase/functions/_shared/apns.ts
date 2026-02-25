export interface APNSNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface APNSDeliveryResult {
  success: boolean;
  status: number;
  reason: string | null;
  terminal: boolean;
  shouldDeleteToken: boolean;
  rawResponse: string | null;
}

interface APNSConfig {
  keyId: string;
  teamId: string;
  bundleId: string;
  authKey: string;
  environment: "sandbox" | "production";
}

let cachedJwt: { token: string; expiresAt: number } | null = null;

function readAPNSConfig(): APNSConfig {
  const keyId = Deno.env.get("APNS_KEY_ID");
  const teamId = Deno.env.get("APNS_TEAM_ID");
  const bundleId = Deno.env.get("APNS_BUNDLE_ID");
  const authKey = Deno.env.get("APNS_AUTH_KEY");
  const environment = Deno.env.get("APNS_ENVIRONMENT") === "production" ? "production" : "sandbox";

  if (!keyId || !teamId || !bundleId || !authKey) {
    throw new Error(
      "APNs config missing. Expected APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_AUTH_KEY.",
    );
  }

  return { keyId, teamId, bundleId, authKey, environment };
}

function isValidDeviceToken(token: string): boolean {
  return /^[a-fA-F0-9]{64,200}$/.test(token);
}

async function generateAPNsJWT(config: APNSConfig): Promise<string> {
  const nowMs = Date.now();
  if (cachedJwt && cachedJwt.expiresAt > nowMs + 60_000) {
    return cachedJwt.token;
  }

  const { SignJWT } = await import("https://deno.land/x/jose@v5.2.0/index.ts");
  const keyBytes = Uint8Array.from(atob(config.authKey), (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: config.keyId })
    .setIssuer(config.teamId)
    .setIssuedAt()
    .setExpirationTime("55m")
    .sign(key);

  cachedJwt = { token, expiresAt: nowMs + 55 * 60_000 };
  return token;
}

function classifyAPNSError(status: number, reason: string | null): Pick<APNSDeliveryResult, "terminal" | "shouldDeleteToken"> {
  if (status >= 500 || status === 429) {
    return { terminal: false, shouldDeleteToken: false };
  }

  const tokenReasons = new Set(["BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic"]);
  if (reason && tokenReasons.has(reason)) {
    return { terminal: true, shouldDeleteToken: true };
  }

  const terminalReasons = new Set([
    "BadCollapseId",
    "BadExpirationDate",
    "BadMessageId",
    "BadPriority",
    "BadTopic",
    "DuplicateHeaders",
    "IdleTimeout",
    "MissingDeviceToken",
    "MissingTopic",
    "PayloadEmpty",
    "TopicDisallowed",
    "BadPath",
    "MethodNotAllowed",
  ]);

  if (reason && terminalReasons.has(reason)) {
    return { terminal: true, shouldDeleteToken: false };
  }

  return { terminal: status < 500, shouldDeleteToken: false };
}

export async function sendAPNSNotification(
  deviceToken: string,
  payload: APNSNotificationPayload,
): Promise<APNSDeliveryResult> {
  if (!isValidDeviceToken(deviceToken)) {
    return {
      success: false,
      status: 400,
      reason: "InvalidDeviceToken",
      terminal: true,
      shouldDeleteToken: true,
      rawResponse: null,
    };
  }

  const config = readAPNSConfig();
  const jwt = await generateAPNsJWT(config);
  const host = config.environment === "production" ? "api.push.apple.com" : "api.sandbox.push.apple.com";
  const url = `https://${host}/3/device/${deviceToken}`;

  const body = {
    aps: {
      alert: {
        title: payload.title,
        body: payload.body,
      },
      sound: "default",
      badge: 1,
    },
    ...(payload.data ?? {}),
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": config.bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  let reason: string | null = null;

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { reason?: unknown };
      if (typeof parsed.reason === "string") {
        reason = parsed.reason;
      }
    } catch {
      // Ignore parse errors and keep raw response for diagnostics.
    }
  }

  if (response.ok) {
    return {
      success: true,
      status: response.status,
      reason,
      terminal: false,
      shouldDeleteToken: false,
      rawResponse: raw || null,
    };
  }

  const classification = classifyAPNSError(response.status, reason);
  return {
    success: false,
    status: response.status,
    reason,
    terminal: classification.terminal,
    shouldDeleteToken: classification.shouldDeleteToken,
    rawResponse: raw || null,
  };
}
