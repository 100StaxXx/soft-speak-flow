Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const {
  buildAccessStateResponse,
  isAccountEntitlementActive,
} = await import("./accountEntitlements.ts");

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const NOW = new Date("2026-05-10T12:00:00.000Z");

const baseEntitlement = {
  user_id: "11111111-1111-4111-8111-111111111111",
  source: "subscription" as const,
  status: "active",
  plan: "monthly",
  is_active: true,
  started_at: "2026-05-01T00:00:00.000Z",
  ends_at: "2099-06-01T00:00:00.000Z",
  trial_started_at: null,
  trial_ends_at: null,
  billing_customer_id: null,
  billing_subscription_id: null,
  metadata: {},
};

Deno.test("active subscription entitlements require a future ends_at", () => {
  assert(isAccountEntitlementActive(baseEntitlement, NOW), "Expected future subscription entitlement to be active");

  const expired = {
    ...baseEntitlement,
    ends_at: "2026-05-01T00:00:00.000Z",
  };

  assert(!isAccountEntitlementActive(expired, NOW), "Expected expired subscription entitlement to be inactive");
  assert(!buildAccessStateResponse(expired).has_access, "Expected expired entitlement response to deny access");
});

Deno.test("manual entitlements may be open-ended but still honor an end date", () => {
  const openEndedManual = {
    ...baseEntitlement,
    source: "manual" as const,
    plan: null,
    ends_at: null,
  };

  assert(isAccountEntitlementActive(openEndedManual, NOW), "Expected open-ended manual entitlement to be active");

  const expiredManual = {
    ...openEndedManual,
    ends_at: "2026-05-01T00:00:00.000Z",
  };

  assert(!isAccountEntitlementActive(expiredManual, NOW), "Expected expired manual entitlement to be inactive");
});

Deno.test("trial entitlements expire using trial_ends_at", () => {
  const activeTrial = {
    ...baseEntitlement,
    source: "trial" as const,
    plan: null,
    ends_at: null,
    trial_ends_at: "2099-05-11T00:00:00.000Z",
  };

  const activeResponse = buildAccessStateResponse(activeTrial);
  assert(activeResponse.has_access, "Expected active trial to grant access");
  assert(!activeResponse.subscribed, "Expected trial access not to be treated as subscribed");

  const expiredTrial = {
    ...activeTrial,
    trial_ends_at: "2026-05-01T00:00:00.000Z",
  };

  assert(!isAccountEntitlementActive(expiredTrial, NOW), "Expected expired trial entitlement to be inactive");
});
