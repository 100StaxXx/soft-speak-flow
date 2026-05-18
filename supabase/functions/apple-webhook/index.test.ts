import {
  BasicConstraintsExtension,
  KeyUsageFlags,
  KeyUsagesExtension,
  X509Certificate,
  X509CertificateGenerator,
} from "https://esm.sh/@peculiar/x509@1.12.3";
import { SignJWT } from "https://esm.sh/jose@5.8.0";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertRejectsWithMessage(
  fn: () => Promise<unknown>,
  expectedMessage: string,
) {
  try {
    await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(
      message.includes(expectedMessage),
      `Expected error containing ${expectedMessage}, got ${message}`,
    );
    return;
  }

  throw new Error(`Expected rejection containing ${expectedMessage}`);
}

function bytesToBase64(bytes: ArrayBuffer) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

async function sha256Fingerprint(certificate: X509Certificate) {
  const digest = await crypto.subtle.digest("SHA-256", certificate.rawData);
  return bytesToHex(new Uint8Array(digest));
}

async function createSigningChain(now = new Date()) {
  const algorithm = { name: "ECDSA", namedCurve: "P-256" } as const;
  const signingAlgorithm = { name: "ECDSA", hash: "SHA-256" } as const;
  const notBefore = new Date(now.getTime() - 60_000);
  const notAfter = new Date(now.getTime() + 60 * 60 * 1000);

  const rootKeys = await crypto.subtle.generateKey(algorithm, true, [
    "sign",
    "verify",
  ]);
  const rootCertificate = await X509CertificateGenerator.createSelfSigned({
    name: "CN=Apple Root CA - G3",
    keys: rootKeys,
    signingAlgorithm,
    notBefore,
    notAfter,
    extensions: [
      new BasicConstraintsExtension(true, 2, true),
      new KeyUsagesExtension(
        KeyUsageFlags.keyCertSign | KeyUsageFlags.cRLSign,
        true,
      ),
    ],
  });

  const intermediateKeys = await crypto.subtle.generateKey(algorithm, true, [
    "sign",
    "verify",
  ]);
  const intermediateCertificate = await X509CertificateGenerator.create({
    subject: "CN=Apple Application Integration CA",
    issuer: rootCertificate.subject,
    publicKey: intermediateKeys.publicKey,
    signingKey: rootKeys.privateKey,
    signingAlgorithm,
    notBefore,
    notAfter,
    extensions: [
      new BasicConstraintsExtension(true, 1, true),
      new KeyUsagesExtension(
        KeyUsageFlags.keyCertSign | KeyUsageFlags.cRLSign,
        true,
      ),
    ],
  });

  const leafKeys = await crypto.subtle.generateKey(algorithm, true, [
    "sign",
    "verify",
  ]);
  const leafCertificate = await X509CertificateGenerator.create({
    subject: "CN=App Store Server Notifications",
    issuer: intermediateCertificate.subject,
    publicKey: leafKeys.publicKey,
    signingKey: intermediateKeys.privateKey,
    signingAlgorithm,
    notBefore,
    notAfter,
    extensions: [
      new BasicConstraintsExtension(false, undefined, true),
      new KeyUsagesExtension(KeyUsageFlags.digitalSignature, true),
    ],
  });

  const x5c = [
    leafCertificate,
    intermediateCertificate,
    rootCertificate,
  ].map((certificate) => bytesToBase64(certificate.rawData));

  return {
    leafKeys,
    x5c,
    rootFingerprint: await sha256Fingerprint(rootCertificate),
  };
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
Deno.env.set("APPLE_IOS_BUNDLE_ID", "com.darrylgraham.revolution");
const appleWebhookModule = await import("./index.ts");

Deno.test("verifyAppleNotification rejects JWS payloads without Apple's x5c certificate chain", async () => {
  const keys = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const token = await new SignJWT({
    notificationType: "DID_RENEW",
    data: { bundleId: "com.darrylgraham.revolution" },
  })
    .setProtectedHeader({ alg: "ES256" })
    .sign(keys.privateKey);

  await assertRejectsWithMessage(
    () =>
      appleWebhookModule.verifyAppleNotification(
        token,
        "com.darrylgraham.revolution",
        { requireBundleId: true },
      ),
    "x5c",
  );
});

Deno.test("verifyAppleNotification validates the x5c chain and bundle id", async () => {
  const now = new Date("2026-05-18T18:00:00.000Z");
  const chain = await createSigningChain(now);
  const token = await new SignJWT({
    notificationType: "DID_RENEW",
    notificationUUID: "notification-1",
    signedDate: now.getTime(),
    data: { bundleId: "com.darrylgraham.revolution" },
  })
    .setProtectedHeader({ alg: "ES256", x5c: chain.x5c })
    .sign(chain.leafKeys.privateKey);

  const payload = await appleWebhookModule.verifyAppleNotification(
    token,
    "com.darrylgraham.revolution",
    {
      now,
      requireBundleId: true,
      trustedRootFingerprints: [chain.rootFingerprint],
    },
  );

  assert(
    payload.notificationType === "DID_RENEW",
    "Expected verified Apple notification payload",
  );

  await assertRejectsWithMessage(
    () =>
      appleWebhookModule.verifyAppleNotification(token, "com.example.wrong", {
        now,
        requireBundleId: true,
        trustedRootFingerprints: [chain.rootFingerprint],
      }),
    "bundleId",
  );
});

Deno.test("handleAppleWebhookNotification records verified Apple webhook events", async () => {
  const now = new Date("2026-05-18T18:00:00.000Z");
  const chain = await createSigningChain(now);
  const transactionToken = await new SignJWT({
    transactionId: "tx-webhook-1",
    originalTransactionId: "orig-webhook-1",
    productId: "cosmiq_premium_monthly",
    bundleId: "com.darrylgraham.revolution",
    purchaseDate: Date.parse("2026-05-18T17:00:00.000Z"),
    expiresDate: Date.parse("2026-06-18T17:00:00.000Z"),
    environment: "Sandbox",
    signedDate: now.getTime(),
  })
    .setProtectedHeader({ alg: "ES256", x5c: chain.x5c })
    .sign(chain.leafKeys.privateKey);
  const signedPayload = await new SignJWT({
    notificationType: "DID_RENEW",
    notificationUUID: "notification-webhook-1",
    signedDate: now.getTime(),
    data: {
      bundleId: "com.darrylgraham.revolution",
      environment: "Sandbox",
      signedTransactionInfo: transactionToken,
    },
  })
    .setProtectedHeader({ alg: "ES256", x5c: chain.x5c })
    .sign(chain.leafKeys.privateKey);

  const webhookEvents: Record<string, unknown>[] = [];
  const processedEvents: string[] = [];
  const supabaseClient = {
    from(table: string) {
      if (table === "payment_webhook_events") {
        return {
          insert(payload: Record<string, unknown>) {
            webhookEvents.push(payload);
            return { error: null };
          },
          update() {
            return {
              eq(column: string, value: string) {
                if (column === "event_id") {
                  processedEvents.push(value);
                }
                return this;
              },
            };
          },
        };
      }

      if (table === "apple_transaction_bindings") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle() {
                    return { data: null, error: null };
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };

  const response = await appleWebhookModule.handleAppleWebhookNotification(
    new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signedPayload }),
    }),
    {
      supabaseClient,
      now,
      trustedRootFingerprints: [chain.rootFingerprint],
    },
  );

  assert(response.status === 200, `Expected 200, got ${response.status}`);
  assert(webhookEvents.length === 1, "Expected Apple webhook event insert");
  assert(
    webhookEvents[0].provider === "apple",
    `Expected apple provider, got ${webhookEvents[0].provider}`,
  );
  assert(
    webhookEvents[0].event_id === "notification-webhook-1",
    `Expected notification UUID event id, got ${webhookEvents[0].event_id}`,
  );
  assert(
    processedEvents.includes("notification-webhook-1"),
    "Expected webhook event to be marked processed",
  );
});
