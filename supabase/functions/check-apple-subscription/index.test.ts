function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const checkAppleSubscriptionModule = await import("./index.ts");

Deno.test("completed onboarding without stored access remains recoverable by a verified Apple trial", () => {
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
    response?.access_source === "none",
    "Expected missing backend data not to override a verified native entitlement",
  );
  assert(
    response?.status === "inactive",
    "Expected completed onboarding fallback to be inactive",
  );
});

Deno.test("an invalid session is an error, not a successful no-subscription decision", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = Deno.env.get("SUPABASE_URL");
  const originalKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.set("SUPABASE_URL", "https://subscription-check.test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-key");
  globalThis.fetch = async () => new Response(JSON.stringify({ message: "Invalid token", code: "bad_jwt" }), {
    status: 401, headers: { "Content-Type": "application/json" },
  });
  try {
    const response = await checkAppleSubscriptionModule.handleCheckAppleSubscription(new Request("https://subscription-check.test", {
      headers: { Authorization: "Bearer invalid-token" },
    }));
    assert(response.status === 401, "Failed authentication must not return a paid-access decision with status 200");
    const body = await response.json();
    assert(body.has_access === undefined, "An unknown access state must not become a false entitlement");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl) Deno.env.set("SUPABASE_URL", originalUrl); else Deno.env.delete("SUPABASE_URL");
    if (originalKey) Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", originalKey); else Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  }
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
