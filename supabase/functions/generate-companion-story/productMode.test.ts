import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

const sourcePath = new URL("./index.ts", import.meta.url);

Deno.test("companion stories preserve Graceward and installed Cosmiq product identities", async () => {
  const source = await Deno.readTextFile(sourcePath);

  assertEquals(source.includes('companion.product_mode === "cosmiq"'), true);
  assertEquals(source.includes("never say Graceward"), true);
  assertEquals(source.includes("never say Cosmiq"), true);
  assertEquals(
    source.includes("without importing Graceward-specific faith language"),
    true,
  );
});

Deno.test("companion story retries return a saved chapter before rate limiting or generation", async () => {
  const source = await Deno.readTextFile(sourcePath);

  const existingStoryLookup = source.indexOf("const { data: existingStory");
  const existingStoryReturn = source.indexOf("if (existingStory)");
  const rateLimitCheck = source.indexOf("const rateLimitResult = await checkRateLimit");
  const providerCall = source.indexOf("const aiResponse = await fetch");

  assert(existingStoryLookup >= 0);
  assert(existingStoryReturn > existingStoryLookup);
  assert(rateLimitCheck > existingStoryReturn);
  assert(providerCall > rateLimitCheck);
});
