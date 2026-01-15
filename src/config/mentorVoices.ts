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
    use_speaker_boost: boolean;
  };
}

export const mentorVoices: Record<string, MentorVoiceConfig> = {
  atlas: {
    mentorSlug: "atlas",
    mentorName: "Atlas",
    voiceName: "George",
    voiceId: "JBFqnCBsd6RMkjVDRZzb",
    defaultIntensity: "medium",
    categories: ["motivation", "discipline", "growth"],
    voiceSettings: {
      stability: 0.75,
      similarity_boost: 0.85,
      style_exaggeration: 0.5,
      use_speaker_boost: true,
    },
  },
  eli: {
    mentorSlug: "eli",
    mentorName: "Eli",
    voiceName: "Chris",
    voiceId: "iP95p4xoKVk53GoZ742B",
    defaultIntensity: "medium",
    categories: ["wisdom", "reflection", "growth"],
    voiceSettings: {
      stability: 0.7,
      similarity_boost: 0.8,
      style_exaggeration: 0.4,
      use_speaker_boost: true,
    },
  },
  sienna: {
    mentorSlug: "sienna",
    mentorName: "Sienna",
    voiceName: "Charlotte",
    voiceId: "XB0fDUnXU5powFXDhCwa",
    defaultIntensity: "gentle",
    categories: ["compassion", "healing", "support"],
    voiceSettings: {
      stability: 0.8,
      similarity_boost: 0.85,
      style_exaggeration: 0.3,
      use_speaker_boost: true,
    },
  },
  stryker: {
    mentorSlug: "stryker",
    mentorName: "Stryker",
    voiceName: "Adam",
    voiceId: "pNInz6obpgDQGcFmaJgB",
    defaultIntensity: "high",
    categories: ["strength", "resilience", "power"],
    voiceSettings: {
      stability: 0.85,
      similarity_boost: 0.9,
      style_exaggeration: 0.7,
      use_speaker_boost: true,
    },
  },
  carmen: {
    mentorSlug: "carmen",
    mentorName: "Carmen",
    voiceName: "Domi",
    voiceId: "AZnzlk1XvdvUeBnXmlld",
    defaultIntensity: "high",
    categories: ["discipline", "business", "confidence"],
    voiceSettings: {
      stability: 0.75,
      similarity_boost: 0.85,
      style_exaggeration: 0.7,
      use_speaker_boost: true,
    },
  },
  reign: {
    mentorSlug: "reign",
    mentorName: "Reign",
    voiceName: "Sarah",
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    defaultIntensity: "high",
    categories: ["physique", "business", "momentum"],
    voiceSettings: {
      stability: 0.65,
      similarity_boost: 0.90,
      style_exaggeration: 0.85,
      use_speaker_boost: true,
    },
  },
  solace: {
    mentorSlug: "solace",
    mentorName: "Solace",
    voiceName: "Matilda",
    voiceId: "XrExE9yKIg1WjnnlVkGX",
    defaultIntensity: "medium",
    categories: ["confidence", "support", "encouragement"],
    voiceSettings: {
      stability: 0.80,
      similarity_boost: 0.80,
      style_exaggeration: 0.35,
      use_speaker_boost: true,
    },
  },
};

export const getMentorVoiceConfig = (mentorSlug: string): MentorVoiceConfig | null => {
  return mentorVoices[mentorSlug] || null;
};
