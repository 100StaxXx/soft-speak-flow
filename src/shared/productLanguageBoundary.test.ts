import { describe, expect, it } from "vitest";
import { PRODUCT } from "@/config/product";
import { getSmartPrompts } from "@/components/AskMentorChat";
import { COMPANION_DIALOGUE_PACKS } from "@/config/companionDialoguePacks";
import { getPushNotificationSourceLabel } from "@/hooks/usePushNotificationsInbox";
import {
  LOCKED_COMPANION_BOND_LEVEL_DIALOGUE,
  LOCKED_COMPANION_ENCOURAGEMENT_TEMPLATES,
  LOCKED_COMPANION_GREETING_TEMPLATES,
  LOCKED_COMPANION_PERSONALITY_TRAITS,
  LOCKED_COMPANION_VOICE_GUARDRAILS,
  LOCKED_COMPANION_VOICE_STYLE,
} from "@/shared/companionChaosVoice";
import { getCompanionChatOpeningLines } from "@/shared/companionChatOpeners";
import { COMPANION_MODE_REGISTRY } from "@/shared/companionModes";
import {
  getConnectionErrorFallback,
  getFallbackResponse,
  getRateLimitFallback,
} from "@/utils/mentorFallbacks";

const GRACEWARD_LANGUAGE =
  /\b(?:christian|pray|prayer|scripture|faith|faithful|faithfulness|god|grace)\b/i;

describe("product language boundary", () => {
  it("keeps Graceward-only language out of Cosmiq fallback surfaces", () => {
    if (PRODUCT.mode !== "cosmiq") return;

    const dialogueLines = Object.values(COMPANION_DIALOGUE_PACKS)
      .flatMap((pack) => Object.values(pack))
      .flatMap((bucket) => bucket.map((line) => line.text));
    const fallbackMessages = [
      getFallbackResponse("I need a habit", "Sage", "direct").content,
      getFallbackResponse("I need motivation", "Sage", "supportive").content,
      getFallbackResponse("Help me start my day", "Sage", "direct").content,
      getFallbackResponse("Help me reflect", "Sage", "supportive").content,
      getFallbackResponse("This is hard", "Sage", "direct").content,
      getFallbackResponse("I have a goal", "Sage", "supportive").content,
      getFallbackResponse("Talk this through", "Sage", "neutral").content,
      getConnectionErrorFallback("Sage").content,
      getRateLimitFallback("Sage").content,
    ];
    const promptLines = [
      "sage",
      "lyra",
      "icon",
      "charles",
      "princess",
      "operator",
      "rival",
      "reign",
    ].flatMap((slug) => getSmartPrompts(slug, "", false, false, "cosmiq"));

    const visibleCosmiqLanguage = [
      ...getCompanionChatOpeningLines("cosmiq"),
      ...dialogueLines,
      ...fallbackMessages,
      ...promptLines,
      LOCKED_COMPANION_VOICE_STYLE,
      ...LOCKED_COMPANION_PERSONALITY_TRAITS,
      ...LOCKED_COMPANION_VOICE_GUARDRAILS,
      ...LOCKED_COMPANION_GREETING_TEMPLATES,
      ...LOCKED_COMPANION_ENCOURAGEMENT_TEMPLATES,
      JSON.stringify(LOCKED_COMPANION_BOND_LEVEL_DIALOGUE),
      JSON.stringify(COMPANION_MODE_REGISTRY),
      getPushNotificationSourceLabel("daily_pep"),
    ].join(" ");

    expect(visibleCosmiqLanguage).not.toMatch(GRACEWARD_LANGUAGE);
  });
});
