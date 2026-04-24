import {
  assert,
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  CampaignLifecycleStatusSchema,
  isCompanionCampaignLifecycleStatus,
} from "./types.ts";

Deno.test("campaign lifecycle status guard only accepts supported statuses", () => {
  for (const status of ["active", "completed", "abandoned"] as const) {
    assertEquals(CampaignLifecycleStatusSchema.parse(status), status);
    assert(isCompanionCampaignLifecycleStatus(status));
  }

  assertThrows(() => CampaignLifecycleStatusSchema.parse("needs_adjustment"));
  assert(!isCompanionCampaignLifecycleStatus("needs_adjustment"));
});
