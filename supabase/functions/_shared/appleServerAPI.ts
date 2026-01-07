/**
 * Apple App Store Server API v2 Implementation
 * https://developer.apple.com/documentation/appstoreserverapi
 */

// App Store Server API endpoints
const PRODUCTION_URL = "https://api.storekit.itunes.apple.com";
const SANDBOX_URL = "https://api.storekit-sandbox.itunes.apple.com";

export interface AppleTransactionInfo {
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  purchaseDate: number;
  expiresDate?: number;
  type: string;
  environment: string;
  revocationDate?: number;
  revocationReason?: number;
}

export interface AppleSubscriptionStatus {
  subscriptionGroupIdentifier: string;
  lastTransactions: {
    originalTransactionId: string;
    status: number; // 1=active, 2=expired, 3=billing_retry, 4=grace_period, 5=revoked
    signedTransactionInfo: string;
    signedRenewalInfo?: string;
  }[];
}

export interface SubscriptionStatusResponse {
  environment: string;
  bundleId: string;
  data: AppleSubscriptionStatus[];
}

function base64UrlEncode(data: Uint8Array): string {
  const binString = Array.from(data, (byte) => String.fromCharCode(byte)).join("");
  const base64 = btoa(binString);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64UrlDecode(str: string): Uint8Array {
  // Add padding if needed
  let padded = str.replace(/-/g, "+").replace(/_/g, "/");
  while (padded.length % 4) {
    padded += "=";
  }
  const binString = atob(padded);
  return Uint8Array.from(binString, (c) => c.charCodeAt(0));
}

/**
 * Creates a signed JWT for App Store Server API authentication
 */
async function createAppleJWT(): Promise<string> {
  const keyId = Deno.env.get("APPLE_KEY_ID");
  const issuerId = Deno.env.get("APPLE_TEAM_ID"); // Issuer ID is the Team ID for App Store Server API
  const privateKeyPem = Deno.env.get("APPLE_PRIVATE_KEY");
  const bundleId = Deno.env.get("APPLE_IOS_BUNDLE_ID");

  if (!keyId || !issuerId || !privateKeyPem || !bundleId) {
    throw new Error("Missing Apple API configuration: APPLE_KEY_ID, APPLE_TEAM_ID, APPLE_PRIVATE_KEY, or APPLE_IOS_BUNDLE_ID");
  }

  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour

  const header = {
    alg: "ES256",
    kid: keyId,
    typ: "JWT",
  };

  const payload = {
    iss: issuerId,
    iat: now,
    exp: expiry,
    aud: "appstoreconnect-v1",
    bid: bundleId,
  };

  // Encode header and payload
  const headerBytes = new TextEncoder().encode(JSON.stringify(header));
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const encodedHeader = base64UrlEncode(headerBytes);
  const encodedPayload = base64UrlEncode(payloadBytes);
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  // Clean up the PEM key and import it
  const pemLines = privateKeyPem.split("\n");
  const keyBase64 = pemLines
    .filter(line => !line.startsWith("-----"))
    .join("");
  
  // Decode base64 to ArrayBuffer directly
  const binString = atob(keyBase64);
  const keyBuffer = new ArrayBuffer(binString.length);
  const keyView = new Uint8Array(keyBuffer);
  for (let i = 0; i < binString.length; i++) {
    keyView[i] = binString.charCodeAt(i);
  }

  // Import the private key
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  // Sign the data
  const signatureBytes = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const signature = base64UrlEncode(new Uint8Array(signatureBytes));

  return `${signingInput}.${signature}`;
}

/**
 * Decodes a JWS (JSON Web Signature) from Apple
 */
export function decodeAppleJWS<T>(jws: string): T {
  const parts = jws.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWS format");
  }
  
  const payloadBytes = base64UrlDecode(parts[1]);
  const payloadJson = new TextDecoder().decode(payloadBytes);
  return JSON.parse(payloadJson) as T;
}

/**
 * Get transaction info from App Store Server API
 */
export async function getTransactionInfo(
  transactionId: string,
  useSandbox = false
): Promise<AppleTransactionInfo> {
  const jwt = await createAppleJWT();
  const baseUrl = useSandbox ? SANDBOX_URL : PRODUCTION_URL;
  const url = `${baseUrl}/inApps/v1/transactions/${transactionId}`;

  console.log(`[Apple API] Getting transaction info for: ${transactionId}, sandbox: ${useSandbox}`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Apple API] Transaction info error: ${response.status} - ${errorText}`);
    
    // If production fails, try sandbox for:
    // - 404: Transaction not found (sandbox transactions don't exist in production)
    // - 401: Unauthorized (sandbox uses different auth context)
    // - 4xx: Other client errors that may indicate wrong environment
    if (!useSandbox && (response.status === 404 || response.status === 401 || (response.status >= 400 && response.status < 500))) {
      console.log(`[Apple API] Production failed with ${response.status}, trying sandbox...`);
      return getTransactionInfo(transactionId, true);
    }
    
    throw new Error(`Apple API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log("[Apple API] Transaction info response received");

  // The response contains a signedTransactionInfo JWS
  if (data.signedTransactionInfo) {
    return decodeAppleJWS<AppleTransactionInfo>(data.signedTransactionInfo);
  }

  throw new Error("No signed transaction info in response");
}

/**
 * Get subscription status from App Store Server API
 */
export async function getSubscriptionStatus(
  transactionId: string,
  useSandbox = false
): Promise<{ status: SubscriptionStatusResponse; environment: string }> {
  const jwt = await createAppleJWT();
  const baseUrl = useSandbox ? SANDBOX_URL : PRODUCTION_URL;
  const url = `${baseUrl}/inApps/v1/subscriptions/${transactionId}`;

  console.log(`[Apple API] Getting subscription status for: ${transactionId}, sandbox: ${useSandbox}`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Apple API] Subscription status error: ${response.status} - ${errorText}`);
    
    // If production fails, try sandbox for any 4xx error
    if (!useSandbox && (response.status === 404 || response.status === 401 || (response.status >= 400 && response.status < 500))) {
      console.log(`[Apple API] Production failed with ${response.status}, trying sandbox...`);
      return getSubscriptionStatus(transactionId, true);
    }
    
    throw new Error(`Apple API error: ${response.status} - ${errorText}`);
  }

  const data: SubscriptionStatusResponse = await response.json();
  console.log("[Apple API] Subscription status response received");

  return {
    status: data,
    environment: useSandbox ? "Sandbox" : "Production",
  };
}

/**
 * Verify a transaction and get its full details
 * This is the main entry point for StoreKit 2 verification
 */
export async function verifyTransaction(transactionId: string): Promise<{
  transactionInfo: AppleTransactionInfo;
  environment: string;
  isValid: boolean;
}> {
  console.log(`[Apple API] Verifying transaction: ${transactionId}`);

  try {
    // First try production
    const transactionInfo = await getTransactionInfo(transactionId, false);
    
    return {
      transactionInfo,
      environment: transactionInfo.environment || "Production",
      isValid: true,
    };
  } catch (error) {
    console.error("[Apple API] Verification error:", error);
    throw error;
  }
}

/**
 * Map Apple subscription status code to our status
 * 1 = Active, 2 = Expired, 3 = Billing Retry, 4 = Grace Period, 5 = Revoked
 */
export function mapAppleSubscriptionStatus(appleStatus: number): "active" | "expired" | "past_due" | "cancelled" {
  switch (appleStatus) {
    case 1: // Active
    case 4: // Grace Period
      return "active";
    case 3: // Billing Retry
      return "past_due";
    case 2: // Expired
      return "expired";
    case 5: // Revoked
      return "cancelled";
    default:
      return "expired";
  }
}
