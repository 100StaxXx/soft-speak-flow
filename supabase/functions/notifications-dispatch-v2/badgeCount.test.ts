import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { resolveBadgeCountAfterSend } from "./badgeCount.ts";

function createBadgeClient(options: {
  badgeCount?: number | null;
  badgeError?: unknown;
}) {
  const calls: Array<Record<string, unknown>> = [];

  return {
    calls,
    rpc: (name: string, params: Record<string, unknown>) => {
      calls.push({ method: "rpc", name, params });
      return Promise.resolve({
        data: options.badgeCount ?? 0,
        error: options.badgeError ?? null,
      });
    },
  };
}

Deno.test("resolveBadgeCountAfterSend uses the canonical remaining-today count", async () => {
  const client = createBadgeClient({
    badgeCount: 4,
  });
  const now = new Date("2026-05-11T06:30:00.000Z");
  const badgeCount = await resolveBadgeCountAfterSend(
    client,
    {
      id: "queue-1",
      user_id: "user-1",
    },
    now,
  );

  assertEquals(badgeCount, 4);
  assertEquals(
    client.calls,
    [{
      method: "rpc",
      name: "get_remaining_today_badge_count",
      params: {
        p_user_id: "user-1",
        p_now: now.toISOString(),
      },
    }],
  );
});

Deno.test("resolveBadgeCountAfterSend can clear the badge when no tasks remain", async () => {
  const badgeCount = await resolveBadgeCountAfterSend(createBadgeClient({
    badgeCount: 0,
  }), {
    id: "queue-1",
    user_id: "user-1",
  });

  assertEquals(badgeCount, 0);
});

Deno.test("resolveBadgeCountAfterSend omits badge when count lookup fails", async () => {
  const badgeCount = await resolveBadgeCountAfterSend(createBadgeClient({
    badgeCount: null,
    badgeError: { message: "temporary outage" },
  }), {
    id: "queue-1",
    user_id: "user-1",
  });

  assertEquals(badgeCount, null);
});
