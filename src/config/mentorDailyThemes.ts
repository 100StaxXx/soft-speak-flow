export interface MentorDailyTheme {
  topic_category: 'discipline' | 'confidence' | 'physique' | 'focus' | 'mindset' | 'business';
  intensity: 'soft' | 'medium' | 'strong';
  triggers: string[];
}

export const mentorDailyThemes: Record<string, MentorDailyTheme[]> = {
  atlas: [
    {
      topic_category: 'focus',
      intensity: 'medium',
      triggers: ['Anxious & Overthinking', 'Feeling Stuck']
    },
    {
      topic_category: 'mindset',
      intensity: 'medium',
      triggers: ['In Transition', 'Self-Doubt']
    },
    {
      topic_category: 'business',
      intensity: 'medium',
      triggers: ['In Transition', 'Avoiding Action']
    }
  ],
  eli: [
    {
      topic_category: 'confidence',
      intensity: 'soft',
      triggers: ['Self-Doubt', 'Heavy or Low']
    },
    {
      topic_category: 'mindset',
      intensity: 'medium',
      triggers: ['Heavy or Low', 'Emotionally Hurt']
    }
  ],
  nova: [
    {
      topic_category: 'mindset',
      intensity: 'medium',
      triggers: ['Anxious & Overthinking', 'Feeling Stuck']
    },
    {
      topic_category: 'focus',
      intensity: 'medium',
      triggers: ['Avoiding Action', 'Exhausted']
    }
  ],
  sienna: [
    {
      topic_category: 'mindset',
      intensity: 'soft',
      triggers: ['Emotionally Hurt', 'Heavy or Low']
    },
    {
      topic_category: 'confidence',
      intensity: 'soft',
      triggers: ['Self-Doubt', 'Heavy or Low']
    }
  ],
  lumi: [
    {
      topic_category: 'confidence',
      intensity: 'soft',
      triggers: ['Self-Doubt', 'Anxious & Overthinking']
    },
    {
      topic_category: 'mindset',
      intensity: 'soft',
      triggers: ['Heavy or Low', 'Unmotivated']
    }
  ],
  kai: [
    {
      topic_category: 'discipline',
      intensity: 'medium',
      triggers: ['Needing Discipline', 'Unmotivated']
    },
    {
      topic_category: 'physique',
      intensity: 'medium',
      triggers: ['Unmotivated', 'Feeling Stuck']
    }
  ],
  stryker: [
    {
      topic_category: 'physique',
      intensity: 'strong',
      triggers: ['Unmotivated', 'Needing Discipline', 'Frustrated']
    },
    {
      topic_category: 'business',
      intensity: 'strong',
      triggers: ['Motivated & Ready', 'Feeling Stuck']
    }
  ],
  carmen: [
    {
      topic_category: 'discipline',
      intensity: 'strong',
      triggers: ['Avoiding Action', 'Needing Discipline']
    },
    {
      topic_category: 'business',
      intensity: 'strong',
      triggers: ['In Transition', 'Feeling Stuck']
    }
  ],
  reign: [
    {
      topic_category: 'physique',
      intensity: 'strong',
      triggers: ['Unmotivated', 'Needing Discipline', 'Frustrated']
    },
    {
      topic_category: 'business',
      intensity: 'strong',
      triggers: ['Motivated & Ready', 'Feeling Stuck']
    },
    {
      topic_category: 'discipline',
      intensity: 'strong',
      triggers: ['Avoiding Action', 'Needing Discipline']
    }
  ],
  elizabeth: [
    {
      topic_category: 'confidence',
      intensity: 'medium',
      triggers: ['Self-Doubt', 'Feeling Stuck']
    },
    {
      topic_category: 'mindset',
      intensity: 'medium',
      triggers: ['Heavy or Low', 'Unmotivated']
    }
  ]
};

export const MENTOR_SLUGS = [
  'atlas',
  'eli',
  'nova',
  'sienna',
  'lumi',
  'kai',
  'stryker',
  'carmen',
  'reign',
  'elizabeth'
] as const;
