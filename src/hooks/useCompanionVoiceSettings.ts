import { useEffect, useMemo, useState } from "react";

import { safeLocalStorage } from "@/utils/storage";

export const COMPANION_VOICE_SETTINGS_STORAGE_KEY = "companion-chat-voice-settings-v2";
const SETTINGS_CHANGE_EVENT = "companion-chat-voice-settings-change";
const DEFAULT_AUTOPLAY_VOICE = false;
const DEFAULT_MUTE_SPOKEN_REPLIES = false;

type StoredVoiceSettings = {
  autoplayVoice?: boolean;
  muteSpokenReplies?: boolean;
};

export type CompanionVoiceSettings = {
  autoplayVoice: boolean;
  muteSpokenReplies: boolean;
};

const normalizeSettings = (
  settings: StoredVoiceSettings | CompanionVoiceSettings | null | undefined,
): CompanionVoiceSettings => ({
  autoplayVoice: settings?.autoplayVoice ?? DEFAULT_AUTOPLAY_VOICE,
  muteSpokenReplies: settings?.muteSpokenReplies ?? DEFAULT_MUTE_SPOKEN_REPLIES,
});

export const readStoredCompanionVoiceSettings = (): CompanionVoiceSettings => {
  const raw = safeLocalStorage.getItem(COMPANION_VOICE_SETTINGS_STORAGE_KEY);
  if (!raw) return normalizeSettings(undefined);

  try {
    return normalizeSettings(JSON.parse(raw) as StoredVoiceSettings);
  } catch {
    return normalizeSettings(undefined);
  }
};

export const writeStoredCompanionVoiceSettings = (
  settings: CompanionVoiceSettings,
) => {
  safeLocalStorage.setItem(COMPANION_VOICE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<CompanionVoiceSettings>(SETTINGS_CHANGE_EVENT, {
      detail: settings,
    }));
  }
};

export const useCompanionVoiceSettings = () => {
  const storedSettings = useMemo(readStoredCompanionVoiceSettings, []);
  const [autoplayVoice, setAutoplayVoice] = useState(storedSettings.autoplayVoice);
  const [muteSpokenReplies, setMuteSpokenReplies] = useState(storedSettings.muteSpokenReplies);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const applyStoredSettings = (settings?: StoredVoiceSettings | CompanionVoiceSettings) => {
      const normalizedSettings = normalizeSettings(settings);

      setAutoplayVoice((current) => (
        current === normalizedSettings.autoplayVoice ? current : normalizedSettings.autoplayVoice
      ));
      setMuteSpokenReplies((current) => (
        current === normalizedSettings.muteSpokenReplies
          ? current
          : normalizedSettings.muteSpokenReplies
      ));
    };

    const handleSettingsChange = (event: Event) => {
      const detail = event instanceof CustomEvent
        ? event.detail as CompanionVoiceSettings | undefined
        : undefined;
      applyStoredSettings(detail ?? readStoredCompanionVoiceSettings());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== COMPANION_VOICE_SETTINGS_STORAGE_KEY) return;
      applyStoredSettings(readStoredCompanionVoiceSettings());
    };

    window.addEventListener(SETTINGS_CHANGE_EVENT, handleSettingsChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(SETTINGS_CHANGE_EVENT, handleSettingsChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    const storedSettings = readStoredCompanionVoiceSettings();

    if (
      storedSettings.autoplayVoice === autoplayVoice
      && storedSettings.muteSpokenReplies === muteSpokenReplies
    ) {
      return;
    }

    writeStoredCompanionVoiceSettings({
      autoplayVoice,
      muteSpokenReplies,
    });
  }, [autoplayVoice, muteSpokenReplies]);

  return {
    autoplayVoice,
    setAutoplayVoice,
    muteSpokenReplies,
    setMuteSpokenReplies,
  };
};
