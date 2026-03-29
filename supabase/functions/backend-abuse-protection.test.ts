function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message} (expected ${expected}, got ${actual})`);
  }
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
Deno.env.set("SUPABASE_ANON_KEY", "anon-key");

const authGatewayModule = await import("./auth-gateway/index.ts");
const initUploadModule = await import("./init-quest-attachment-upload/index.ts");
const deleteUploadModule = await import("./delete-quest-attachment/index.ts");

Deno.test("auth-gateway allows normal password sign-in under limit", async () => {
  let abuseChecks = 0;

  const response = await authGatewayModule.handleAuthGateway(
    new Request("https://example.com/functions/v1/auth-gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "sign_in_password",
        email: "Test@example.com",
        password: "supersecret123",
      }),
    }),
    {
      createAdminClient: () => ({}),
      createAnonClient: () => ({
        auth: {
          signInWithPassword: async () => ({
            data: {
              session: {
                access_token: "access-token",
                refresh_token: "refresh-token",
              },
              user: {
                id: "user-1",
                email: "test@example.com",
              },
            },
            error: null,
          }),
        },
      }),
      applyAbuseProtectionFn: async () => {
        abuseChecks += 1;
        return {
          requestId: "req-auth-1",
          ipAddress: "203.0.113.10",
          protection: null,
        } as any;
      },
    },
  );

  const body = await response.json();
  assertEquals(response.status, 200, "Expected sign-in to succeed");
  assertEquals(abuseChecks, 2, "Expected IP and user abuse checks");
  assertEquals(body.access_token, "access-token", "Expected auth gateway to return session access token");
  assertEquals(body.user.id, "user-1", "Expected auth gateway to return the signed-in user");
});

Deno.test("auth-gateway allows normal password sign-up under limit", async () => {
  let abuseChecks = 0;

  const response = await authGatewayModule.handleAuthGateway(
    new Request("https://example.com/functions/v1/auth-gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "sign_up_password",
        email: "NewUser@example.com",
        password: "supersecret123",
        redirectTo: "https://example.com/welcome",
        timezone: "America/Los_Angeles",
      }),
    }),
    {
      createAdminClient: () => ({}),
      createAnonClient: () => ({
        auth: {
          signUp: async ({ email, password, options }: { email: string; password: string; options: { emailRedirectTo?: string; data?: { timezone?: string } } }) => ({
            data: {
              session: null,
              user: {
                id: "new-user-1",
                email,
                user_metadata: {
                  timezone: options?.data?.timezone,
                },
              },
            },
            error: password === "supersecret123" && options?.emailRedirectTo === "https://example.com/welcome" ? null : new Error("unexpected payload"),
          }),
        },
      }),
      applyAbuseProtectionFn: async () => {
        abuseChecks += 1;
        return {
          requestId: "req-auth-signup-1",
          ipAddress: "203.0.113.11",
          protection: null,
        } as any;
      },
    },
  );

  const body = await response.json();
  assertEquals(response.status, 200, "Expected sign-up to succeed");
  assertEquals(abuseChecks, 1, "Expected one abuse check for sign-up");
  assertEquals(body.user.id, "new-user-1", "Expected auth gateway to return the created user");
  assertEquals(body.user.email, "newuser@example.com", "Expected auth gateway to normalize the email");
  assertEquals(body.requiresEmailConfirmation, true, "Expected sign-up without a session to require email confirmation");
});

Deno.test("auth-gateway blocks burst abuse before auth is attempted", async () => {
  let anonCalled = false;

  const response = await authGatewayModule.handleAuthGateway(
    new Request("https://example.com/functions/v1/auth-gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "sign_in_password",
        email: "test@example.com",
        password: "supersecret123",
      }),
    }),
    {
      createAdminClient: () => ({}),
      createAnonClient: () => {
        anonCalled = true;
        return {};
      },
      applyAbuseProtectionFn: async () => new Response(JSON.stringify({
        error: "Too many sign-in attempts. Please try again later.",
        code: "RATE_LIMITED",
        requestId: "req-auth-blocked",
        retryAfterSeconds: 900,
      }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "900",
        },
      }),
    },
  );

  const body = await response.json();
  assertEquals(response.status, 429, "Expected auth gateway to block burst abuse");
  assertEquals(body.code, "RATE_LIMITED", "Expected safe rate-limit error code");
  assert(!anonCalled, "Expected sign-in attempt to stop before provider auth");
});

Deno.test("init quest attachment upload allows normal backend-issued tickets", async () => {
  const response = await initUploadModule.handleInitQuestAttachmentUpload(
    new Request("https://example.com/functions/v1/init-quest-attachment-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: "Quest Evidence.png",
        mimeType: "image/png",
        fileSizeBytes: 2048,
      }),
    }),
    {
      requireProtectedRequestFn: async () => ({
        auth: {
          userId: "user-123",
          isServiceRole: false,
        },
        supabase: {
          storage: {
            from: () => ({
              createSignedUploadUrl: async () => ({
                data: { token: "upload-token" },
                error: null,
              }),
            }),
          },
        },
        requestId: "req-upload-1",
        ipAddress: "203.0.113.20",
        protection: null,
      }) as any,
    },
  );

  const body = await response.json();
  assertEquals(response.status, 200, "Expected upload init to succeed");
  assert(typeof body.path === "string" && body.path.startsWith("user-123/"), "Expected backend-owned storage path");
  assertEquals(body.token, "upload-token", "Expected one-time upload token");
});

Deno.test("delete quest attachment rejects path bypass attempts", async () => {
  let loggedBypass = false;

  const response = await deleteUploadModule.handleDeleteQuestAttachment(
    new Request("https://example.com/functions/v1/delete-quest-attachment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filePath: "other-user/secret-file.png",
      }),
    }),
    {
      requireProtectedRequestFn: async () => ({
        auth: {
          userId: "user-123",
          isServiceRole: false,
        },
        supabase: {
          storage: {
            from: () => ({
              remove: async () => ({ error: null }),
            }),
          },
        },
        requestId: "req-delete-1",
        ipAddress: "203.0.113.21",
        protection: null,
      }) as any,
      logBypassAttemptFn: async () => {
        loggedBypass = true;
        return new Response(JSON.stringify({
          error: "Forbidden",
          code: "FORBIDDEN",
          requestId: "req-delete-1",
        }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  );

  const body = await response.json();
  assertEquals(response.status, 403, "Expected delete handler to reject cross-user paths");
  assertEquals(body.code, "FORBIDDEN", "Expected safe bypass error code");
  assert(loggedBypass, "Expected bypass attempts to be logged");
});
