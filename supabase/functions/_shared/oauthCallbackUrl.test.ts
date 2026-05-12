import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildSupabaseFunctionCallbackUrl } from "./oauthCallbackUrl.ts";

Deno.test("buildSupabaseFunctionCallbackUrl preserves an existing callback path", () => {
  assertEquals(
    buildSupabaseFunctionCallbackUrl(
      "https://project.supabase.co/functions/v1/outlook-calendar-auth/callback?code=abc&state=xyz",
    ),
    "https://project.supabase.co/functions/v1/outlook-calendar-auth/callback",
  );
});

Deno.test("buildSupabaseFunctionCallbackUrl appends callback to function root paths", () => {
  assertEquals(
    buildSupabaseFunctionCallbackUrl(
      "https://project.supabase.co/functions/v1/outlook-calendar-auth?debug=true",
    ),
    "https://project.supabase.co/functions/v1/outlook-calendar-auth/callback",
  );
});

Deno.test("buildSupabaseFunctionCallbackUrl normalizes trailing slash callback paths", () => {
  assertEquals(
    buildSupabaseFunctionCallbackUrl(
      "https://project.supabase.co/functions/v1/outlook-calendar-auth/callback/?code=abc",
    ),
    "https://project.supabase.co/functions/v1/outlook-calendar-auth/callback",
  );
});
