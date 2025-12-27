import { useState, useCallback, useRef, useEffect } from 'react';
import { format, addDays, nextMonday, nextTuesday, nextWednesday, nextThursday, nextFriday, nextSaturday, nextSunday, parse } from 'date-fns';

export interface ParsedTask {
  text: string;
  difficulty: 'easy' | 'medium' | 'hard';
  scheduledTime: string | null;
  scheduledDate: string | null;
  estimatedDuration: number | null;
  recurrencePattern: string | null;
  priority: 'urgent-important' | 'not-urgent-important' | 'urgent-not-important' | 'not-urgent-not-important' | null;
  energyLevel: 'low' | 'medium' | 'high';
  context: string | null;
  isTopThree: boolean;
}

const TIME_PATTERNS = [
  { regex: /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i, handler: parseTimeMatch },
  { regex: /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i, handler: parseTimeMatch },
  { regex: /\bmorning\b/i, handler: () => '09:00' },
  { regex: /\bafternoon\b/i, handler: () => '14:00' },
  { regex: /\bevening\b/i, handler: () => '18:00' },
  { regex: /\bnight\b/i, handler: () => '21:00' },
  { regex: /\bnoon\b/i, handler: () => '12:00' },
  { regex: /\bmidnight\b/i, handler: () => '00:00' },
];

const DATE_PATTERNS = [
  { regex: /\btoday\b/i, handler: () => format(new Date(), 'yyyy-MM-dd') },
  { regex: /\btomorrow\b/i, handler: () => format(addDays(new Date(), 1), 'yyyy-MM-dd') },
  { regex: /\bnext\s+monday\b/i, handler: () => format(nextMonday(new Date()), 'yyyy-MM-dd') },
  { regex: /\bnext\s+tuesday\b/i, handler: () => format(nextTuesday(new Date()), 'yyyy-MM-dd') },
  { regex: /\bnext\s+wednesday\b/i, handler: () => format(nextWednesday(new Date()), 'yyyy-MM-dd') },
  { regex: /\bnext\s+thursday\b/i, handler: () => format(nextThursday(new Date()), 'yyyy-MM-dd') },
  { regex: /\bnext\s+friday\b/i, handler: () => format(nextFriday(new Date()), 'yyyy-MM-dd') },
  { regex: /\bnext\s+saturday\b/i, handler: () => format(nextSaturday(new Date()), 'yyyy-MM-dd') },
  { regex: /\bnext\s+sunday\b/i, handler: () => format(nextSunday(new Date()), 'yyyy-MM-dd') },
  { regex: /\bmonday\b/i, handler: () => format(nextMonday(new Date()), 'yyyy-MM-dd') },
  { regex: /\btuesday\b/i, handler: () => format(nextTuesday(new Date()), 'yyyy-MM-dd') },
  { regex: /\bwednesday\b/i, handler: () => format(nextWednesday(new Date()), 'yyyy-MM-dd') },
  { regex: /\bthursday\b/i, handler: () => format(nextThursday(new Date()), 'yyyy-MM-dd') },
  { regex: /\bfriday\b/i, handler: () => format(nextFriday(new Date()), 'yyyy-MM-dd') },
  { regex: /\bsaturday\b/i, handler: () => format(nextSaturday(new Date()), 'yyyy-MM-dd') },
  { regex: /\bsunday\b/i, handler: () => format(nextSunday(new Date()), 'yyyy-MM-dd') },
];

const DURATION_PATTERNS = [
  { regex: /\bfor\s+(\d+)\s*h(?:ours?)?\b/i, handler: (m: RegExpMatchArray) => parseInt(m[1]) * 60 },
  { regex: /\bfor\s+(\d+)\s*m(?:in(?:utes?)?)?\b/i, handler: (m: RegExpMatchArray) => parseInt(m[1]) },
  { regex: /\b(\d+)\s*h(?:ours?)?\b/i, handler: (m: RegExpMatchArray) => parseInt(m[1]) * 60 },
  { regex: /\b(\d+)\s*m(?:in(?:utes?)?)?\b/i, handler: (m: RegExpMatchArray) => parseInt(m[1]) },
  { regex: /\bquick\b/i, handler: () => 15 },
  { regex: /\bpomodoro\b/i, handler: () => 25 },
  { regex: /\bdeep\s*work\b/i, handler: () => 90 },
];

const DIFFICULTY_PATTERNS = [
  { regex: /\b(super\s+)?easy\b/i, result: 'easy' as const },
  { regex: /\bsimple\b/i, result: 'easy' as const },
  { regex: /\bquick\b/i, result: 'easy' as const },
  { regex: /\bhard\b/i, result: 'hard' as const },
  { regex: /\bdifficult\b/i, result: 'hard' as const },
  { regex: /\bchallenging\b/i, result: 'hard' as const },
  { regex: /\bcomplex\b/i, result: 'hard' as const },
  { regex: /\bdeep\s*work\b/i, result: 'hard' as const },
];

const PRIORITY_PATTERNS = [
  { regex: /\bURGENT\b/i, priority: 'urgent' },
  { regex: /\bASAP\b/i, priority: 'urgent' },
  { regex: /\bimportant\b/i, priority: 'important' },
  { regex: /\bcritical\b/i, priority: 'urgent-important' },
  { regex: /\b!{2,}\b/, priority: 'urgent-important' },
  { regex: /\btop\s*3\b/i, isTopThree: true },
  { regex: /\b#1\b/, isTopThree: true },
];

const RECURRENCE_PATTERNS = [
  { regex: /\bevery\s*day\b/i, result: 'daily' },
  { regex: /\bdaily\b/i, result: 'daily' },
  { regex: /\bevery\s*week\b/i, result: 'weekly' },
  { regex: /\bweekly\b/i, result: 'weekly' },
  { regex: /\bevery\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, result: 'weekly' },
];

const CONTEXT_PATTERNS = [
  { regex: /@home\b/i, result: 'home' },
  { regex: /@work\b/i, result: 'work' },
  { regex: /@office\b/i, result: 'work' },
  { regex: /@errands?\b/i, result: 'errands' },
  { regex: /@phone\b/i, result: 'phone' },
  { regex: /@computer\b/i, result: 'computer' },
  { regex: /@anywhere\b/i, result: 'anywhere' },
  { regex: /@gym\b/i, result: 'gym' },
  { regex: /@outside\b/i, result: 'outside' },
];

const ENERGY_PATTERNS = [
  { regex: /\blow\s*energy\b/i, result: 'low' as const },
  { regex: /\bhigh\s*energy\b/i, result: 'high' as const },
  { regex: /\btired\b/i, result: 'low' as const },
  { regex: /\bfocused\b/i, result: 'high' as const },
];

function parseTimeMatch(match: RegExpMatchArray): string {
  let hours = parseInt(match[1]);
  const minutes = match[2] ? parseInt(match[2]) : 0;
  const period = match[3]?.toLowerCase();

  if (period === 'pm' && hours < 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function cleanTaskText(text: string): string {
  let cleaned = text;

  // Remove matched patterns from the text
  const patternsToRemove = [
    ...TIME_PATTERNS.map(p => p.regex),
    ...DATE_PATTERNS.map(p => p.regex),
    ...DURATION_PATTERNS.map(p => p.regex),
    ...DIFFICULTY_PATTERNS.map(p => p.regex),
    ...PRIORITY_PATTERNS.map(p => p.regex),
    ...RECURRENCE_PATTERNS.map(p => p.regex),
    ...CONTEXT_PATTERNS.map(p => p.regex),
    ...ENERGY_PATTERNS.map(p => p.regex),
  ];

  patternsToRemove.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });

  // Clean up extra spaces and punctuation
  cleaned = cleaned
    .replace(/\s+/g, ' ')
    .replace(/^\s*[-,;:]\s*/, '')
    .replace(/\s*[-,;:]\s*$/, '')
    .trim();

  return cleaned;
}

export function parseNaturalLanguage(input: string): ParsedTask {
  let scheduledTime: string | null = null;
  let scheduledDate: string | null = null;
  let estimatedDuration: number | null = null;
  let difficulty: 'easy' | 'medium' | 'hard' = 'medium';
  let priority: ParsedTask['priority'] = null;
  let energyLevel: 'low' | 'medium' | 'high' = 'medium';
  let context: string | null = null;
  let recurrencePattern: string | null = null;
  let isTopThree = false;

  // Parse time
  for (const pattern of TIME_PATTERNS) {
    const match = input.match(pattern.regex);
    if (match) {
      scheduledTime = pattern.handler(match);
      break;
    }
  }

  // Parse date
  for (const pattern of DATE_PATTERNS) {
    const match = input.match(pattern.regex);
    if (match) {
      scheduledDate = pattern.handler();
      break;
    }
  }

  // Parse duration
  for (const pattern of DURATION_PATTERNS) {
    const match = input.match(pattern.regex);
    if (match) {
      estimatedDuration = pattern.handler(match);
      break;
    }
  }

  // Parse difficulty
  for (const pattern of DIFFICULTY_PATTERNS) {
    if (pattern.regex.test(input)) {
      difficulty = pattern.result;
      break;
    }
  }

  // Parse priority
  let hasUrgent = false;
  let hasImportant = false;
  for (const pattern of PRIORITY_PATTERNS) {
    if (pattern.regex.test(input)) {
      if ('isTopThree' in pattern) {
        isTopThree = true;
      } else if (pattern.priority === 'urgent') {
        hasUrgent = true;
      } else if (pattern.priority === 'important') {
        hasImportant = true;
      } else if (pattern.priority === 'urgent-important') {
        hasUrgent = true;
        hasImportant = true;
      }
    }
  }
  
  if (hasUrgent && hasImportant) priority = 'urgent-important';
  else if (hasUrgent) priority = 'urgent-not-important';
  else if (hasImportant) priority = 'not-urgent-important';

  // Parse recurrence
  for (const pattern of RECURRENCE_PATTERNS) {
    if (pattern.regex.test(input)) {
      recurrencePattern = pattern.result;
      break;
    }
  }

  // Parse context
  for (const pattern of CONTEXT_PATTERNS) {
    if (pattern.regex.test(input)) {
      context = pattern.result;
      break;
    }
  }

  // Parse energy level
  for (const pattern of ENERGY_PATTERNS) {
    if (pattern.regex.test(input)) {
      energyLevel = pattern.result;
      break;
    }
  }

  // Infer energy from duration if not explicitly set
  if (estimatedDuration && estimatedDuration >= 60) {
    energyLevel = 'high';
  } else if (estimatedDuration && estimatedDuration <= 15) {
    energyLevel = 'low';
  }

  // Clean the task text
  const cleanedText = cleanTaskText(input);

  return {
    text: cleanedText || input,
    difficulty,
    scheduledTime,
    scheduledDate,
    estimatedDuration,
    recurrencePattern,
    priority,
    energyLevel,
    context,
    isTopThree,
  };
}

export function useNaturalLanguageParser() {
  const [input, setInput] = useState('');
  const [parsed, setParsed] = useState<ParsedTask | null>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  const parse = useCallback((text: string) => {
    if (!text.trim()) {
      setParsed(null);
      return;
    }
    setParsed(parseNaturalLanguage(text));
  }, []);

  // Debounced parsing for real-time preview
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      parse(input);
    }, 150);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [input, parse]);

  const reset = useCallback(() => {
    setInput('');
    setParsed(null);
  }, []);

  return {
    input,
    setInput,
    parsed,
    reset,
    parseImmediate: parse,
  };
}
