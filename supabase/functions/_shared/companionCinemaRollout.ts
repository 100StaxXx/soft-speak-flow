export interface CompanionCinemaEnv {
  get(name: string): string | undefined;
}

export interface CompanionCinemaRolloutConfig {
  enabled: boolean;
  rolloutPercent: number;
  canaryUserIds: ReadonlySet<string>;
}

const FALSE_VALUES = new Set(["0", "false", "off", "no"]);
const TRUE_VALUES = new Set(["1", "true", "on", "yes"]);

const readBoolean = (value: string | undefined, fallback: boolean): boolean => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return fallback;
  if (FALSE_VALUES.has(normalized)) return false;
  if (TRUE_VALUES.has(normalized)) return true;
  return fallback;
};

const readPercent = (value: string | undefined): number => {
  const parsed = Number.parseInt(value?.trim() ?? "", 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, parsed));
};

const readCanaryUserIds = (value: string | undefined): ReadonlySet<string> =>
  new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );

export const hashCompanionCinemaRolloutBucket = (value: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 100;
};

export const getCompanionCinemaRolloutConfig = (
  env: CompanionCinemaEnv = Deno.env,
): CompanionCinemaRolloutConfig => ({
  // Spending must never start merely because new functions were deployed.
  enabled: readBoolean(env.get("COSMIQ_CINEMA_ENABLED"), false),
  rolloutPercent: readPercent(env.get("COSMIQ_CINEMA_ROLLOUT_PERCENT")),
  canaryUserIds: readCanaryUserIds(
    env.get("COSMIQ_CINEMA_CANARY_USER_IDS"),
  ),
});

export const isCompanionCinemaUserEligible = (
  userId: string | null | undefined,
  env: CompanionCinemaEnv = Deno.env,
): boolean => {
  if (!userId) return false;
  const config = getCompanionCinemaRolloutConfig(env);
  if (!config.enabled) return false;

  const normalizedUserId = userId.trim().toLowerCase();
  if (config.canaryUserIds.has(normalizedUserId)) return true;
  if (config.rolloutPercent <= 0) return false;
  if (config.rolloutPercent >= 100) return true;
  return hashCompanionCinemaRolloutBucket(normalizedUserId) <
    config.rolloutPercent;
};
