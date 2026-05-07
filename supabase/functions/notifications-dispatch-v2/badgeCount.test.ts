import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { resolveBadgeCountAfterSend } from "./badgeCount.ts";

function createCountClient(result: { count: number | null; error: unknown }) {
  const query = {
    select: () => query,
    eq: () => query,
    not: () => query,
    is: () => Promise.resolve(result),
  };

  return {
    from: () => query,
  };
}

Deno.test("resolveBadgeCountAfterSend includes the pending delivery in the badge count", async () => {
  const badgeCount = await resolveBadgeCountAfterSend(createCountClient({
    count: 2,
    error: null,
  }), {
    id: "queue-1",
    user_id: "user-1",
  });

  assertEquals(badgeCount, 3);
});

Deno.test("resolveBadgeCountAfterSend omits badge when count lookup fails", async () => {
  const badgeCount = await resolveBadgeCountAfterSend(createCountClient({
    count: null,
    error: { message: "temporary outage" },
  }), {
    id: "queue-1",
    user_id: "user-1",
  });

  assertEquals(badgeCount, null);
});
