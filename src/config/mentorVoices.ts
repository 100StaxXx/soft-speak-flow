import { resolveMentorSlugAlias } from "@/lib/mentorRoster";

export interface MentorVoiceConfig {
  mentorSlug: string;
  mentorName: string;
  voiceName: string;
  voiceId: string;
  defaultIntensity: string;
  categories: string[];
  voiceSettings: {
    stability: number;
    similarity_boost: number;
    style_exaggeration?: number;
    speed: number;
    use_speaker_boost: boolean;
  };
}

export const mentorVoices: Record<string, MentorVoiceConfig> = {
  sage: {
    mentorSlug: "sage",
    mentorName: "The Sage",
    voiceName: "The Sage",
    voiceId: "mcuuWJIofmzgKEGk3EMA",
    defaultIntensity: "gentle",
    categories: ["clarity", "calm", "reflection"],
    voiceSettings: {
      stability: 0.72,
      similarity_boost: 0.82,
      style_exaggeration: 0.28,
      speed: 1,
      use_speaker_boost: true,
    },
  },
  lyra: {
    mentorSlug: "lyra",
    mentorName: "Lyra",
    voiceName: "Lyra",
    voiceId: "pq3wL6Xv3fuEM14W6ZCg",
    defaultIntensity: "gentle",
    categories: ["clarity", "signal", "insight"],
    voiceSettings: {
      stability: 0.74,
      similarity_boost: 0.84,
      style_exaggeration: 0.22,
      speed: 1,
      use_speaker_boost: true,
    },
  },
  icon: {
    mentorSlug: "icon",
    mentorName: "The Icon",
    voiceName: "The Icon",
    voiceId: "GaCzJ7BKVn8XQp1mZYIn",
    defaultIntensity: "medium",
    categories: ["standards", "identity", "boundaries"],
    voiceSettings: {
      stability: 0.7,
      similarity_boost: 0.84,
      style_exaggeration: 0.64,
      speed: 1,
      use_speaker_boost: true,
    },
  },
  charles: {
    mentorSlug: "charles",
    mentorName: "Charles",
    voiceName: "Charles",
    voiceId: "jRAAK67SEFE9m7ci5DhD",
    defaultIntensity: "medium",
    categories: ["accountability", "procrastination", "momentum"],
    voiceSettings: {
      stability: 0.76,
      similarity_boost: 0.86,
      style_exaggeration: 0.52,
      speed: 1,
      use_speaker_boost: true,
    },
  },
  princess: {
    mentorSlug: "princess",
    mentorName: "The Princess",
    voiceName: "The Princess",
    voiceId: "uIZsnBL0YK1S5j69bAih",
    defaultIntensity: "gentle",
    categories: ["self-care", "habits", "soft-discipline"],
    voiceSettings: {
      stability: 0.82,
      similarity_boost: 0.88,
      style_exaggeration: 0.24,
      speed: 1.12,
      use_speaker_boost: true,
    },
  },
  operator: {
    mentorSlug: "operator",
    mentorName: "The Operator",
    voiceName: "The Operator",
    voiceId: "pNInz6obpgDQGcFmaJgB",
    defaultIntensity: "high",
    categories: ["structure", "execution", "optimization"],
    voiceSettings: {
      stability: 0.58,
      similarity_boost: 0.96,
      style_exaggeration: 1,
      speed: 1,
      use_speaker_boost: true,
    },
  },
  rival: {
    mentorSlug: "rival",
    mentorName: "The Rival",
    voiceName: "The Rival",
    voiceId: "KLZOWyG48RjZkAAjuM89",
    defaultIntensity: "high",
    categories: ["competition", "performance", "intensity"],
    voiceSettings: {
      stability: 0.68,
      similarity_boost: 0.88,
      style_exaggeration: 0.84,
      speed: 1,
      use_speaker_boost: true,
    },
  },
  reign: {
    mentorSlug: "reign",
    mentorName: "Reign",
    voiceName: "Reign",
    voiceId: "GTQ4ImqrRljZAa9VJX6B",
    defaultIntensity: "high",
    categories: ["legacy", "performance", "discipline"],
    voiceSettings: {
      stability: 0.52,
      similarity_boost: 0.97,
      style_exaggeration: 1,
      speed: 1,
      use_speaker_boost: true,
    },
  },
};

export const getMentorVoiceConfig = (mentorSlug: string): MentorVoiceConfig | null => {
  const resolvedSlug = resolveMentorSlugAlias(mentorSlug);
  return resolvedSlug ? mentorVoices[resolvedSlug] ?? null : null;
};
