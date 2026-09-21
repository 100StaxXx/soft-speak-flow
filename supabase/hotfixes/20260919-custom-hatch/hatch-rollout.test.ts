import { isCompanionCinemaBoundaryEligible, isCompanionHatchEnabled } from "./supabase/functions/_shared/companionCinemaRollout.ts";
const env = (values: Record<string, string>) => ({ get: (key: string) => values[key] });
const assert = (value: boolean) => { if (!value) throw new Error("Assertion failed"); };
Deno.test("custom hatch remains opt-in", () => {
  assert(!isCompanionHatchEnabled(env({})));
  assert(!isCompanionCinemaBoundaryEligible("u", 1, env({})));
});
Deno.test("hatch opt-in never enables later cinema or unauthenticated work", () => {
  const flags = env({ COSMIQ_CUSTOM_HATCH_ENABLED: "true", COSMIQ_CINEMA_ENABLED: "false" });
  assert(isCompanionCinemaBoundaryEligible("u", 1, flags));
  for (const boundary of [null, 5, 13, 21, 36, 56, 81]) assert(!isCompanionCinemaBoundaryEligible("u", boundary, flags));
  assert(!isCompanionCinemaBoundaryEligible(null, 1, flags));
});
Deno.test("later cinema retains its independent rollout", () => {
  const flags = env({ COSMIQ_CINEMA_ENABLED: "true", COSMIQ_CINEMA_ROLLOUT_PERCENT: "100" });
  assert(isCompanionCinemaBoundaryEligible("u", 5, flags));
  assert(isCompanionCinemaBoundaryEligible("u", 1, flags));
});
