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
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");

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

Deno.test("auth-gateway rejects a password account bound to the other product", async () => {
  const response = await authGatewayModule.handleAuthGateway(
    new Request("https://example.com/functions/v1/auth-gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "sign_in_password",
        email: "cosmiq@example.com",
        password: "supersecret123",
        productMode: "graceward",
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
                id: "cosmiq-user",
                app_metadata: { auth_product_mode: "cosmiq" },
              },
            },
            error: null,
          }),
        },
      }),
      applyAbuseProtectionFn: async () => ({
        requestId: "req-auth-product-mismatch",
        ipAddress: "203.0.113.12",
        protection: null,
      }) as any,
    },
  );

  const body = await response.json();
  assertEquals(response.status, 403, "Expected cross-product sign-in to be rejected");
  assertEquals(body.code, "ACCOUNT_PRODUCT_MISMATCH", "Expected product mismatch error code");
  assert(!body.access_token, "Expected no session token for a cross-product account");
});

Deno.test("auth-gateway ignores editable product metadata and uses server-owned records", async () => {
  const createQuery = (data: unknown) => {
    const query: any = {
      select: () => query,
      eq: () => query,
      order: () => query,
      limit: () => query,
      maybeSingle: async () => ({ data, error: null }),
    };
    return query;
  };

  const response = await authGatewayModule.handleAuthGateway(
    new Request("https://example.com/functions/v1/auth-gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "sign_in_password",
        email: "legacy-cosmiq@example.com",
        password: "supersecret123",
        productMode: "graceward",
      }),
    }),
    {
      createAdminClient: () => ({
        auth: {
          admin: {
            getUserById: async () => ({
              data: { user: { id: "legacy-cosmiq-user", app_metadata: {} } },
              error: null,
            }),
          },
        },
        from: (table: string) => table === "user_companion"
          ? createQuery({ product_mode: "cosmiq", preset_id: "legacy-cosmiq-companion" })
          : createQuery({ onboarding_data: { product_mode: "graceward" } }),
      }),
      createAnonClient: () => ({
        auth: {
          signInWithPassword: async () => ({
            data: {
              session: {
                access_token: "access-token",
                refresh_token: "refresh-token",
              },
              user: {
                id: "legacy-cosmiq-user",
                user_metadata: { auth_product_mode: "graceward" },
              },
            },
            error: null,
          }),
        },
      }),
      applyAbuseProtectionFn: async () => ({
        requestId: "req-auth-server-owned-product",
        ipAddress: "203.0.113.14",
        protection: null,
      }) as any,
    },
  );

  const body = await response.json();
  assertEquals(response.status, 403, "Expected server-owned Cosmiq record to reject Graceward sign-in");
  assertEquals(body.code, "ACCOUNT_PRODUCT_MISMATCH", "Expected product mismatch error code");
  assert(!body.access_token, "Expected no session token when editable metadata conflicts with server records");
});

Deno.test("auth-gateway binds a new password account to its originating product", async () => {
  let boundMetadata: Record<string, unknown> | null = null;
  const response = await authGatewayModule.handleAuthGateway(
    new Request("https://example.com/functions/v1/auth-gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "sign_up_password",
        email: "new-cosmiq@example.com",
        password: "supersecret123",
        productMode: "cosmiq",
      }),
    }),
    {
      createAdminClient: () => ({
        auth: {
          admin: {
            updateUserById: async (_userId: string, attributes: { app_metadata?: Record<string, unknown> }) => {
              boundMetadata = attributes.app_metadata ?? null;
              return { data: {}, error: null };
            },
          },
        },
      }),
      createAnonClient: () => ({
        auth: {
          signUp: async () => ({
            data: {
              session: null,
              user: {
                id: "new-cosmiq-user",
                app_metadata: {},
              },
            },
            error: null,
          }),
        },
      }),
      applyAbuseProtectionFn: async () => ({
        requestId: "req-auth-product-binding",
        ipAddress: "203.0.113.13",
        protection: null,
      }) as any,
    },
  );

  assertEquals(response.status, 200, "Expected product-scoped sign-up to succeed");
  const capturedMetadata = boundMetadata as Record<string, unknown> | null;
  assert(Boolean(capturedMetadata), "Expected trusted app metadata to be updated");
  assertEquals(
    capturedMetadata?.auth_product_mode,
    "cosmiq",
    "Expected trusted app metadata to bind the account to Cosmiq",
  );
  assertEquals(
    capturedMetadata?.account_email,
    "new-cosmiq@example.com",
    "Expected the real account email to remain available in trusted metadata",
  );
});

Deno.test("auth-gateway returns a duplicate-email message for password sign-up", async () => {
  const response = await authGatewayModule.handleAuthGateway(
    new Request("https://example.com/functions/v1/auth-gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "sign_up_password",
        email: "existing@example.com",
        password: "supersecret123",
      }),
    }),
    {
      createAdminClient: () => ({}),
      createAnonClient: () => ({
        auth: {
          signUp: async () => ({
            data: { session: null, user: null },
            error: {
              code: "email_exists",
              message: "User already registered",
              status: 422,
            },
          }),
        },
      }),
      applyAbuseProtectionFn: async () => ({
        requestId: "req-auth-signup-duplicate-1",
        ipAddress: "203.0.113.15",
        protection: null,
      }) as any,
    },
  );

  const body = await response.json();
  assertEquals(response.status, 409, "Expected duplicate email sign-up to map to conflict");
  assertEquals(body.code, "EMAIL_ALREADY_REGISTERED", "Expected duplicate email code");
  assertEquals(body.error, "An account with this email already exists. Try signing in instead.", "Expected duplicate email message");
});

Deno.test("auth-gateway returns a validation message for invalid sign-up email from provider", async () => {
  const response = await authGatewayModule.handleAuthGateway(
    new Request("https://example.com/functions/v1/auth-gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "sign_up_password",
        email: "newuser@example.com",
        password: "supersecret123",
      }),
    }),
    {
      createAdminClient: () => ({}),
      createAnonClient: () => ({
        auth: {
          signUp: async () => ({
            data: { session: null, user: null },
            error: {
              code: "email_address_invalid",
              message: "Email address is invalid",
              status: 400,
            },
          }),
        },
      }),
      applyAbuseProtectionFn: async () => ({
        requestId: "req-auth-signup-invalid-email-1",
        ipAddress: "203.0.113.16",
        protection: null,
      }) as any,
    },
  );

  const body = await response.json();
  assertEquals(response.status, 400, "Expected invalid provider email to stay a bad request");
  assertEquals(body.code, "INVALID_EMAIL", "Expected invalid email code");
  assertEquals(body.error, "Enter a valid email address.", "Expected invalid email message");
});

Deno.test("auth-gateway returns a rate-limit message for throttled password sign-up", async () => {
  const response = await authGatewayModule.handleAuthGateway(
    new Request("https://example.com/functions/v1/auth-gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "sign_up_password",
        email: "newuser@example.com",
        password: "supersecret123",
      }),
    }),
    {
      createAdminClient: () => ({}),
      createAnonClient: () => ({
        auth: {
          signUp: async () => ({
            data: { session: null, user: null },
            error: {
              code: "over_request_rate_limit",
              message: "For security purposes, you can only request this after 30 seconds.",
              status: 429,
            },
          }),
        },
      }),
      applyAbuseProtectionFn: async () => ({
        requestId: "req-auth-signup-rate-limit-1",
        ipAddress: "203.0.113.17",
        protection: null,
      }) as any,
    },
  );

  const body = await response.json();
  assertEquals(response.status, 429, "Expected throttled sign-up to return 429");
  assertEquals(body.code, "SIGN_UP_RATE_LIMITED", "Expected rate-limit code");
  assertEquals(body.error, "Too many sign-up attempts. Please wait a moment and try again.", "Expected rate-limit message");
});

Deno.test("auth-gateway returns service misconfigured when admin client creation fails", async () => {
  const response = await authGatewayModule.handleAuthGateway(
    new Request("https://example.com/functions/v1/auth-gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "sign_up_password",
        email: "newuser@example.com",
        password: "supersecret123",
      }),
    }),
    {
      createAdminClient: () => {
        throw new Error("service role missing");
      },
      createAnonClient: () => ({
        auth: {
          signUp: async () => ({
            data: { session: null, user: null },
            error: null,
          }),
        },
      }),
      applyAbuseProtectionFn: async () => ({
        requestId: "req-auth-misconfigured-1",
        ipAddress: "203.0.113.14",
        protection: null,
      }) as any,
    },
  );

  const body = await response.json();
  assertEquals(response.status, 500, "Expected misconfigured admin client to fail closed");
  assertEquals(body.code, "SERVICE_MISCONFIGURED", "Expected safe misconfiguration code");
  assert(typeof body.requestId === "string" && body.requestId.length > 0, "Expected requestId in body");
  assertEquals(response.headers.get("X-Request-Id"), body.requestId, "Expected requestId header to match body");
});

Deno.test("auth-gateway returns abuse check failed when limiter storage is unavailable", async () => {
  const response = await authGatewayModule.handleAuthGateway(
    new Request("https://example.com/functions/v1/auth-gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "sign_up_password",
        email: "newuser@example.com",
        password: "supersecret123",
      }),
    }),
    {
      createAdminClient: () => ({}),
      createAnonClient: () => ({
        auth: {
          signUp: async () => ({
            data: { session: null, user: null },
            error: null,
          }),
        },
      }),
      applyAbuseProtectionFn: async () => new Response(JSON.stringify({
        error: "Request could not be processed right now",
        code: "ABUSE_CHECK_FAILED",
        requestId: "req-auth-abuse-failed-1",
      }), {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": "req-auth-abuse-failed-1",
        },
      }),
    },
  );

  const body = await response.json();
  assertEquals(response.status, 503, "Expected limiter failure to fail closed");
  assertEquals(body.code, "ABUSE_CHECK_FAILED", "Expected safe abuse-check error code");
  assertEquals(body.requestId, "req-auth-abuse-failed-1", "Expected requestId in body");
  assertEquals(response.headers.get("X-Request-Id"), "req-auth-abuse-failed-1", "Expected requestId header");
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

Deno.test("auth-gateway forwards reset password redirects", async () => {
  let abuseChecks = 0;
  let capturedEmail = "";
  let capturedRedirectTo = "";

  const response = await authGatewayModule.handleAuthGateway(
    new Request("https://example.com/functions/v1/auth-gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reset_password",
        email: "ResetMe@example.com",
        redirectTo: "https://app.cosmiq.quest/auth/reset-password",
      }),
    }),
    {
      createAdminClient: () => ({}),
      createAnonClient: () => ({
        auth: {
          resetPasswordForEmail: async (email: string, options: { redirectTo?: string }) => {
            capturedEmail = email;
            capturedRedirectTo = options.redirectTo ?? "";
            return { error: null };
          },
        },
      }),
      applyAbuseProtectionFn: async () => {
        abuseChecks += 1;
        return {
          requestId: "req-auth-reset-1",
          ipAddress: "203.0.113.12",
          protection: null,
        } as any;
      },
    },
  );

  const body = await response.json();
  assertEquals(response.status, 200, "Expected reset password request to succeed");
  assertEquals(abuseChecks, 1, "Expected one abuse check for reset password");
  assertEquals(capturedEmail, "resetme@example.com", "Expected reset email to be normalized");
  assertEquals(
    capturedRedirectTo,
    "https://app.cosmiq.quest/auth/reset-password",
    "Expected reset password redirect to be forwarded",
  );
  assertEquals(body.success, true, "Expected auth gateway to return a success flag");
});

Deno.test("auth-gateway returns safe error when reset password provider call fails", async () => {
  const response = await authGatewayModule.handleAuthGateway(
    new Request("https://example.com/functions/v1/auth-gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reset_password",
        email: "resetme@example.com",
        redirectTo: "https://app.cosmiq.quest/auth/reset-password",
      }),
    }),
    {
      createAdminClient: () => ({}),
      createAnonClient: () => ({
        auth: {
          resetPasswordForEmail: async () => ({
            error: new Error("provider down"),
          }),
        },
      }),
      applyAbuseProtectionFn: async () => ({
        requestId: "req-auth-reset-2",
        ipAddress: "203.0.113.13",
        protection: null,
      }) as any,
    },
  );

  const body = await response.json();
  assertEquals(response.status, 500, "Expected reset password provider failure to be sanitized");
  assertEquals(body.code, "RESET_PASSWORD_FAILED", "Expected a safe reset password failure code");
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
