import { FUNCTION_SECURITY_MATRIX } from "./functionMatrix.ts";
import { LocalSupabaseHarness, type FunctionInvocationResult } from "./localSupabase.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertStatus(
  result: FunctionInvocationResult,
  expectedStatuses: number[],
  message: string,
): void {
  if (!expectedStatuses.includes(result.status)) {
    throw new Error(
      `${message}: expected ${expectedStatuses.join(" or ")}, got ${result.status}. Body: ${result.text}`,
    );
  }
}

function userHeaders(token: string, anonKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    apikey: anonKey,
  };
}

Deno.test("edge-function security regression suite", async (t) => {
  const harness = await LocalSupabaseHarness.create();
  const normalUser = await harness.createUser("normal");
  const secondUser = await harness.createUser("second");
  const adminUser = await harness.createUser("admin", { admin: true });

  await t.step("unauthorized jwt endpoints reject anonymous and invalid tokens", async () => {
    const jwtTargets = FUNCTION_SECURITY_MATRIX.filter((target) => target.authMode === "jwt");

    for (const target of jwtTargets) {
      const anonymousResult = await harness.invokeFunction(target.name, {
        body: target.body,
        headers: harness.anonHeaders,
      });
      assertStatus(
        anonymousResult,
        [401, 403],
        `${target.name} should reject anonymous access`,
      );

      const invalidTokenResult = await harness.invokeFunction(target.name, {
        body: target.body,
        headers: {
          Authorization: "Bearer invalid.invalid.invalid",
          apikey: harness.config.anonKey,
        },
      });
      assertStatus(
        invalidTokenResult,
        [401, 403],
        `${target.name} should reject invalid bearer tokens`,
      );
    }
  });

  await t.step("service-role endpoints reject user callers and allow service auth", async () => {
    const target = FUNCTION_SECURITY_MATRIX.find((entry) => entry.authMode === "service-role");
    if (!target) {
      throw new Error("Missing service-role function target");
    }

    const anonymousResult = await harness.invokeFunction(target.name, {
      body: target.body,
      headers: harness.anonHeaders,
    });
    assertStatus(anonymousResult, [401, 403], `${target.name} should reject anonymous callers`);

    const userResult = await harness.invokeFunction(target.name, {
      body: target.body,
      headers: userHeaders(normalUser.accessToken, harness.config.anonKey),
    });
    assertStatus(userResult, [403], `${target.name} should reject normal user tokens`);

    const serviceResult = await harness.invokeFunction(target.name, {
      body: target.body,
      headers: harness.serviceHeaders,
    });
    assertStatus(serviceResult, [200], `${target.name} should allow service-role callers`);
  });

  await t.step("internal-secret endpoints reject bad keys and bad payloads", async () => {
    const target = FUNCTION_SECURITY_MATRIX.find((entry) => entry.authMode === "internal-secret");
    if (!target) {
      throw new Error("Missing internal-secret function target");
    }

    const missingSecretResult = await harness.invokeFunction(target.name, {
      body: target.body,
      headers: harness.anonHeaders,
    });
    assertStatus(
      missingSecretResult,
      [401],
      `${target.name} should reject missing internal secrets`,
    );

    const badSecretResult = await harness.invokeFunction(target.name, {
      body: target.body,
      headers: {
        ...harness.anonHeaders,
        "x-internal-key": "definitely-wrong",
      },
    });
    assertStatus(
      badSecretResult,
      [401],
      `${target.name} should reject forged internal secrets`,
    );

    const invalidPayloadResult = await harness.invokeFunction(target.name, {
      body: target.body,
      headers: {
        ...harness.anonHeaders,
        "x-internal-key": harness.config.internalFunctionSecret,
      },
    });
    assertStatus(
      invalidPayloadResult,
      [400],
      `${target.name} should validate internal-only payloads`,
    );
  });

  await t.step("hmac endpoints reject missing, stale, forged, and malformed requests", async () => {
    const target = FUNCTION_SECURITY_MATRIX.find((entry) => entry.authMode === "hmac");
    if (!target) {
      throw new Error("Missing hmac function target");
    }

    const missingHeadersResult = await harness.invokeFunction(target.name, {
      body: target.body,
      headers: harness.anonHeaders,
    });
    assertStatus(
      missingHeadersResult,
      [401],
      `${target.name} should reject unsigned requests`,
    );

    const staleBody = JSON.stringify(target.body);
    const staleTimestamp = `${Math.floor(Date.now() / 1000) - 3600}`;
    const staleSignature = await harness.signHmacHex(`${staleTimestamp}.${staleBody}`);
    const staleResult = await harness.invokeFunction(target.name, {
      rawBody: staleBody,
      headers: {
        ...harness.anonHeaders,
        "X-Signature": staleSignature,
        "X-Timestamp": staleTimestamp,
      },
    });
    assertStatus(
      staleResult,
      [401],
      `${target.name} should reject stale signed payloads`,
    );

    const currentTimestamp = `${Math.floor(Date.now() / 1000)}`;
    const badSignatureResult = await harness.invokeFunction(target.name, {
      rawBody: staleBody,
      headers: {
        ...harness.anonHeaders,
        "X-Signature": "00".repeat(32),
        "X-Timestamp": currentTimestamp,
      },
    });
    assertStatus(
      badSignatureResult,
      [401],
      `${target.name} should reject forged signatures`,
    );

    const invalidUuidBody = JSON.stringify({
      ...target.body,
      user_id: "not-a-uuid",
    });
    const validSignature = await harness.signHmacHex(`${currentTimestamp}.${invalidUuidBody}`);
    const invalidUuidResult = await harness.invokeFunction(target.name, {
      rawBody: invalidUuidBody,
      headers: {
        ...harness.anonHeaders,
        "X-Signature": validSignature,
        "X-Timestamp": currentTimestamp,
      },
    });
    assertStatus(
      invalidUuidResult,
      [400],
      `${target.name} should reject malformed identifiers after signature verification`,
    );
  });

  await t.step("public rate limits block repeat abuse on expensive public lookups", async () => {
    const target = FUNCTION_SECURITY_MATRIX.find((entry) => entry.authMode === "public-rate-limited");
    if (!target) {
      throw new Error("Missing public rate-limited function target");
    }

    const testIp = "198.51.100.42";
    await harness.seedInfluencerRateLimit(testIp, 5);

    const rateLimitedResult = await harness.invokeFunction(target.name, {
      body: target.body,
      headers: {
        ...harness.anonHeaders,
        "x-forwarded-for": testIp,
      },
    });
    assertStatus(
      rateLimitedResult,
      [429],
      `${target.name} should enforce public abuse limits`,
    );
  });

  await t.step("cross-user evolution attempts are rejected before expensive work runs", async () => {
    const result = await harness.invokeFunction("generate-companion-evolution", {
      body: { userId: secondUser.id },
      headers: userHeaders(normalUser.accessToken, harness.config.anonKey),
    });
    assertStatus(result, [403], "generate-companion-evolution should reject forged userIds");
  });

  await t.step("mentor-chat shared rate limits return 429 once the user quota is exhausted", async () => {
    await harness.seedAiRateLimit(normalUser.id, "mentor-chat", 50);

    const result = await harness.invokeFunction("mentor-chat", {
      body: {
        message: "Rate limit me",
        mentorName: "Eli",
        mentorTone: "supportive",
      },
      headers: userHeaders(normalUser.accessToken, harness.config.anonKey),
    });
    assertStatus(result, [429], "mentor-chat should block requests after the shared AI quota is exhausted");
  });

  await t.step("mentor-chat daily caps return 429 even with a valid token", async () => {
    await harness.seedMentorDailyLimit(secondUser.id, 20);

    const result = await harness.invokeFunction("mentor-chat", {
      body: {
        message: "Daily cap check",
        mentorName: "Eli",
        mentorTone: "supportive",
      },
      headers: userHeaders(secondUser.accessToken, harness.config.anonKey),
    });
    assertStatus(result, [429], "mentor-chat should enforce per-day message caps");
  });

  await t.step("companion evolution blocks expensive image generation once rate-limited", async () => {
    await harness.seedAiRateLimit(normalUser.id, "companion-evolution", 5);

    const result = await harness.invokeFunction("generate-companion-evolution", {
      body: {},
      headers: userHeaders(normalUser.accessToken, harness.config.anonKey),
    });
    assertStatus(result, [429], "generate-companion-evolution should stop once its quota is exhausted");
  });

  await t.step("verify-admin-access distinguishes admins from normal users", async () => {
    const normalResult = await harness.invokeFunction("verify-admin-access", {
      body: {},
      headers: userHeaders(normalUser.accessToken, harness.config.anonKey),
    });
    assertStatus(normalResult, [200], "verify-admin-access should respond for authenticated users");
    assert(
      normalResult.json?.isAdmin === false,
      `Expected normal user to be non-admin, got ${normalResult.text}`,
    );

    const adminResult = await harness.invokeFunction("verify-admin-access", {
      body: {},
      headers: userHeaders(adminUser.accessToken, harness.config.anonKey),
    });
    assertStatus(adminResult, [200], "verify-admin-access should respond for admins");
    assert(
      adminResult.json?.isAdmin === true,
      `Expected admin user to report isAdmin=true, got ${adminResult.text}`,
    );
  });

  await t.step("admin-only payout actions stay blocked for normal users", async () => {
    const blockedResult = await harness.invokeFunction("process-paypal-payout", {
      body: {},
      headers: userHeaders(normalUser.accessToken, harness.config.anonKey),
    });
    assertStatus(blockedResult, [403], "process-paypal-payout should reject non-admin users");

    const adminResult = await harness.invokeFunction("process-paypal-payout", {
      body: {},
      headers: userHeaders(adminUser.accessToken, harness.config.anonKey),
    });
    assertStatus(adminResult, [400], "process-paypal-payout should allow admins past auth checks");
  });
});
