import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  type CompanionCinemaEnv,
  getCompanionCinemaRolloutConfig,
  hashCompanionCinemaRolloutBucket,
  isCompanionCinemaUserEligible,
} from "./companionCinemaRollout.ts";

const env = (
  values: Record<string, string | undefined>,
): CompanionCinemaEnv => ({
  get: (name) => values[name],
});

Deno.test("cinema rollout defaults off when production secrets are absent", () => {
  const config = getCompanionCinemaRolloutConfig(env({}));
  assertEquals(config.enabled, false);
  assertEquals(config.rolloutPercent, 0);
  assertEquals(isCompanionCinemaUserEligible("user-1", env({})), false);
});

Deno.test("cinema canary allowlist works while percentage rollout remains zero", () => {
  const values = env({
    COSMIQ_CINEMA_ENABLED: "true",
    COSMIQ_CINEMA_ROLLOUT_PERCENT: "0",
    COSMIQ_CINEMA_CANARY_USER_IDS: "USER-1, user-2 ",
  });
  assertEquals(isCompanionCinemaUserEligible("user-1", values), true);
  assertEquals(isCompanionCinemaUserEligible("USER-2", values), true);
  assertEquals(isCompanionCinemaUserEligible("user-3", values), false);
});

Deno.test("cinema rollout is deterministic and clamps percentage values", () => {
  const first = hashCompanionCinemaRolloutBucket("user-1");
  assertEquals(first, hashCompanionCinemaRolloutBucket("user-1"));
  assertNotEquals(first, hashCompanionCinemaRolloutBucket("user-4"));
  assertEquals(
    getCompanionCinemaRolloutConfig(env({
      COSMIQ_CINEMA_ENABLED: "yes",
      COSMIQ_CINEMA_ROLLOUT_PERCENT: "150",
    })).rolloutPercent,
    100,
  );
  assertEquals(
    isCompanionCinemaUserEligible(
      "any-user",
      env({
        COSMIQ_CINEMA_ENABLED: "true",
        COSMIQ_CINEMA_ROLLOUT_PERCENT: "100",
      }),
    ),
    true,
  );
});

Deno.test("global cinema kill switch overrides canary and percentage rollout", () => {
  const values = env({
    COSMIQ_CINEMA_ENABLED: "false",
    COSMIQ_CINEMA_ROLLOUT_PERCENT: "100",
    COSMIQ_CINEMA_CANARY_USER_IDS: "user-1",
  });
  assertEquals(isCompanionCinemaUserEligible("user-1", values), false);
});
