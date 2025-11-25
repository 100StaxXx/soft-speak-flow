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
    mentorName: "George",
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
  darius: {
    mentorSlug: "darius",
    mentorName: "Brian",
    voiceName: "Brian",
    voiceId: "rWyjfFeMZ6PxkHqD3wGC",
    defaultIntensity: "high",
    categories: ["discipline", "tough-love", "accountability"],
    voiceSettings: {
      stability: 0.8,
      similarity_boost: 0.9,
      style_exaggeration: 0.7,
      use_speaker_boost: true,
    },
  },
  eli: {
    mentorSlug: "eli",
    mentorName: "Chris",
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
  nova: {
    mentorSlug: "nova",
    mentorName: "Daniel",
    voiceName: "Daniel",
    voiceId: "onwK4e9ZLuTAKqWW03F9",
    defaultIntensity: "medium",
    categories: ["innovation", "creativity", "vision"],
    voiceSettings: {
      stability: 0.65,
      similarity_boost: 0.75,
      style_exaggeration: 0.6,
      use_speaker_boost: true,
    },
  },
  sienna: {
    mentorSlug: "sienna",
    mentorName: "Charlotte",
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
  lumi: {
    mentorSlug: "lumi",
    mentorName: "Sarah",
    voiceName: "Sarah",
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    defaultIntensity: "gentle",
    categories: ["mindfulness", "peace", "balance"],
    voiceSettings: {
      stability: 0.75,
      similarity_boost: 0.8,
      style_exaggeration: 0.2,
      use_speaker_boost: true,
    },
  },
  kai: {
    mentorSlug: "kai",
    mentorName: "Callum",
    voiceName: "Callum",
    voiceId: "N2lVS1w4EtoT3dr4eOWO",
    defaultIntensity: "high",
    categories: ["energy", "action", "momentum"],
    voiceSettings: {
      stability: 0.7,
      similarity_boost: 0.85,
      style_exaggeration: 0.8,
      use_speaker_boost: true,
    },
  },
  stryker: {
    mentorSlug: "stryker",
    mentorName: "Rich",
    voiceName: "Rich",
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
  solace: {
    mentorSlug: "solace",
    mentorName: "Lily",
    voiceName: "Lily",
    voiceId: "pFZP5JQG7iQjIQuC4Bku",
    defaultIntensity: "gentle",
    categories: ["comfort", "understanding", "empathy"],
    voiceSettings: {
      stability: 0.8,
      similarity_boost: 0.85,
      style_exaggeration: 0.2,
      use_speaker_boost: true,
    },
  },
};

export const getMentorVoiceConfig = (mentorSlug: string): MentorVoiceConfig | null => {
  return mentorVoices[mentorSlug] || null;
};
