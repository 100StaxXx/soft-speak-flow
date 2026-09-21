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
Deno.env.set("APPLE_SERVICE_ID", "com.example.web");
Deno.env.set("APPLE_IOS_BUNDLE_ID", "com.darrylgraham.graceward");

const appleNativeAuthModule = await import("./apple-native-auth/index.ts");

type TestUser = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
  identities?:
    | Array<{
      id?: string | null;
      provider?: string | null;
      identity_data?: Record<string, unknown> | null;
    }>
    | null;
};

const createActionLink = (email: string) =>
  `https://example.com/verify?token_hash=${
    encodeURIComponent(`token-${email}`)
  }&type=magiclink`;

function createAppleDeps(options: {
  users: TestUser[];
  payload: Record<string, unknown>;
  createUserResult?: {
    user?: { id: string } | null;
    error?: { message?: string | null } | null;
  };
}) {
  const calls = {
    createUser: 0,
    createdUsers: [] as Array<{
      email: string;
      app_metadata?: Record<string, unknown>;
      user_metadata?: Record<string, unknown>;
    }>,
    updateUserById: 0,
    generateLinkEmails: [] as string[],
    verifyIdentityToken: [] as Array<{
      appleServiceId: string;
      iosBundleId: string;
    }>,
  };

  const deps = {
    createAdminClient: () => ({
      auth: {
        admin: {
          listUsers: async () => ({
            data: { users: options.users },
            error: null,
          }),
          createUser: async (
            input: {
              email: string;
              app_metadata?: Record<string, unknown>;
              user_metadata?: Record<string, unknown>;
            },
          ) => {
            calls.createUser += 1;
            calls.createdUsers.push(input);
            return {
              data: {
                user: options.createUserResult?.user ??
                  { id: "created-user-1" },
              },
              error: options.createUserResult?.error ?? null,
            };
          },
          updateUserById: async () => {
            calls.updateUserById += 1;
            return { error: null };
          },
          generateLink: async ({ email }: { email: string }) => {
            calls.generateLinkEmails.push(email);
            return {
              data: {
                properties: {
                  action_link: createActionLink(email),
                },
              },
              error: null,
            };
          },
        },
      },
    }),
    createAnonClient: () => ({
      auth: {
        verifyOtp: async () => ({
          data: {
            session: {
              access_token: "access-token",
              refresh_token: "refresh-token",
            },
            user: {
              id: "session-user-1",
            },
          },
          error: null,
        }),
      },
    }),
    verifyIdentityToken: async (
      _identityToken: string,
      appleServiceId: string,
      iosBundleId: string,
    ) => {
      calls.verifyIdentityToken.push({ appleServiceId, iosBundleId });
      return options.payload;
    },
    sha256HexFn: async () => "hashed-nonce",
    applyAbuseProtectionFn: async () => ({
      requestId: "req-apple-1",
      ipAddress: "203.0.113.10",
      protection: null,
    }),
  };

  return { deps, calls };
}

const makeRequest = (body: Record<string, unknown>) =>
  new Request("https://example.com/functions/v1/apple-native-auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

Deno.test("apple-native-auth reuses an existing account during sign-in", async () => {
  const { deps, calls } = createAppleDeps({
    users: [
      {
        id: "user-1",
        email: "user@example.com",
        app_metadata: {
          apple_user_id: "apple-sub-1",
          apple_audience: "com.darrylgraham.graceward",
          auth_product_mode: "graceward",
        },
      },
    ],
    payload: {
      sub: "apple-sub-1",
      email: "user@example.com",
      nonce: "hashed-nonce",
      aud: "com.darrylgraham.graceward",
    },
  });

  const response = await appleNativeAuthModule.handleAppleNativeAuth(
    makeRequest({
      identityToken: "identity-token",
      rawNonce: "raw-nonce",
      intent: "sign_in",
      productMode: "graceward",
    }),
    deps,
  );

  const body = await response.json();
  assertEquals(response.status, 200, "Expected sign-in to succeed");
  assertEquals(
    calls.createUser,
    0,
    "Expected no user creation for existing sign-in",
  );
  assertEquals(
    body.access_token,
    "access-token",
    "Expected a session access token",
  );
  assert(
    calls.verifyIdentityToken[0]?.iosBundleId === "com.darrylgraham.graceward",
    "Expected Graceward's bundle ID to be accepted",
  );
  assert(
    calls.verifyIdentityToken[0]?.iosBundleId !== "com.darrylgraham.revolution",
    "Expected Cosmiq's bundle ID to be rejected by Graceward",
  );
});

Deno.test("apple-native-auth migrates a returning legacy Apple identity when email is omitted", async () => {
  const { deps, calls } = createAppleDeps({
    users: [
      {
        id: "legacy-cosmiq-user",
        email: "returning@example.com",
        app_metadata: {
          provider: "apple",
        },
        identities: [
          {
            provider: "apple",
            identity_data: {
              sub: "legacy-apple-sub",
            },
          },
        ],
      },
    ],
    payload: {
      sub: "legacy-apple-sub",
      nonce: "hashed-nonce",
      aud: "com.darrylgraham.revolution",
    },
  });

  const response = await appleNativeAuthModule.handleAppleNativeAuth(
    makeRequest({
      identityToken: "identity-token",
      rawNonce: "raw-nonce",
      intent: "sign_in",
      productMode: "cosmiq",
    }),
    deps,
  );

  assertEquals(
    response.status,
    200,
    "Expected legacy Apple sign-in to succeed",
  );
  assertEquals(
    calls.createUser,
    0,
    "Expected the existing account to be reused",
  );
  assertEquals(
    calls.updateUserById,
    1,
    "Expected trusted Cosmiq Apple metadata to be migrated",
  );
  assertEquals(
    calls.generateLinkEmails[0],
    "returning@example.com",
    "Expected session creation to use the existing account email",
  );
});

Deno.test("apple-native-auth blocks sign-in when no existing account matches", async () => {
  const { deps, calls } = createAppleDeps({
    users: [],
    payload: {
      sub: "apple-sub-2",
      email: "new@example.com",
      nonce: "hashed-nonce",
      aud: "com.darrylgraham.graceward",
    },
  });

  const response = await appleNativeAuthModule.handleAppleNativeAuth(
    makeRequest({
      identityToken: "identity-token",
      rawNonce: "raw-nonce",
      intent: "sign_in",
      productMode: "graceward",
    }),
    deps,
  );

  const body = await response.json();
  assertEquals(
    response.status,
    404,
    "Expected unmatched sign-in to be blocked",
  );
  assertEquals(
    body.code,
    "ACCOUNT_NOT_FOUND",
    "Expected account-not-found response",
  );
  assertEquals(
    calls.createUser,
    0,
    "Expected blocked sign-in not to create users",
  );
});

Deno.test("apple-native-auth creates a new account during sign-up when no match exists", async () => {
  const { deps, calls } = createAppleDeps({
    users: [],
    payload: {
      sub: "apple-sub-3",
      email: "new@example.com",
      nonce: "hashed-nonce",
      aud: "com.darrylgraham.graceward",
    },
    createUserResult: {
      user: { id: "new-user-1" },
    },
  });

  const response = await appleNativeAuthModule.handleAppleNativeAuth(
    makeRequest({
      identityToken: "identity-token",
      rawNonce: "raw-nonce",
      intent: "sign_up",
      productMode: "graceward",
    }),
    deps,
  );

  const body = await response.json();
  assertEquals(response.status, 200, "Expected sign-up to succeed");
  assertEquals(calls.createUser, 1, "Expected sign-up to create a user");
  assertEquals(
    calls.generateLinkEmails[0],
    "new@example.com",
    "Expected magic link to target the new email",
  );
  assertEquals(
    body.refresh_token,
    "refresh-token",
    "Expected a session refresh token",
  );
});

Deno.test("apple-native-auth reuses an existing account during sign-up without creating a duplicate", async () => {
  const { deps, calls } = createAppleDeps({
    users: [
      {
        id: "user-2",
        email: "existing@example.com",
        app_metadata: { auth_product_mode: "graceward" },
      },
    ],
    payload: {
      sub: "apple-sub-4",
      email: "existing@example.com",
      nonce: "hashed-nonce",
      aud: "com.darrylgraham.graceward",
    },
  });

  const response = await appleNativeAuthModule.handleAppleNativeAuth(
    makeRequest({
      identityToken: "identity-token",
      rawNonce: "raw-nonce",
      intent: "sign_up",
      productMode: "graceward",
    }),
    deps,
  );

  assertEquals(
    response.status,
    200,
    "Expected existing-user sign-up to succeed",
  );
  assertEquals(calls.createUser, 0, "Expected no duplicate user creation");
  assertEquals(
    calls.updateUserById,
    1,
    "Expected Apple subject metadata to be refreshed",
  );
});

Deno.test("apple-native-auth does not sign Graceward into a matching Cosmiq account", async () => {
  const { deps, calls } = createAppleDeps({
    users: [
      {
        id: "cosmiq-user-1",
        email: "shared@example.com",
        user_metadata: {
          apple_user_id: "shared-apple-sub",
          apple_audience: "com.darrylgraham.revolution",
          auth_product_mode: "cosmiq",
        },
      },
    ],
    payload: {
      sub: "shared-apple-sub",
      email: "shared@example.com",
      nonce: "hashed-nonce",
      aud: "com.darrylgraham.graceward",
    },
  });

  const response = await appleNativeAuthModule.handleAppleNativeAuth(
    makeRequest({
      identityToken: "identity-token",
      rawNonce: "raw-nonce",
      intent: "sign_in",
      productMode: "graceward",
    }),
    deps,
  );

  const body = await response.json();
  assertEquals(
    response.status,
    404,
    "Expected cross-product sign-in to be blocked",
  );
  assertEquals(
    body.code,
    "ACCOUNT_NOT_FOUND",
    "Expected an account-not-found response",
  );
  assertEquals(calls.createUser, 0, "Expected no user creation during sign-in");
  assertEquals(
    calls.generateLinkEmails.length,
    0,
    "Expected no Cosmiq magic link to be generated",
  );
});

Deno.test("apple-native-auth ignores editable user metadata as an account binding", async () => {
  const { deps, calls } = createAppleDeps({
    users: [
      {
        id: "attacker-controlled-user",
        email: "different@example.com",
        user_metadata: {
          apple_user_id: "victim-apple-sub",
          apple_audience: "com.darrylgraham.graceward",
          auth_product_mode: "graceward",
        },
      },
    ],
    payload: {
      sub: "victim-apple-sub",
      nonce: "hashed-nonce",
      aud: "com.darrylgraham.graceward",
    },
  });

  const response = await appleNativeAuthModule.handleAppleNativeAuth(
    makeRequest({
      identityToken: "identity-token",
      rawNonce: "raw-nonce",
      intent: "sign_in",
      productMode: "graceward",
    }),
    deps,
  );

  const body = await response.json();
  assertEquals(
    response.status,
    404,
    "Expected untrusted metadata match to be rejected",
  );
  assertEquals(
    body.code,
    "ACCOUNT_NOT_FOUND",
    "Expected account-not-found response",
  );
  assertEquals(
    calls.generateLinkEmails.length,
    0,
    "Expected no session link to be generated",
  );
});

Deno.test("apple-native-auth creates a separate Graceward identity when Apple email belongs to Cosmiq", async () => {
  const { deps, calls } = createAppleDeps({
    users: [
      {
        id: "cosmiq-user-2",
        email: "shared@example.com",
        user_metadata: {
          apple_user_id: "shared-apple-sub",
          apple_audience: "com.darrylgraham.revolution",
          auth_product_mode: "cosmiq",
        },
      },
    ],
    payload: {
      sub: "shared-apple-sub",
      email: "shared@example.com",
      nonce: "hashed-nonce",
      aud: "com.darrylgraham.graceward",
    },
  });

  const response = await appleNativeAuthModule.handleAppleNativeAuth(
    makeRequest({
      identityToken: "identity-token",
      rawNonce: "raw-nonce",
      intent: "sign_up",
      productMode: "graceward",
    }),
    deps,
  );

  assertEquals(response.status, 200, "Expected Graceward sign-up to succeed");
  assertEquals(
    calls.createUser,
    1,
    "Expected a separate auth user to be created",
  );
  assert(
    calls.createdUsers[0]?.email.endsWith("@accounts.graceward.app"),
    "Expected a Graceward-scoped internal auth email",
  );
  assert(
    calls.createdUsers[0]?.email !== "shared@example.com",
    "Expected the Cosmiq auth email not to be reused",
  );
  assertEquals(
    calls.createdUsers[0]?.user_metadata?.account_email,
    "shared@example.com",
    "Expected the real Apple email to remain display metadata",
  );
  assertEquals(
    calls.createdUsers[0]?.app_metadata?.auth_product_mode,
    "graceward",
    "Expected the new auth identity to have a trusted Graceward binding",
  );
  assertEquals(
    calls.createdUsers[0]?.app_metadata?.account_email,
    "shared@example.com",
    "Expected the real Apple email to be stored as trusted display metadata",
  );
  assertEquals(
    calls.generateLinkEmails[0],
    calls.createdUsers[0]?.email,
    "Expected session creation to target only the Graceward auth identity",
  );
});
