function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const checkAppleSubscriptionModule = await import("./index.ts");

Deno.test("subscription check rejects a temporarily unauthenticated request instead of denying access", async () => {
  const response = await checkAppleSubscriptionModule
    .handleCheckAppleSubscription(
      new Request("http://localhost", {
        method: "POST",
        headers: { Authorization: "Bearer expired-access-token" },
      }),
      {
        createSupabaseClient: () =>
          ({
            auth: {
              getUser: async () => ({
                data: { user: null },
                error: new Error("JWT expired"),
              }),
            },
          }) as never,
      },
    );

  assert(
    response.status === 401,
    `Expected an auth failure, got ${response.status}`,
  );
  const payload = await response.json();
  assert(
    payload.error === "Unauthorized",
    `Expected Unauthorized, got ${payload.error}`,
  );
});

Deno.test("completed onboarding without stored access returns inactive manual no-access", () => {
  const response = checkAppleSubscriptionModule
    .buildCompletedOnboardingNoAccessResponse({
      onboarding_completed: true,
      onboarding_step: "complete",
      onboarding_data: { walkthrough_completed: true },
    });

  assert(
    response !== null,
    "Expected completed onboarding to return an access response",
  );
  assert(
    response?.has_access === false,
    "Expected completed onboarding fallback not to grant access",
  );
  assert(
    response?.subscribed === false,
    "Expected completed onboarding fallback not to mark subscribed",
  );
  assert(
    response?.access_source === "manual",
    "Expected completed onboarding fallback to avoid neutral recoverable no-access",
  );
  assert(
    response?.status === "inactive",
    "Expected completed onboarding fallback to be inactive",
  );
});

Deno.test("incomplete onboarding keeps neutral no-access behavior", () => {
  const response = checkAppleSubscriptionModule
    .buildCompletedOnboardingNoAccessResponse({
      onboarding_completed: true,
      onboarding_step: "companion_setup",
      onboarding_data: { walkthrough_completed: false },
    });

  assert(
    response === null,
    "Expected incomplete onboarding not to use the access fallback",
  );
});
