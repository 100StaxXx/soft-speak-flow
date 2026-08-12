import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

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
