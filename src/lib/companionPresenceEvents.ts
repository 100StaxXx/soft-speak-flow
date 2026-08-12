export const COMPANION_PRESENCE_SPOKE_EVENT = "companion-presence-spoke";

export type CompanionPresenceSpeechSource =
  | "completion"
  | "living-reaction"
  | "memory"
  | "daily-question"
  | "tap"
  | "presence-bubble";

export interface CompanionPresenceSpokeDetail {
  source: CompanionPresenceSpeechSource;
  spokenAt: number;
}

export const announceCompanionPresenceSpeech = (
  source: CompanionPresenceSpeechSource,
): void => {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<CompanionPresenceSpokeDetail>(COMPANION_PRESENCE_SPOKE_EVENT, {
      detail: {
        source,
        spokenAt: Date.now(),
      },
    }),
  );
};
