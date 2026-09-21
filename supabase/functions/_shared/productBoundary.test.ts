function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const boundary = await import("./productBoundary.ts");

Deno.test("product boundary rejects trusted accounts from the other app", () => {
  let rejected = false;
  try {
    boundary.assertUserProductBoundary(
      { app_metadata: { auth_product_mode: "cosmiq" } },
      "graceward",
    );
  } catch (error) {
    rejected = error instanceof Error &&
      error.message === boundary.ACCOUNT_PRODUCT_MISMATCH_ERROR;
  }
  assert(rejected, "Expected trusted Cosmiq account to be rejected by Graceward");
});

Deno.test("product boundary rejects callback origins from the other app", () => {
  let rejected = false;
  try {
    boundary.assertRedirectProductBoundary(
      "https://app.cosmiq.quest/calendar/oauth/callback",
      "graceward",
    );
  } catch (error) {
    rejected = error instanceof Error &&
      error.message === boundary.REDIRECT_PRODUCT_MISMATCH_ERROR;
  }
  assert(rejected, "Expected Cosmiq callback URI to be rejected by Graceward");

  boundary.assertRedirectProductBoundary(
    "https://graceward.app/calendar/oauth/callback",
    "graceward",
  );
});

Deno.test("user product resolution prefers trusted account metadata", async () => {
  const client = createResolverClient({
    trustedMode: "graceward",
    companion: { product_mode: "cosmiq", preset_id: "fox" },
  });
  const mode = await boundary.resolveUserProductMode(client, "user-1");
  assert(mode === "graceward", "Expected trusted account mode to win");
});

Deno.test("user product resolution preserves legacy Cosmiq as the safe default", async () => {
  const mode = await boundary.resolveUserProductMode(createResolverClient({}), "user-1");
  assert(mode === "cosmiq", "Expected unbound legacy accounts to default to Cosmiq");
});

Deno.test("user product resolution fails closed when trusted auth lookup fails", async () => {
  const client = createResolverClient({ authError: "auth unavailable" });
  let rejected = false;
  try {
    await boundary.resolveUserProductMode(client, "user-1");
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("auth unavailable");
  }
  assert(rejected, "Expected auth lookup errors to stop product resolution");
});

Deno.test("user product resolution fails closed when data binding lookup fails", async () => {
  const client = createResolverClient({ companionError: "database unavailable" });
  let rejected = false;
  try {
    await boundary.resolveUserProductMode(client, "user-1");
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("database unavailable");
  }
  assert(rejected, "Expected binding lookup errors to stop product resolution");
});

function createResolverClient(options: {
  trustedMode?: "graceward" | "cosmiq";
  companion?: Record<string, unknown> | null;
  profile?: Record<string, unknown> | null;
  authError?: string;
  companionError?: string;
  profileError?: string;
}) {
  const rowResult = (data: unknown, error?: string) => ({
    select: () => ({
      eq: () => ({
        order: () => ({
          limit: () => ({
            maybeSingle: async () => ({ data, error: error ? { message: error } : null }),
          }),
        }),
        maybeSingle: async () => ({ data, error: error ? { message: error } : null }),
      }),
    }),
  });

  return {
    auth: {
      admin: {
        getUserById: async () => ({
          data: {
            user: options.trustedMode
              ? { app_metadata: { auth_product_mode: options.trustedMode } }
              : null,
          },
          error: options.authError ? { message: options.authError } : null,
        }),
      },
    },
    from: (table: string) => table === "user_companion"
      ? rowResult(options.companion ?? null, options.companionError)
      : rowResult(options.profile ?? null, options.profileError),
  };
}
