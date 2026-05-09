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
  speed: number;
  use_speaker_boost?: boolean;
}

export const ELEVENLABS_MENTOR_TTS_MODEL = "eleven_v3";

export const ELEVENLABS_MENTOR_VOICES: Record<
  SupportedMentorSlug,
  MentorVoiceConfig
> = {
  sage: {
    voiceId: "mcuuWJIofmzgKEGk3EMA",
    stability: 0.72,
    similarity_boost: 0.82,
    style_exaggeration: 0.28,
    speed: 1,
    use_speaker_boost: true,
  },
  lyra: {
    voiceId: "pq3wL6Xv3fuEM14W6ZCg",
    stability: 0.74,
    similarity_boost: 0.84,
    style_exaggeration: 0.22,
    speed: 1,
    use_speaker_boost: true,
  },
  icon: {
    voiceId: "GaCzJ7BKVn8XQp1mZYIn",
    stability: 0.7,
    similarity_boost: 0.84,
    style_exaggeration: 0.64,
    speed: 1,
    use_speaker_boost: true,
  },
  charles: {
    voiceId: "jRAAK67SEFE9m7ci5DhD",
    stability: 0.76,
    similarity_boost: 0.86,
    style_exaggeration: 0.52,
    speed: 1,
    use_speaker_boost: true,
  },
  princess: {
    voiceId: "uIZsnBL0YK1S5j69bAih",
    stability: 0.82,
    similarity_boost: 0.88,
    style_exaggeration: 0.24,
    speed: 1.2,
    use_speaker_boost: true,
  },
  operator: {
    voiceId: "pNInz6obpgDQGcFmaJgB",
    stability: 0.58,
    similarity_boost: 0.96,
    style_exaggeration: 1,
    speed: 1,
    use_speaker_boost: true,
  },
  rival: {
    voiceId: "KLZOWyG48RjZkAAjuM89",
    stability: 0.68,
    similarity_boost: 0.88,
    style_exaggeration: 0.84,
    speed: 1,
    use_speaker_boost: true,
  },
  reign: {
    voiceId: "GTQ4ImqrRljZAa9VJX6B",
    stability: 0.52,
    similarity_boost: 0.97,
    style_exaggeration: 1,
    speed: 1,
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
