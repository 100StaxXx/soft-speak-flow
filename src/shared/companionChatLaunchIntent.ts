import type { CompanionPlannerLaunchIntent } from "@/types/companionPlanner";

export const createCompanionChatLaunchIntentId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const createJourneysCompanionChatLaunchIntent = (
  message = "What's the vibe",
): CompanionPlannerLaunchIntent => ({
  id: createCompanionChatLaunchIntentId(),
  message,
  starterIntent: "free_talk_start",
  target: "conversation",
  briefingContext: null,
});
