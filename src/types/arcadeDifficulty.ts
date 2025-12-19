// Shared difficulty types for Astral Arcade games

export type ArcadeDifficulty = 'beginner' | 'easy' | 'medium' | 'hard' | 'master';

export const DIFFICULTY_ORDER: ArcadeDifficulty[] = ['beginner', 'easy', 'medium', 'hard', 'master'];

export const DIFFICULTY_LABELS: Record<ArcadeDifficulty, { 
  label: string; 
  color: string; 
  bgColor: string;
  description: string;
}> = {
  beginner: { 
    label: 'Beginner', 
    color: 'from-blue-400 to-cyan-400',
    bgColor: 'bg-blue-500/20 border-blue-500/40',
    description: 'Learn the basics'
  },
  easy: { 
    label: 'Easy', 
    color: 'from-green-400 to-emerald-400',
    bgColor: 'bg-green-500/20 border-green-500/40',
    description: 'Relaxed pace'
  },
  medium: { 
    label: 'Medium', 
    color: 'from-yellow-400 to-orange-400',
    bgColor: 'bg-yellow-500/20 border-yellow-500/40',
    description: 'Standard challenge'
  },
  hard: { 
    label: 'Hard', 
    color: 'from-red-400 to-pink-400',
    bgColor: 'bg-red-500/20 border-red-500/40',
    description: 'For skilled players'
  },
  master: { 
    label: 'Master', 
    color: 'from-purple-400 to-violet-400',
    bgColor: 'bg-purple-500/20 border-purple-500/40',
    description: 'Ultimate test'
  },
};

// Get the next difficulty level (for recommendations)
export const getNextDifficulty = (current: ArcadeDifficulty): ArcadeDifficulty | null => {
  const idx = DIFFICULTY_ORDER.indexOf(current);
  if (idx < DIFFICULTY_ORDER.length - 1) {
    return DIFFICULTY_ORDER[idx + 1];
  }
  return null;
};

// Get the previous difficulty level
export const getPrevDifficulty = (current: ArcadeDifficulty): ArcadeDifficulty | null => {
  const idx = DIFFICULTY_ORDER.indexOf(current);
  if (idx > 0) {
    return DIFFICULTY_ORDER[idx - 1];
  }
  return null;
};
