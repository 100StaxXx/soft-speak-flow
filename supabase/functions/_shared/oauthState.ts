export type OAuthProvider = "google" | "outlook";
export type OAuthSyncMode = "send_only" | "full_sync";

const OAUTH_STATE_VERSION = 1;
const DEFAULT_TTL_SECONDS = 10 * 60;

export interface OAuthStatePayload {
  v: number;
  provider: OAuthProvider;
  userId: string;
  syncMode: OAuthSyncMode;
  exp: number;
  nonce: string;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function secureEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

function isSyncMode(value: unknown): value is OAuthSyncMode {
  return value === "send_only" || value === "full_sync";
}

function isProvider(value: unknown): value is OAuthProvider {
  return value === "google" || value === "outlook";
}

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

export async function createSignedOAuthState(args: {
  provider: OAuthProvider;
  userId: string;
  syncMode: OAuthSyncMode;
  secret: string;
  ttlSeconds?: number;
}): Promise<string> {
  const { provider, userId, syncMode, secret } = args;
  const ttlSeconds = args.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const nowSeconds = Math.floor(Date.now() / 1000);

  const payload: OAuthStatePayload = {
    v: OAUTH_STATE_VERSION,
    provider,
    userId,
    syncMode,
    exp: nowSeconds + ttlSeconds,
    nonce: randomNonce(),
  };

  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const key = await importHmacKey(secret);
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, toArrayBuffer(payloadBytes));
  const signatureBytes = new Uint8Array(signatureBuffer);

  return `${encodeBase64Url(payloadBytes)}.${encodeBase64Url(signatureBytes)}`;
}

function parsePayload(rawPayload: string): OAuthStatePayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawPayload);
  } catch {
    throw new Error("Invalid OAuth state");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid OAuth state");
  }

  const payload = parsed as Partial<OAuthStatePayload>;
  if (payload.v !== OAUTH_STATE_VERSION) {
    throw new Error("Invalid OAuth state");
  }

  if (!isProvider(payload.provider) || typeof payload.userId !== "string" || payload.userId.trim().length === 0) {
    throw new Error("Invalid OAuth state");
  }

  if (!isSyncMode(payload.syncMode)) {
    throw new Error("Invalid OAuth state");
  }

  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
    throw new Error("Invalid OAuth state");
  }

  if (typeof payload.nonce !== "string" || payload.nonce.length === 0) {
    throw new Error("Invalid OAuth state");
  }

  return {
    v: payload.v,
    provider: payload.provider,
    userId: payload.userId,
    syncMode: payload.syncMode,
    exp: payload.exp,
    nonce: payload.nonce,
  };
}

export async function verifySignedOAuthState(args: {
  state: string | undefined | null;
  provider: OAuthProvider;
  secret: string;
}): Promise<OAuthStatePayload> {
  const { state, provider, secret } = args;

  if (!state) {
    throw new Error("Invalid or expired OAuth state");
  }

  const parts = state.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("Invalid or expired OAuth state");
  }

  let payloadBytes: Uint8Array;
  let signatureBytes: Uint8Array;
  try {
    payloadBytes = decodeBase64Url(parts[0]);
    signatureBytes = decodeBase64Url(parts[1]);
  } catch {
    throw new Error("Invalid or expired OAuth state");
  }

  const key = await importHmacKey(secret);
  const expectedSignatureBuffer = await crypto.subtle.sign("HMAC", key, toArrayBuffer(payloadBytes));
  const expectedSignature = new Uint8Array(expectedSignatureBuffer);

  if (!secureEqual(expectedSignature, signatureBytes)) {
    throw new Error("Invalid or expired OAuth state");
  }

  const payload = parsePayload(new TextDecoder().decode(payloadBytes));
  if (payload.provider !== provider) {
    throw new Error("Invalid or expired OAuth state");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.exp <= nowSeconds) {
    throw new Error("Invalid or expired OAuth state");
  }

  return payload;
}
