import { useState, useCallback, useRef, useEffect } from 'react';
import { format, addDays, addWeeks, nextMonday, nextTuesday, nextWednesday, nextThursday, nextFriday, nextSaturday, nextSunday, setMonth, setDate, getYear } from 'date-fns';

export interface ParsedTask {
  text: string;
  difficulty: 'easy' | 'medium' | 'hard';
  scheduledTime: string | null;
  scheduledDate: string | null;
  estimatedDuration: number | null;
  recurrencePattern: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent' | null;
  energyLevel: 'low' | 'medium' | 'high';
  context: string | null;
  isTopThree: boolean;
  reminderEnabled: boolean;
  reminderMinutesBefore: number | null;
  notes: string | null;
}

// Month name to number mapping
const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

// Smart time inference: "at 4" without am/pm
// Hours 1-6 default to PM (more likely afternoon meetings/calls)
// Hours 7-11 default to AM (more likely morning activities)
// Hour 12 defaults to PM (noon)
function inferAmPm(hour: number): 'am' | 'pm' {
  if (hour >= 1 && hour <= 6) return 'pm';
  if (hour >= 7 && hour <= 11) return 'am';
  if (hour === 12) return 'pm';
  return 'am'; // midnight edge case
}

function parseTimeMatch(match: RegExpMatchArray): string {
  let hours = parseInt(match[1]);
  const minutes = match[2] ? parseInt(match[2]) : 0;
  let period = match[3]?.toLowerCase() as 'am' | 'pm' | undefined;

  // Smart inference when no am/pm specified
  if (!period && hours >= 1 && hours <= 12) {
    period = inferAmPm(hours);
  }

  if (period === 'pm' && hours < 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Parse "Dec 28" or "December 28th"
function parseMonthDay(match: RegExpMatchArray): string {
  const monthStr = match[1].toLowerCase();
  const day = parseInt(match[2]);
  const month = MONTH_MAP[monthStr];
  
  if (month === undefined || day < 1 || day > 31) {
    return format(new Date(), 'yyyy-MM-dd');
  }
  
  let date = setMonth(new Date(), month);
  date = setDate(date, day);
  
  // If the date is in the past, assume next year
  if (date < new Date()) {
    date = setMonth(new Date(getYear(new Date()) + 1, 0, 1), month);
    date = setDate(date, day);
  }
  
  return format(date, 'yyyy-MM-dd');
}

// Parse "28th Dec" or "28 December"
function parseDayMonth(match: RegExpMatchArray): string {
  const day = parseInt(match[1]);
  const monthStr = match[2].toLowerCase();
  const month = MONTH_MAP[monthStr];
  
  if (month === undefined || day < 1 || day > 31) {
    return format(new Date(), 'yyyy-MM-dd');
  }
  
  let date = setMonth(new Date(), month);
  date = setDate(date, day);
  
  // If the date is in the past, assume next year
  if (date < new Date()) {
    date = setMonth(new Date(getYear(new Date()) + 1, 0, 1), month);
    date = setDate(date, day);
  }
  
  return format(date, 'yyyy-MM-dd');
}

// Parse "12/28" or "12-28" (MM/DD format)
function parseNumericDate(match: RegExpMatchArray): string {
  const first = parseInt(match[1]);
  const second = parseInt(match[2]);
  
  // Assume MM/DD format (US standard)
  let month = first - 1; // 0-indexed
  let day = second;
  
  // Basic validation
  if (month < 0 || month > 11 || day < 1 || day > 31) {
    return format(new Date(), 'yyyy-MM-dd');
  }
  
  let date = setMonth(new Date(), month);
  date = setDate(date, day);
  
  // If the date is in the past, assume next year
  if (date < new Date()) {
    date = setMonth(new Date(getYear(new Date()) + 1, 0, 1), month);
    date = setDate(date, day);
  }
  
  return format(date, 'yyyy-MM-dd');
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
  // Relative dates - "in X days/weeks"
  { regex: /\bin\s+(\d+)\s*days?\b/i, handler: (m: RegExpMatchArray) => format(addDays(new Date(), parseInt(m[1])), 'yyyy-MM-dd') },
  { regex: /\bin\s+(\d+)\s*weeks?\b/i, handler: (m: RegExpMatchArray) => format(addWeeks(new Date(), parseInt(m[1])), 'yyyy-MM-dd') },
  { regex: /\bnext\s+week\b/i, handler: () => format(addWeeks(new Date(), 1), 'yyyy-MM-dd') },
  
  // Standard relative dates
  { regex: /\btoday\b/i, handler: () => format(new Date(), 'yyyy-MM-dd') },
  { regex: /\btomorrow\b/i, handler: () => format(addDays(new Date(), 1), 'yyyy-MM-dd') },
  
  // Specific dates - "Dec 28", "December 28th"
  { regex: /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i, handler: parseMonthDay },
  // "28th Dec", "28 December"
  { regex: /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i, handler: parseDayMonth },
  // Numeric dates - "12/28", "12-28"
  { regex: /\b(\d{1,2})[\/\-](\d{1,2})\b/, handler: parseNumericDate },
  
  // Day names
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

const PRIORITY_PATTERNS: Array<{ regex: RegExp; priority?: 'low' | 'medium' | 'high' | 'urgent'; isTopThree?: boolean }> = [
  // Exclamation shortcuts (Todoist-style)
  { regex: /!{4,}/, priority: 'urgent' },           // !!!! = urgent
  { regex: /!{3}/, priority: 'high' },              // !!! = high
  { regex: /!{2}/, priority: 'medium' },            // !! = medium
  { regex: /!1\b/i, priority: 'urgent' },           // !1 = urgent
  { regex: /!2\b/i, priority: 'high' },             // !2 = high  
  { regex: /!3\b/i, priority: 'medium' },           // !3 = medium
  { regex: /!4\b/i, priority: 'low' },              // !4 = low
  
  // P-notation (common in task managers)
  { regex: /\bp1\b/i, priority: 'urgent' },         // p1 = urgent
  { regex: /\bp2\b/i, priority: 'high' },           // p2 = high
  { regex: /\bp3\b/i, priority: 'medium' },         // p3 = medium
  { regex: /\bp4\b/i, priority: 'low' },            // p4 = low
  
  // Natural language - Urgent
  { regex: /\bURGENT\b/i, priority: 'urgent' },
  { regex: /\bASAP\b/i, priority: 'urgent' },
  { regex: /\bcritical\b/i, priority: 'urgent' },
  { regex: /\bemergency\b/i, priority: 'urgent' },
  { regex: /\bdue\s+today\b/i, priority: 'urgent' },
  { regex: /\btime\s*sensitive\b/i, priority: 'urgent' },
  
  // Natural language - High
  { regex: /\bhigh\s*priority\b/i, priority: 'high' },
  { regex: /\bhigh\s*prio\b/i, priority: 'high' },
  { regex: /\bimportant\b/i, priority: 'high' },
  { regex: /\bmust\s+do\b/i, priority: 'high' },
  
  // Natural language - Medium  
  { regex: /\bmedium\s*priority\b/i, priority: 'medium' },
  { regex: /\bmed\s*prio\b/i, priority: 'medium' },
  { regex: /\bnormal\s*priority\b/i, priority: 'medium' },
  
  // Natural language - Low
  { regex: /\blow\s*priority\b/i, priority: 'low' },
  { regex: /\blow\s*prio\b/i, priority: 'low' },
  { regex: /\bcould\s+do\b/i, priority: 'low' },
  { regex: /\bwhen\s+(?:I\s+)?(?:have|get)\s+time\b/i, priority: 'low' },
  { regex: /\bsomeday\b/i, priority: 'low' },
  { regex: /\bmaybe\b/i, priority: 'low' },
  { regex: /\boptional\b/i, priority: 'low' },
  { regex: /\bbacklog\b/i, priority: 'low' },
  
  // Top 3 detection
  { regex: /\btop\s*3\b/i, isTopThree: true },
  { regex: /\b#1\b/, isTopThree: true },
  { regex: /\bpriority\s*(?:one|1)\b/i, isTopThree: true },
  { regex: /\btoday'?s?\s*priority\b/i, isTopThree: true },
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

// Reminder patterns - detect phrases like "remind me 30 minutes before"
const REMINDER_PATTERNS: Array<{ regex: RegExp; handler: (m: RegExpMatchArray) => number }> = [
  // "remind me X minutes before" / "remind me X min early"
  { regex: /remind\s*(?:me\s+)?(\d+)\s*(?:min(?:ute)?s?)\s*(?:before|early|prior)/i, handler: (m) => parseInt(m[1]) },
  // "remind me X hours before" / "at least X hour before"
  { regex: /remind\s*(?:me\s+)?(?:at\s+least\s+)?(\d+)\s*(?:h(?:ou)?rs?)\s*(?:before|early|prior)/i, handler: (m) => parseInt(m[1]) * 60 },
  // Word-based: "remind me half an hour before"
  { regex: /remind\s*(?:me\s+)?(?:a\s+)?half\s*(?:an?\s+)?(?:h(?:ou)?r)\s*(?:before|early|prior)/i, handler: () => 30 },
  // Word-based: "remind me an hour before" / "remind me one hour before"
  { regex: /remind\s*(?:me\s+)?(?:an?\s+|one\s+)(?:h(?:ou)?r)\s*(?:before|early|prior)/i, handler: () => 60 },
  // Word-based: "remind me two hours before"
  { regex: /remind\s*(?:me\s+)?two\s*(?:h(?:ou)?rs?)\s*(?:before|early|prior)/i, handler: () => 120 },
  // "notify me X min before"
  { regex: /notify\s*(?:me\s+)?(\d+)\s*(?:min(?:ute)?s?)\s*(?:before|early|prior)/i, handler: (m) => parseInt(m[1]) },
  // "alert me X minutes before"
  { regex: /alert\s*(?:me\s+)?(\d+)\s*(?:min(?:ute)?s?)\s*(?:before|early|prior)/i, handler: (m) => parseInt(m[1]) },
  // "remind me" (default 15 min) - must be last as it's the most general
  { regex: /remind\s*me\b/i, handler: () => 15 },
  // "set reminder" / "with reminder"
  { regex: /(?:set|with)\s*(?:a\s+)?reminder/i, handler: () => 15 },
];

// Notes patterns - detect phrases like "note: something" or "(parenthetical notes)"
const NOTE_PATTERNS: Array<{ regex: RegExp; handler: (m: RegExpMatchArray) => string }> = [
  // "note: something" or "notes: something"
  { regex: /\bnotes?:\s*(.+?)(?=\s*(?:!{1,4}|p[1-4]|\bat\s+\d|@|\bremind|\btomorrow|\btoday|$))/i, handler: (m) => m[1].trim() },
  // "// comment style" at end
  { regex: /\/\/\s*(.+?)$/i, handler: (m) => m[1].trim() },
  // "(parenthetical notes)" at end
  { regex: /\(([^)]+)\)\s*$/i, handler: (m) => m[1].trim() },
  // "- additional info" at end
  { regex: /\s+-\s+(.+?)$/i, handler: (m) => m[1].trim() },
];

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
    ...REMINDER_PATTERNS.map(p => p.regex),
    ...NOTE_PATTERNS.map(p => p.regex),
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
  let reminderEnabled = false;
  let reminderMinutesBefore: number | null = null;
  let notes: string | null = null;

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
      scheduledDate = pattern.handler(match);
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

  // Parse priority - simplified to match database schema
  for (const pattern of PRIORITY_PATTERNS) {
    if (pattern.regex.test(input)) {
      if (pattern.isTopThree) {
        isTopThree = true;
      } else if (pattern.priority && !priority) {
        priority = pattern.priority;
      }
    }
  }

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

  // Parse reminder
  for (const pattern of REMINDER_PATTERNS) {
    const match = input.match(pattern.regex);
    if (match) {
      reminderEnabled = true;
      reminderMinutesBefore = pattern.handler(match);
      break;
    }
  }

  // Parse notes
  for (const pattern of NOTE_PATTERNS) {
    const match = input.match(pattern.regex);
    if (match) {
      notes = pattern.handler(match);
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
    reminderEnabled,
    reminderMinutesBefore,
    notes,
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
