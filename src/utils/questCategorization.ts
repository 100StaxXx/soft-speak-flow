// Auto-categorize quests into Mind/Body/Soul based on task text
export const categorizeQuest = (taskText: string): 'mind' | 'body' | 'soul' | null => {
  const text = taskText.toLowerCase();
  
  // Mind keywords - mental, learning, planning, work
  const mindKeywords = [
    'read', 'study', 'learn', 'plan', 'write', 'work', 'meeting', 'email',
    'research', 'organize', 'budget', 'calculate', 'design', 'code', 'program',
    'think', 'analyze', 'review', 'brain', 'mental', 'focus', 'concentrate',
    'journal', 'reflect', 'strategy', 'problem', 'solve', 'course', 'book'
  ];
  
  // Body keywords - physical, health, movement, exercise
  const bodyKeywords = [
    'exercise', 'workout', 'run', 'walk', 'gym', 'yoga', 'stretch', 'swim',
    'bike', 'hike', 'lift', 'cardio', 'strength', 'physical', 'fitness',
    'eat', 'meal', 'cook', 'diet', 'nutrition', 'sleep', 'rest', 'hydrate',
    'water', 'health', 'doctor', 'medicine', 'clean', 'shower', 'hygiene',
    'dance', 'sport', 'train', 'jog', 'climb', 'push-up', 'sit-up'
  ];
  
  // Soul keywords - spiritual, emotional, social, creative
  const soulKeywords = [
    'meditate', 'pray', 'gratitude', 'mindful', 'breathe', 'calm', 'peace',
    'spiritual', 'reflect', 'connect', 'love', 'compassion', 'kindness',
    'friend', 'family', 'call', 'talk', 'listen', 'help', 'volunteer',
    'art', 'music', 'create', 'paint', 'draw', 'sing', 'play', 'hobby',
    'nature', 'garden', 'relax', 'spa', 'massage', 'therapy', 'emotion',
    'feel', 'express', 'appreciate', 'beauty', 'inspire', 'soul'
  ];
  
  // Count matches for each category
  const mindScore = mindKeywords.filter(keyword => text.includes(keyword)).length;
  const bodyScore = bodyKeywords.filter(keyword => text.includes(keyword)).length;
  const soulScore = soulKeywords.filter(keyword => text.includes(keyword)).length;
  
  // Return category with highest score, or null if no matches
  const maxScore = Math.max(mindScore, bodyScore, soulScore);
  if (maxScore === 0) return null;
  
  if (mindScore === maxScore) return 'mind';
  if (bodyScore === maxScore) return 'body';
  if (soulScore === maxScore) return 'soul';
  
  return null;
};
