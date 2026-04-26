import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { cacheGeneratedCompanionNameIfUncustomized } from "./nameCache.ts";

function createSupabaseMock() {
  const calls: Array<Record<string, unknown>> = [];

  const builder = {
    update(payload: Record<string, unknown>) {
      calls.push({ method: "update", payload });
      return builder;
    },
    eq(column: string, value: unknown) {
      calls.push({ method: "eq", column, value });
      return builder;
    },
    is(column: string, value: unknown) {
      calls.push({ method: "is", column, value });
      return builder;
    },
    then(
      resolve: (value: { error: null }) => unknown,
      reject?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve({ error: null }).then(resolve, reject);
    },
  };

  return {
    calls,
    client: {
      from(table: string) {
        calls.push({ method: "from", table });
        return builder;
      },
    },
  };
}

Deno.test("cacheGeneratedCompanionNameIfUncustomized caches generated name behind custom-name null guard", async () => {
  const supabase = createSupabaseMock();

  const didCache = await cacheGeneratedCompanionNameIfUncustomized({
    supabase: supabase.client,
    companionId: "companion-1",
    creatureName: "  Nova  ",
  });

  assertEquals(didCache, true);
  assertEquals(supabase.calls, [
    { method: "from", table: "user_companion" },
    { method: "update", payload: { cached_creature_name: "Nova" } },
    { method: "eq", column: "id", value: "companion-1" },
    { method: "is", column: "companion_name", value: null },
  ]);
});

Deno.test("cacheGeneratedCompanionNameIfUncustomized skips blank generated names", async () => {
  const supabase = createSupabaseMock();

  const didCache = await cacheGeneratedCompanionNameIfUncustomized({
    supabase: supabase.client,
    companionId: "companion-1",
    creatureName: "   ",
  });

  assertEquals(didCache, false);
  assertEquals(supabase.calls, []);
});
