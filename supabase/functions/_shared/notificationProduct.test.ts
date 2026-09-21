import { composeNotificationCopy, type NotificationProductMode } from "./notificationComposer.ts";
import { createNotificationProductResolver, resolveUserProductMode } from "./notificationProduct.ts";
import { notificationTopicForProduct } from "./apns.ts";
import { resolveDeliveryCopy } from "../notifications-dispatch-v2/queueDelivery.ts";

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
}

Deno.test("non-template notifications keep their source-specific copy", () => {
  for (const notification_type of ["plan_day_overdue", "daily_quote", "contact_reminder"] as const) {
    for (const productMode of ["cosmiq", "graceward"] as const) {
      equal(resolveDeliveryCopy({ notification_type, title: "Original title", body: "Original body", payload: null }, null, productMode), { title: "Original title", body: "Original body" });
    }
  }
});

for (const productMode of ["cosmiq", "graceward"] as const) {
  Deno.test(`${productMode}: evening reminder uses only its product's copy`, () => {
    const copy = composeNotificationCopy({ type: "checkin_evening_reminder", productMode });
    equal(copy, productMode === "cosmiq"
      ? { title: "Evening reflection reminder", body: "Close the day with a quick reflection and a small reset for tomorrow." }
      : { title: "Release the day", body: "Notice grace, name what was hard, and rest in God’s care." });
  });
  Deno.test(`${productMode}: stale queue copy and spoofed payload cannot select the other product`, () => {
    const wrongMode = productMode === "cosmiq" ? "graceward" : "cosmiq";
    for (const type of ["checkin_evening_reminder", "checkin_morning_reminder", "habit_reminder", "task_start", "task_reminder"] as const) {
      const wrongCopy = composeNotificationCopy({ type, productMode: wrongMode });
      equal(resolveDeliveryCopy({ notification_type: type, ...wrongCopy, payload: { product_mode: wrongMode } }, null, productMode), composeNotificationCopy({ type, productMode }));
    }
  });
  Deno.test(`${productMode}: user-authored task and habit text is preserved`, () => {
    equal(composeNotificationCopy({ type: "task_start", productMode, payload: { task_text: "Pray with Grace", xp_reward: 5 } }).body, "Pray with Grace (+5 XP)");
    const habit = composeNotificationCopy({ type: "habit_reminder", productMode, payload: { habit_title: "Bible study" } });
    if (!habit.body.includes("Bible study")) throw new Error("User content was censored");
  });
  Deno.test(`${productMode}: daily pep title and fallback belong to its brand`, () => {
    const copy = composeNotificationCopy({ type: "daily_pep", productMode, payload: { mentor_slug: "sage" }, companion: { displayName: "Nova" } });
    equal(copy, productMode === "cosmiq"
      ? { title: "Nova has a message for you", body: "Your daily pep talk is ready." }
      : { title: "A word from Micah", body: "Your daily encouragement is ready." });
  });
  Deno.test(`${productMode}: app-specific Apple push topic`, () => {
    equal(notificationTopicForProduct(productMode), productMode === "cosmiq" ? "com.darrylgraham.revolution" : "com.darrylgraham.graceward");
  });
}

Deno.test("unknown product and payload-only product never enable Graceward templates", () => {
  equal(composeNotificationCopy({ type: "checkin_evening_reminder", payload: { product_mode: "graceward" } }), composeNotificationCopy({ type: "checkin_evening_reminder", productMode: "cosmiq" }));
});

function mockAdmin(input: { trusted?: NotificationProductMode; companion?: Record<string, unknown>; profile?: string; failure?: string; authError?: boolean }) {
  let authCalls = 0;
  return {
    authCalls: () => authCalls,
    auth: { admin: { getUserById: async () => {
      authCalls += 1;
      return { data: { user: { app_metadata: { auth_product_mode: input.trusted } } }, error: input.authError ? { message: "unavailable" } : null };
    } } },
    from(table: string) {
      const query = {
        select: () => query, eq: () => query, order: () => query, limit: () => query,
        maybeSingle: async () => ({ data: table === "user_companion" ? input.companion : { onboarding_data: { product_mode: input.profile } }, error: input.failure === table ? { message: "unavailable" } : null }),
      };
      return query;
    },
  };
}

for (const [label, input, expected] of [
  ["trusted Cosmiq overrides stale Graceward profile", { trusted: "cosmiq", companion: { product_mode: "graceward" }, profile: "graceward" }, "cosmiq"],
  ["trusted Graceward overrides stale Cosmiq companion", { trusted: "graceward", companion: { product_mode: "cosmiq" } }, "graceward"],
  ["explicit Graceward companion", { companion: { product_mode: "graceward" } }, "graceward"],
  ["legacy Cosmiq preset", { companion: { preset_id: "wolf" }, profile: "graceward" }, "cosmiq"],
  ["legacy Christian profile", { profile: "christian" }, "graceward"],
  ["unbound legacy account", {}, "cosmiq"],
] as const) {
  Deno.test(`account resolution: ${label}`, async () => equal(await resolveUserProductMode(mockAdmin(input), "test-user"), expected));
}

for (const input of [{ authError: true }, { failure: "profiles" }, { failure: "user_companion" }]) {
  Deno.test(`product lookup failure never falls back to a brand: ${JSON.stringify(input)}`, async () => {
    let rejected = false;
    try { await resolveUserProductMode(mockAdmin(input), "test-user"); } catch { rejected = true; }
    equal(rejected, true);
  });
}

Deno.test("worker resolves each user once and keeps users isolated", async () => {
  const admin = mockAdmin({ trusted: "cosmiq" });
  const resolve = createNotificationProductResolver(admin);
  equal(await Promise.all([resolve("one"), resolve("one"), resolve("two")]), ["cosmiq", "cosmiq", "cosmiq"]);
  equal(admin.authCalls(), 2);
});
