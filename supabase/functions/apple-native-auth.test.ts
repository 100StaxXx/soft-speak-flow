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

const appleNativeAuthModule = await import("./apple-native-auth/index.ts");

type TestUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

const createActionLink = (email: string) =>
  `https://example.com/verify?token_hash=${encodeURIComponent(`token-${email}`)}&type=magiclink`;

function createAppleDeps(options: {
  users: TestUser[];
  payload: Record<string, unknown>;
  createUserResult?: { user?: { id: string } | null; error?: { message?: string | null } | null };
}) {
  const calls = {
    createUser: 0,
    updateUserById: 0,
    generateLinkEmails: [] as string[],
  };

  const deps = {
    createAdminClient: () => ({
      auth: {
        admin: {
          listUsers: async () => ({
            data: { users: options.users },
            error: null,
          }),
          createUser: async ({ email }: { email: string }) => {
            calls.createUser += 1;
            return {
              data: { user: options.createUserResult?.user ?? { id: "created-user-1" } },
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
    verifyIdentityToken: async () => options.payload,
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
        user_metadata: { apple_user_id: "apple-sub-1" },
      },
    ],
    payload: {
      sub: "apple-sub-1",
      email: "user@example.com",
      nonce: "hashed-nonce",
    },
  });

  const response = await appleNativeAuthModule.handleAppleNativeAuth(
    makeRequest({
      identityToken: "identity-token",
      rawNonce: "raw-nonce",
      intent: "sign_in",
    }),
    deps,
  );

  const body = await response.json();
  assertEquals(response.status, 200, "Expected sign-in to succeed");
  assertEquals(calls.createUser, 0, "Expected no user creation for existing sign-in");
  assertEquals(body.access_token, "access-token", "Expected a session access token");
});

Deno.test("apple-native-auth blocks sign-in when no existing account matches", async () => {
  const { deps, calls } = createAppleDeps({
    users: [],
    payload: {
      sub: "apple-sub-2",
      email: "new@example.com",
      nonce: "hashed-nonce",
    },
  });

  const response = await appleNativeAuthModule.handleAppleNativeAuth(
    makeRequest({
      identityToken: "identity-token",
      rawNonce: "raw-nonce",
      intent: "sign_in",
    }),
    deps,
  );

  const body = await response.json();
  assertEquals(response.status, 404, "Expected unmatched sign-in to be blocked");
  assertEquals(body.code, "ACCOUNT_NOT_FOUND", "Expected account-not-found response");
  assertEquals(calls.createUser, 0, "Expected blocked sign-in not to create users");
});

Deno.test("apple-native-auth creates a new account during sign-up when no match exists", async () => {
  const { deps, calls } = createAppleDeps({
    users: [],
    payload: {
      sub: "apple-sub-3",
      email: "new@example.com",
      nonce: "hashed-nonce",
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
    }),
    deps,
  );

  const body = await response.json();
  assertEquals(response.status, 200, "Expected sign-up to succeed");
  assertEquals(calls.createUser, 1, "Expected sign-up to create a user");
  assertEquals(calls.generateLinkEmails[0], "new@example.com", "Expected magic link to target the new email");
  assertEquals(body.refresh_token, "refresh-token", "Expected a session refresh token");
});

Deno.test("apple-native-auth reuses an existing account during sign-up without creating a duplicate", async () => {
  const { deps, calls } = createAppleDeps({
    users: [
      {
        id: "user-2",
        email: "existing@example.com",
        user_metadata: {},
      },
    ],
    payload: {
      sub: "apple-sub-4",
      email: "existing@example.com",
      nonce: "hashed-nonce",
    },
  });

  const response = await appleNativeAuthModule.handleAppleNativeAuth(
    makeRequest({
      identityToken: "identity-token",
      rawNonce: "raw-nonce",
      intent: "sign_up",
    }),
    deps,
  );

  assertEquals(response.status, 200, "Expected existing-user sign-up to succeed");
  assertEquals(calls.createUser, 0, "Expected no duplicate user creation");
  assertEquals(calls.updateUserById, 1, "Expected Apple subject metadata to be refreshed");
});
