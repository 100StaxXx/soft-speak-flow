import { mapWithConcurrency } from "./concurrency.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

Deno.test("mapWithConcurrency preserves order and respects its limit", async () => {
  let active = 0;
  let peak = 0;

  const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (item) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, item % 2 === 0 ? 1 : 3));
    active -= 1;
    return item * 10;
  });

  assert(
    JSON.stringify(results) === JSON.stringify([10, 20, 30, 40, 50]),
    "Expected input order to be preserved",
  );
  assert(peak === 2, `Expected peak concurrency 2, received ${peak}`);
});

Deno.test("mapWithConcurrency rejects invalid limits", async () => {
  let rejected = false;
  try {
    await mapWithConcurrency([1], 0, async (item) => item);
  } catch {
    rejected = true;
  }

  assert(rejected, "Expected a zero concurrency limit to be rejected");
});
