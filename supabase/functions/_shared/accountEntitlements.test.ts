function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const accountEntitlementsModule = await import("./accountEntitlements.ts");

Deno.test("buildAccessStateResponse denies expired active snapshots", () => {
  const response = accountEntitlementsModule.buildAccessStateResponse({
    user_id: "user-1",
    source: "promo_code",
    status: "active",
    plan: "promo",
    is_active: true,
    ends_at: "2000-01-01T00:00:00.000Z",
  });

  assert(response.has_access === false, "Expected expired snapshot to deny access");
  assert(response.subscribed === false, "Expected expired snapshot to be unsubscribed");
});

Deno.test("buildAccessStateResponse keeps future subscription snapshots active", () => {
  const response = accountEntitlementsModule.buildAccessStateResponse({
    user_id: "user-1",
    source: "subscription",
    status: "active",
    plan: "yearly",
    is_active: true,
    ends_at: "2999-01-01T00:00:00.000Z",
  });

  assert(response.has_access === true, "Expected future subscription snapshot to grant access");
  assert(response.subscribed === true, "Expected future subscription snapshot to be subscribed");
});

Deno.test("buildAccessStateResponse preserves manual active access without an end date", () => {
  const response = accountEntitlementsModule.buildAccessStateResponse({
    user_id: "user-1",
    source: "manual",
    status: "active",
    plan: "lifetime",
    is_active: true,
  });

  assert(response.has_access === true, "Expected manual active snapshot to grant access");
  assert(response.subscribed === true, "Expected manual active snapshot to count as subscribed access");
});
