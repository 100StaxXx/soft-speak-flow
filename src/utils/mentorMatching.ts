interface Mentor {
  id: string;
  slug?: string;
  name: string;
  tags: string[];
}

export interface OnboardingAnswer {
  questionId: string;
  answerId: string;
  mentorTags: string[];
}

export const ONBOARDING_QUESTIONS = [
  {
    id: 'need',
    question: 'What do you need most right now?',
    answers: [
      { id: 'discipline', text: 'Discipline and structure', mentorTags: ['darius', 'atlas', 'kai', 'stryker'] },
      { id: 'healing', text: 'Healing and emotional support', mentorTags: ['sienna', 'lumi', 'solace'] },
      { id: 'clarity', text: 'Clarity and calm', mentorTags: ['nova', 'atlas'] },
      { id: 'confidence', text: 'Confidence and motivation', mentorTags: ['eli', 'stryker'] },
    ],
  },
  {
    id: 'communication',
    question: 'How do you like to be spoken to?',
    answers: [
      { id: 'direct', text: 'Direct and straightforward', mentorTags: ['darius', 'stryker', 'kai'] },
      { id: 'gentle', text: 'Soft and gentle', mentorTags: ['sienna', 'nova', 'solace'] },
      { id: 'logical', text: 'Calm and logical', mentorTags: ['atlas', 'nova'] },
      { id: 'encouraging', text: 'Encouraging and friendly', mentorTags: ['eli', 'lumi'] },
    ],
  },
  {
    id: 'struggle',
    question: 'What are you struggling with most?',
    answers: [
      { id: 'discipline', text: 'Discipline and consistency', mentorTags: ['kai', 'darius', 'stryker', 'atlas'] },
      { id: 'anxiety', text: 'Anxiety and overthinking', mentorTags: ['nova', 'sienna', 'atlas', 'solace'] },
      { id: 'relationships', text: 'Relationships and heartbreak', mentorTags: ['lumi', 'sienna', 'solace'] },
      { id: 'confidence', text: 'Self-worth and confidence', mentorTags: ['eli', 'sienna', 'darius', 'lumi'] },
    ],
  },
  {
    id: 'intensity',
    question: 'What energy resonates with you?',
    answers: [
      { id: 'intense', text: 'High-intensity, no-nonsense', mentorTags: ['kai', 'stryker'] },
      { id: 'balanced', text: 'Balanced and steady', mentorTags: ['darius', 'atlas', 'eli', 'lumi'] },
      { id: 'soft', text: 'Gentle and calming', mentorTags: ['nova', 'sienna', 'solace'] },
    ],
  },
  {
    id: 'focus',
    question: 'What matters most to you?',
    answers: [
      { id: 'performance', text: 'Performance and achievement', mentorTags: ['stryker', 'kai', 'darius'] },
      { id: 'healing', text: 'Emotional healing', mentorTags: ['sienna', 'solace', 'lumi'] },
      { id: 'wisdom', text: 'Inner wisdom and perspective', mentorTags: ['atlas', 'solace', 'nova'] },
      { id: 'growth', text: 'Personal growth', mentorTags: ['eli', 'darius', 'lumi'] },
    ],
  },
];

export const findBestMentor = (answersOrTags: OnboardingAnswer[] | string[], mentors: Mentor[]): Mentor | null => {
  if (!mentors?.length) return null;
  
  if (typeof answersOrTags[0] === 'string') {
    const tags = answersOrTags as string[];
    let best = mentors[0];
    let high = 0;
    mentors.forEach(m => {
      const score = tags.filter(t => m.tags?.some(mt => mt.toLowerCase() === t.toLowerCase())).length;
      if (score > high) { high = score; best = m; }
    });
    return best;
  }

  const answers = answersOrTags as OnboardingAnswer[];
  const scores: Record<string, number> = {};
  mentors.forEach(m => scores[m.slug || m.id] = 0);
  const weights = [1, 1.2, 1.5, 1.8, 2];
  answers.forEach((a, i) => a.mentorTags.forEach(t => { if (scores[t] !== undefined) scores[t] += weights[i] || 1; }));
  
  let bestKey = '';
  let high = 0;
  Object.entries(scores).forEach(([k, s]) => { if (s > high) { high = s; bestKey = k; }});
  return mentors.find(m => (m.slug || m.id) === bestKey) || mentors[0];
};

export const getTopMentorMatches = (answers: OnboardingAnswer[], mentors: Mentor[]): Mentor[] => {
  if (!mentors?.length) return [];
  const scores: Record<string, number> = {};
  mentors.forEach(m => scores[m.slug || m.id] = 0);
  const weights = [1, 1.2, 1.5, 1.8, 2];
  answers.forEach((a, i) => a.mentorTags.forEach(t => { if (scores[t] !== undefined) scores[t] += weights[i] || 1; }));
  return mentors.map(m => ({ m, s: scores[m.slug || m.id] || 0 })).sort((a, b) => b.s - a.s).slice(0, 3).map(x => x.m);
};
