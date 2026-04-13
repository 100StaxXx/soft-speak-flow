import {
  buildDailyPepQueueDedupeKey,
  buildDailyQuoteQueueDedupeKey,
} from "./dedupeKeys.ts";

Deno.test("buildDailyPepQueueDedupeKey is stable across duplicate source rows", () => {
  const first = buildDailyPepQueueDedupeKey("user-1", "pep-1");
  const second = buildDailyPepQueueDedupeKey("user-1", "pep-1");

  if (first !== "daily_pep:user-1:pep-1") {
    throw new Error(`Unexpected daily pep dedupe key: ${first}`);
  }

  if (first !== second) {
    throw new Error("Expected duplicate source rows to collapse to the same daily pep dedupe key");
  }
});

Deno.test("buildDailyQuoteQueueDedupeKey is stable across duplicate source rows", () => {
  const first = buildDailyQuoteQueueDedupeKey("user-1", "quote-1");
  const second = buildDailyQuoteQueueDedupeKey("user-1", "quote-1");

  if (first !== "daily_quote:user-1:quote-1") {
    throw new Error(`Unexpected daily quote dedupe key: ${first}`);
  }

  if (first !== second) {
    throw new Error("Expected duplicate source rows to collapse to the same daily quote dedupe key");
  }
});
