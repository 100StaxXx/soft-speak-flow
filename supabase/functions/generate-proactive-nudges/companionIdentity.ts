import { NOTIFICATION_COMPANION_FALLBACK_NAME } from "../_shared/companionName.ts";

export interface ProactiveNudgeCompanionIdentity {
  companionDisplayName: string;
  companionIdentity: string;
}

export function buildProactiveNudgeCompanionIdentity(
  displayName: string | null | undefined,
): ProactiveNudgeCompanionIdentity {
  const trimmed = typeof displayName === "string" ? displayName.trim() : "";
  const companionDisplayName = trimmed || NOTIFICATION_COMPANION_FALLBACK_NAME;

  return {
    companionDisplayName,
    companionIdentity:
      companionDisplayName === NOTIFICATION_COMPANION_FALLBACK_NAME
        ? "their companion"
        : `their companion ${companionDisplayName}`,
  };
}
