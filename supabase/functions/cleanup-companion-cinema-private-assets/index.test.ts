import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { handleCleanupCompanionCinemaPrivateAssets } from "./index.ts";

Deno.test("cinema cleanup endpoint rejects non-internal callers", async () => {
  const response = await handleCleanupCompanionCinemaPrivateAssets(
    new Request("https://example.test", { method: "POST" }),
  );
  assertEquals(response.status, 403);
});

Deno.test("cinema cleanup endpoint serves preflight without database access", async () => {
  const response = await handleCleanupCompanionCinemaPrivateAssets(
    new Request("https://example.test", { method: "OPTIONS" }),
  );
  assertEquals(response.status, 200);
});
