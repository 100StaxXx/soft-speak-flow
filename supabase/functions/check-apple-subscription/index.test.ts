function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const checkAppleSubscriptionModule = await import("./index.ts");

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
