import { NOTIFICATION_COMPANION_FALLBACK_NAME } from "../_shared/companionName.ts";
import { buildProactiveNudgeCompanionIdentity } from "./companionIdentity.ts";

Deno.test("buildProactiveNudgeCompanionIdentity preserves a proper companion name", () => {
  const identity = buildProactiveNudgeCompanionIdentity("Nova");

  if (identity.companionDisplayName !== "Nova") {
    throw new Error(`Expected Nova, got ${identity.companionDisplayName}`);
  }

  if (identity.companionIdentity !== "their companion Nova") {
    throw new Error(`Expected named identity, got ${identity.companionIdentity}`);
  }
});

Deno.test("buildProactiveNudgeCompanionIdentity keeps fallback wording generic", () => {
  const identity = buildProactiveNudgeCompanionIdentity(NOTIFICATION_COMPANION_FALLBACK_NAME);

  if (identity.companionDisplayName !== NOTIFICATION_COMPANION_FALLBACK_NAME) {
    throw new Error(`Expected fallback display name, got ${identity.companionDisplayName}`);
  }

  if (identity.companionIdentity !== "their companion") {
    throw new Error(`Expected generic identity, got ${identity.companionIdentity}`);
  }
});
