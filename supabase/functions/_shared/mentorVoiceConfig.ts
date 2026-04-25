import {
  normalizeMentorSlug,
  resolveSupportedMentorSlug,
  type SupportedMentorSlug,
} from "./mentorRoster.ts";

export interface MentorVoiceConfig {
  voiceId: string;
  stability: number;
  similarity_boost: number;
  style_exaggeration: number;
  use_speaker_boost?: boolean;
}

export const ELEVENLABS_MENTOR_VOICES: Record<
  SupportedMentorSlug,
  MentorVoiceConfig
> = {
  sage: {
    voiceId: "mcuuWJIofmzgKEGk3EMA",
    stability: 0.72,
    similarity_boost: 0.82,
    style_exaggeration: 0.28,
    use_speaker_boost: true,
  },
  lyra: {
    voiceId: "fgDJOgmENIR82PueQrVs",
    stability: 0.74,
    similarity_boost: 0.84,
    style_exaggeration: 0.22,
    use_speaker_boost: true,
  },
  icon: {
    voiceId: "6p0P6gezgvY1v6xbLzmU",
    stability: 0.7,
    similarity_boost: 0.84,
    style_exaggeration: 0.64,
    use_speaker_boost: true,
  },
  charles: {
    voiceId: "wGkprrTXgBM5EC3Znt6U",
    stability: 0.76,
    similarity_boost: 0.86,
    style_exaggeration: 0.52,
    use_speaker_boost: true,
  },
  princess: {
    voiceId: "nBKdbSdaLWZTX0tYSgvZ",
    stability: 0.82,
    similarity_boost: 0.88,
    style_exaggeration: 0.24,
    use_speaker_boost: true,
  },
  operator: {
    voiceId: "pNInz6obpgDQGcFmaJgB",
    stability: 0.58,
    similarity_boost: 0.96,
    style_exaggeration: 1,
    use_speaker_boost: true,
  },
  rival: {
    voiceId: "V33LkP9pVLdcjeB2y5Na",
    stability: 0.68,
    similarity_boost: 0.88,
    style_exaggeration: 0.84,
    use_speaker_boost: true,
  },
  reign: {
    voiceId: "GTQ4ImqrRljZAa9VJX6B",
    stability: 0.52,
    similarity_boost: 0.97,
    style_exaggeration: 1,
    use_speaker_boost: true,
  },
};

export const OPENAI_TUTORIAL_VOICE_MAP: Record<SupportedMentorSlug, string> = {
  sage: "sage",
  lyra: "nova",
  icon: "nova",
  charles: "echo",
  princess: "shimmer",
  operator: "onyx",
  rival: "fable",
  reign: "fable",
};

export const resolveMentorVoiceConfig = (
  mentorSlug?: string | null,
): MentorVoiceConfig | null => {
  const normalized = normalizeMentorSlug(mentorSlug);
  if (
    normalized &&
    Object.hasOwn(ELEVENLABS_MENTOR_VOICES, normalized)
  ) {
    return ELEVENLABS_MENTOR_VOICES[normalized as SupportedMentorSlug];
  }

  const resolved = resolveSupportedMentorSlug(normalized);
  return resolved ? ELEVENLABS_MENTOR_VOICES[resolved] ?? null : null;
};

export const resolveTutorialVoice = (mentorSlug?: string | null): string => {
  const normalized = normalizeMentorSlug(mentorSlug);
  if (
    normalized &&
    Object.hasOwn(OPENAI_TUTORIAL_VOICE_MAP, normalized)
  ) {
    return OPENAI_TUTORIAL_VOICE_MAP[normalized as SupportedMentorSlug];
  }

  const resolved = resolveSupportedMentorSlug(normalized);
  return resolved ? OPENAI_TUTORIAL_VOICE_MAP[resolved] ?? "alloy" : "alloy";
};
