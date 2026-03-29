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
Deno.env.set("GOOGLE_WEB_CLIENT_ID", "web-client-id");
Deno.env.set("GOOGLE_IOS_CLIENT_ID", "ios-client-id");

const googleNativeAuthModule = await import("./google-native-auth/index.ts");

type TestUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

const createActionLink = (email: string) =>
  `https://example.com/verify?token_hash=${encodeURIComponent(`token-${email}`)}&type=magiclink`;

function createGoogleDeps(options: {
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
    verifyIdToken: async () => options.payload,
    applyAbuseProtectionFn: async () => ({
      requestId: "req-google-1",
      ipAddress: "203.0.113.15",
      protection: null,
    }),
  };

  return { deps, calls };
}

const makeRequest = (body: Record<string, unknown>) =>
  new Request("https://example.com/functions/v1/google-native-auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

Deno.test("google-native-auth reuses an existing account during sign-in", async () => {
  const { deps, calls } = createGoogleDeps({
    users: [
      {
        id: "user-1",
        email: "old@example.com",
        user_metadata: { google_user_id: "google-sub-1" },
      },
    ],
    payload: {
      sub: "google-sub-1",
      email: "new@example.com",
      iat: Math.floor(Date.now() / 1000),
    },
  });

  const response = await googleNativeAuthModule.handleGoogleNativeAuth(
    makeRequest({
      idToken: "google-token",
      intent: "sign_in",
    }),
    deps,
  );

  const body = await response.json();
  assertEquals(response.status, 200, "Expected sign-in to succeed");
  assertEquals(calls.createUser, 0, "Expected no user creation for existing sign-in");
  assertEquals(calls.generateLinkEmails[0], "old@example.com", "Expected stored account email to be reused");
  assertEquals(body.access_token, "access-token", "Expected a session access token");
});

Deno.test("google-native-auth blocks sign-in when no existing account matches", async () => {
  const { deps, calls } = createGoogleDeps({
    users: [],
    payload: {
      sub: "google-sub-2",
      email: "new@example.com",
      iat: Math.floor(Date.now() / 1000),
    },
  });

  const response = await googleNativeAuthModule.handleGoogleNativeAuth(
    makeRequest({
      idToken: "google-token",
      intent: "sign_in",
    }),
    deps,
  );

  const body = await response.json();
  assertEquals(response.status, 404, "Expected unmatched sign-in to be blocked");
  assertEquals(body.code, "ACCOUNT_NOT_FOUND", "Expected account-not-found response");
  assertEquals(calls.createUser, 0, "Expected blocked sign-in not to create users");
});

Deno.test("google-native-auth creates a new account during sign-up when no match exists", async () => {
  const { deps, calls } = createGoogleDeps({
    users: [],
    payload: {
      sub: "google-sub-3",
      email: "new@example.com",
      name: "New User",
      picture: "https://example.com/avatar.png",
      iat: Math.floor(Date.now() / 1000),
    },
    createUserResult: {
      user: { id: "new-user-1" },
    },
  });

  const response = await googleNativeAuthModule.handleGoogleNativeAuth(
    makeRequest({
      idToken: "google-token",
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

Deno.test("google-native-auth reuses an existing account during sign-up without creating a duplicate", async () => {
  const { deps, calls } = createGoogleDeps({
    users: [
      {
        id: "user-2",
        email: "existing@example.com",
        user_metadata: {},
      },
    ],
    payload: {
      sub: "google-sub-4",
      email: "existing@example.com",
      iat: Math.floor(Date.now() / 1000),
    },
  });

  const response = await googleNativeAuthModule.handleGoogleNativeAuth(
    makeRequest({
      idToken: "google-token",
      intent: "sign_up",
    }),
    deps,
  );

  assertEquals(response.status, 200, "Expected existing-user sign-up to succeed");
  assertEquals(calls.createUser, 0, "Expected no duplicate user creation");
  assertEquals(calls.updateUserById, 1, "Expected Google subject metadata to be refreshed");
});
