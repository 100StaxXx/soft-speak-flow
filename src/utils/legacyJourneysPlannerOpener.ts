const LEGACY_JOURNEYS_PLANNER_OPENERS = new Set([
  "the road's open. what are we setting in motion?",
]);

const normalizeLegacyJourneysPlannerText = (value: string) =>
  value
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export const isLegacyJourneysPlannerOpener = (
  message: {
    role: "assistant" | "user";
    content: string;
  },
) =>
  message.role === "assistant"
  && LEGACY_JOURNEYS_PLANNER_OPENERS.has(
    normalizeLegacyJourneysPlannerText(message.content),
  );

export const stripLegacyJourneysPlannerOpeners = <
  T extends {
    role: "assistant" | "user";
    content: string;
  },
>(messages: T[]) =>
  messages.filter((message) => !isLegacyJourneysPlannerOpener(message));
