import { createSignedOAuthState, verifySignedOAuthState } from "./oauthState.ts";

function assert(condition: unknown, message = "Assertion failed"): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals(actual: unknown, expected: unknown, message = "Expected values to be equal"): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

async function assertRejects(fn: () => Promise<unknown>, expectedMessage: string): Promise<void> {
  try {
    await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(expectedMessage)) {
      throw new Error(`Expected error message to include "${expectedMessage}", got "${message}"`);
    }
    return;
  }

  throw new Error("Expected promise to reject");
}

Deno.test("oauthState creates and verifies signed state payloads", async () => {
  const state = await createSignedOAuthState({
    provider: "google",
    userId: "user-1",
    syncMode: "full_sync",
    secret: "test-secret",
  });

  const payload = await verifySignedOAuthState({
    state,
    provider: "google",
    secret: "test-secret",
  });

  assertEquals(payload.provider, "google");
  assertEquals(payload.userId, "user-1");
  assertEquals(payload.syncMode, "full_sync");
  assert(payload.exp > Math.floor(Date.now() / 1000));
});

Deno.test("oauthState rejects tampered signatures", async () => {
  const state = await createSignedOAuthState({
    provider: "outlook",
    userId: "user-2",
    syncMode: "send_only",
    secret: "test-secret",
  });

  const parts = state.split(".");
  const tampered = `${parts[0]}.${parts[1]}x`;

  await assertRejects(
    () =>
      verifySignedOAuthState({
        state: tampered,
        provider: "outlook",
        secret: "test-secret",
      }),
    "Invalid or expired OAuth state",
  );
});

Deno.test("oauthState rejects expired state payloads", async () => {
  const expired = await createSignedOAuthState({
    provider: "google",
    userId: "user-3",
    syncMode: "send_only",
    secret: "test-secret",
    ttlSeconds: -1,
  });

  await assertRejects(
    () =>
      verifySignedOAuthState({
        state: expired,
        provider: "google",
        secret: "test-secret",
      }),
    "Invalid or expired OAuth state",
  );
});
