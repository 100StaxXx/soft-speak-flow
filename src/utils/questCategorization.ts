// Auto-categorize quests into Mind/Body/Soul based on task text
export const categorizeQuest = (taskText: string): 'mind' | 'body' | 'soul' | null => {
  const text = taskText.toLowerCase();
  
  // Mind keywords - mental, learning, planning, work, cognitive
  const mindKeywords = [
    // Learning & Education
    'read', 'study', 'learn', 'course', 'book', 'lesson', 'tutorial', 'class',
    'lecture', 'podcast', 'audiobook', 'article', 'research', 'education',
    // Work & Productivity
    'work', 'meeting', 'email', 'project', 'deadline', 'task', 'report', 'present',
    'schedule', 'agenda', 'calendar', 'productivity', 'efficient', 'prioritize',
    // Planning & Organization
    'plan', 'organize', 'budget', 'finance', 'goal', 'track', 'review', 'prepare',
    'declutter', 'sort', 'file', 'list', 'todo', 'checklist',
    // Creative & Technical
    'write', 'journal', 'blog', 'code', 'program', 'develop', 'design', 'build',
    'debug', 'test', 'deploy', 'website', 'app', 'software',
    // Cognitive & Analytical
    'think', 'analyze', 'solve', 'problem', 'puzzle', 'brain', 'mental', 'focus',
    'concentrate', 'memory', 'memorize', 'practice', 'skill', 'improve',
    'strategy', 'calculate', 'math', 'logic', 'critical', 'decision',
    // Languages
    'language', 'spanish', 'french', 'german', 'japanese', 'chinese', 'korean',
    'english', 'duolingo', 'vocabulary', 'grammar', 'fluent',
  ];
  
  // Body keywords - physical, health, movement, exercise, wellness
  const bodyKeywords = [
    // Exercise & Fitness
    'exercise', 'workout', 'run', 'running', 'walk', 'walking', 'jog', 'jogging',
    'gym', 'lift', 'weight', 'strength', 'cardio', 'hiit', 'crossfit', 'fitness',
    'train', 'training', 'marathon', 'sprint', 'rep', 'set', 'warmup', 'cooldown',
    // Sports & Activities
    'yoga', 'pilates', 'stretch', 'stretching', 'swim', 'swimming', 'bike', 'cycling',
    'hike', 'hiking', 'climb', 'climbing', 'dance', 'dancing', 'sport', 'tennis',
    'basketball', 'soccer', 'football', 'golf', 'martial', 'boxing', 'kickbox',
    // Specific Exercises
    'push-up', 'pushup', 'sit-up', 'situp', 'squat', 'plank', 'burpee', 'lunge',
    'deadlift', 'bench', 'curl', 'crunch', 'jumping', 'step', 'abs', 'core',
    // Nutrition & Diet
    'eat', 'meal', 'breakfast', 'lunch', 'dinner', 'snack', 'cook', 'cooking',
    'diet', 'nutrition', 'protein', 'vegetable', 'fruit', 'healthy', 'calorie',
    'fast', 'fasting', 'keto', 'vegan', 'portion', 'prep', 'recipe',
    // Health & Wellness
    'sleep', 'rest', 'nap', 'hydrate', 'water', 'vitamin', 'supplement',
    'health', 'doctor', 'dentist', 'medicine', 'checkup', 'therapy', 'physical',
    // Self-care
    'shower', 'hygiene', 'skincare', 'teeth', 'floss', 'brush', 'groom',
    'posture', 'ergonomic', 'stand', 'move', 'active', 'steps', 'outdoor',
    // Recovery
    'recover', 'recovery', 'foam', 'massage', 'ice', 'heat', 'sauna',
  ];
  
  // Soul keywords - spiritual, emotional, social, creative, mindfulness
  const soulKeywords = [
    // Mindfulness & Meditation
    'meditate', 'meditation', 'mindful', 'mindfulness', 'breathe', 'breathing',
    'calm', 'peace', 'peaceful', 'quiet', 'stillness', 'present', 'aware',
    'center', 'ground', 'zen', 'mantra', 'affirmation',
    // Spiritual
    'pray', 'prayer', 'spiritual', 'soul', 'spirit', 'faith', 'worship',
    'church', 'temple', 'mosque', 'scripture', 'bible', 'devotion', 'sacred',
    // Gratitude & Reflection
    'gratitude', 'grateful', 'thankful', 'appreciate', 'appreciation', 'bless',
    'reflect', 'reflection', 'introspect', 'self-care', 'selfcare', 'healing',
    // Emotional Wellness
    'emotion', 'emotional', 'feel', 'feeling', 'mood', 'happy', 'joy', 'positive',
    'anxiety', 'stress', 'cope', 'release', 'let go', 'forgive', 'accept',
    'therapy', 'therapist', 'counseling', 'mental health',
    // Relationships & Social
    'friend', 'family', 'partner', 'spouse', 'parent', 'child', 'loved',
    'call', 'text', 'connect', 'connection', 'relationship', 'social', 'community',
    'talk', 'listen', 'conversation', 'catch up', 'visit', 'hang out', 'date',
    // Kindness & Service
    'help', 'volunteer', 'donate', 'give', 'giving', 'charity', 'serve', 'service',
    'kindness', 'kind', 'compassion', 'empathy', 'care', 'support', 'encourage',
    // Creative Arts
    'art', 'artist', 'creative', 'create', 'paint', 'painting', 'draw', 'drawing',
    'sketch', 'craft', 'diy', 'pottery', 'knit', 'sew', 'photography', 'photo',
    // Music & Performance
    'music', 'sing', 'singing', 'song', 'instrument', 'piano', 'guitar', 'drum',
    'practice music', 'play music', 'compose', 'melody', 'perform',
    // Nature & Leisure
    'nature', 'garden', 'gardening', 'plant', 'flower', 'outdoor', 'park', 'beach',
    'sunset', 'sunrise', 'stargazing', 'wildlife', 'bird', 'pet', 'dog', 'cat',
    // Relaxation & Joy
    'relax', 'relaxation', 'unwind', 'hobby', 'fun', 'enjoy', 'pleasure', 'treat',
    'spa', 'bath', 'candle', 'tea', 'cozy', 'comfort', 'movie', 'show',
    // Inspiration & Growth
    'inspire', 'inspiration', 'dream', 'vision', 'purpose', 'meaning', 'value',
    'intention', 'manifest', 'visualize', 'believe', 'hope', 'aspire', 'transform',
  ];
  
  // Count matches for each category (using word boundaries for accuracy)
  const countMatches = (keywords: string[]) => {
    return keywords.filter(keyword => {
      // Handle multi-word keywords
      if (keyword.includes(' ')) {
        return text.includes(keyword);
      }
      // Use word boundary matching for single words
      const regex = new RegExp(`\\b${keyword}\\b|${keyword}s?\\b`, 'i');
      return regex.test(text);
    }).length;
  };
  
  const mindScore = countMatches(mindKeywords);
  const bodyScore = countMatches(bodyKeywords);
  const soulScore = countMatches(soulKeywords);
  
  // Return category with highest score, or null if no matches
  const maxScore = Math.max(mindScore, bodyScore, soulScore);
  if (maxScore === 0) return null;
  
  if (mindScore === maxScore) return 'mind';
  if (bodyScore === maxScore) return 'body';
  if (soulScore === maxScore) return 'soul';
  
  return null;
};
