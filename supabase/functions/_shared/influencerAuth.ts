interface CreatorAccessTokenPayload {
  code: string;
  iat: number;
  exp: number;
  v: 1;
}

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days

function getTokenSecret(): string {
  const configured = Deno.env.get("INFLUENCER_DASHBOARD_SECRET");
  if (configured && configured.length >= 32) return configured;

  // Backward-compatible fallback so existing environments still work.
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

function base64UrlEncode(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return atob(padded);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return base64UrlEncode(binary);
}

async function signPayload(payloadB64: string): Promise<string> {
  const secret = getTokenSecret();
  if (!secret) {
    throw new Error("Missing influencer dashboard token secret");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadB64),
  );

  return bytesToBase64Url(new Uint8Array(signature));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function createCreatorAccessToken(code: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: CreatorAccessTokenPayload = {
    code: code.toUpperCase(),
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
    v: 1,
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = await signPayload(payloadB64);
  return `${payloadB64}.${signature}`;
}

export async function verifyCreatorAccessToken(
  expectedCode: string,
  token: string,
): Promise<{ valid: boolean; reason?: string }> {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return { valid: false, reason: "Invalid token format" };
  }

  const [payloadB64, providedSignature] = parts;

  try {
    const decoded = base64UrlDecode(payloadB64);
    const payload = JSON.parse(decoded) as Partial<CreatorAccessTokenPayload>;

    if (payload.v !== 1) {
      return { valid: false, reason: "Unsupported token version" };
    }

    if (typeof payload.code !== "string" || payload.code.toUpperCase() !== expectedCode.toUpperCase()) {
      return { valid: false, reason: "Token does not match referral code" };
    }

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp < now) {
      return { valid: false, reason: "Token expired" };
    }

    const expectedSignature = await signPayload(payloadB64);
    if (!timingSafeEqual(expectedSignature, providedSignature)) {
      return { valid: false, reason: "Invalid token signature" };
    }

    return { valid: true };
  } catch (_error) {
    return { valid: false, reason: "Invalid token payload" };
  }
}
