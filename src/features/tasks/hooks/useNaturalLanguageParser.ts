import { useState, useCallback, useRef, useEffect } from 'react';
import { format, addDays, addWeeks, addMonths, nextMonday, nextTuesday, nextWednesday, nextThursday, nextFriday, nextSaturday, nextSunday, setMonth, setDate, getYear, endOfMonth, startOfMonth } from 'date-fns';

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
  
  // Contact linking
  contactId: string | null;
  autoLogInteraction: boolean;
  mentionedContactName: string | null;
  
  // Clear actions
  clearTime: boolean;
  clearDate: boolean;
  clearDuration: boolean;
  clearRecurrence: boolean;
  clearAll: boolean;
  clearCategory: boolean;
  clearPriority: boolean;
  clearNotes: boolean;
  clearReminder: boolean;
  
  // Category/Attribute
  category: 'mind' | 'body' | 'soul' | null;
  
  // Frequency
  frequency: string | null;
  customDays: number[] | null;
  
  // Status control
  paused: boolean | null;
  archived: boolean | null;
  
  // Special flags
  isBonus: boolean | null;
  isMilestone: boolean | null;
  
  // XP/Rewards
  xpReward: number | null;
  xpMultiplier: number | null;
  
  // Rename/Title change
  newTitle: string | null;
  
  // AI triggers
  triggerDecomposition: boolean;
  triggerPlanMyDay: boolean;
  triggerPlanMyWeek: boolean;
  
  // Photo attachment
  imageUrl: string | null;
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

// Smart time inference
function inferAmPm(hour: number): 'am' | 'pm' {
  if (hour >= 1 && hour <= 6) return 'pm';
  if (hour >= 7 && hour <= 11) return 'am';
  if (hour === 12) return 'pm';
  return 'am';
}

function parseTimeMatch(match: RegExpMatchArray): string {
  let hours = parseInt(match[1]);
  const minutes = match[2] ? parseInt(match[2]) : 0;
  let period = match[3]?.toLowerCase() as 'am' | 'pm' | undefined;

  if (!period && hours >= 1 && hours <= 12) {
    period = inferAmPm(hours);
  }

  if (period === 'pm' && hours < 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function parseMonthDay(match: RegExpMatchArray): string {
  const monthStr = match[1].toLowerCase();
  const day = parseInt(match[2]);
  const month = MONTH_MAP[monthStr];
  
  if (month === undefined || day < 1 || day > 31) {
    return format(new Date(), 'yyyy-MM-dd');
  }
  
  let date = setMonth(new Date(), month);
  date = setDate(date, day);
  
  if (date < new Date()) {
    date = setMonth(new Date(getYear(new Date()) + 1, 0, 1), month);
    date = setDate(date, day);
  }
  
  return format(date, 'yyyy-MM-dd');
}

function parseDayMonth(match: RegExpMatchArray): string {
  const day = parseInt(match[1]);
  const monthStr = match[2].toLowerCase();
  const month = MONTH_MAP[monthStr];
  
  if (month === undefined || day < 1 || day > 31) {
    return format(new Date(), 'yyyy-MM-dd');
  }
  
  let date = setMonth(new Date(), month);
  date = setDate(date, day);
  
  if (date < new Date()) {
    date = setMonth(new Date(getYear(new Date()) + 1, 0, 1), month);
    date = setDate(date, day);
  }
  
  return format(date, 'yyyy-MM-dd');
}

function parseNumericDate(match: RegExpMatchArray): string {
  const first = parseInt(match[1]);
  const second = parseInt(match[2]);
  
  let month = first - 1;
  let day = second;
  
  if (month < 0 || month > 11 || day < 1 || day > 31) {
    return format(new Date(), 'yyyy-MM-dd');
  }
  
  let date = setMonth(new Date(), month);
  date = setDate(date, day);
  
  if (date < new Date()) {
    date = setMonth(new Date(getYear(new Date()) + 1, 0, 1), month);
    date = setDate(date, day);
  }
  
  return format(date, 'yyyy-MM-dd');
}

// Time patterns - enhanced with more natural expressions
const TIME_PATTERNS = [
  { regex: /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i, handler: parseTimeMatch },
  { regex: /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i, handler: parseTimeMatch },
  // Named times - enhanced
  { regex: /\b(?:first\s*thing|wake\s*up|early\s*morning|dawn|sunrise)\b/i, handler: () => '06:00' },
  { regex: /\bmorning\b/i, handler: () => '09:00' },
  { regex: /\bmid[- ]?morning\b/i, handler: () => '10:00' },
  { regex: /\b(?:noon|midday|lunch(?:time)?)\b/i, handler: () => '12:00' },
  { regex: /\bearly\s*afternoon\b/i, handler: () => '13:00' },
  { regex: /\bafternoon\b/i, handler: () => '14:00' },
  { regex: /\blate\s*afternoon\b/i, handler: () => '16:00' },
  { regex: /\b(?:before\s*dinner|pre[- ]?dinner)\b/i, handler: () => '17:00' },
  { regex: /\bevening\b/i, handler: () => '18:00' },
  { regex: /\b(?:after\s*dinner|post[- ]?dinner)\b/i, handler: () => '19:00' },
  { regex: /\bnight\b/i, handler: () => '21:00' },
  { regex: /\b(?:before\s*bed|bedtime|end\s*of\s*day)\b/i, handler: () => '22:00' },
  { regex: /\blate\s*night\b/i, handler: () => '23:00' },
  { regex: /\bmidnight\b/i, handler: () => '00:00' },
];

// Date patterns - enhanced with more relative dates
const DATE_PATTERNS = [
  { regex: /\bin\s+(\d+)\s*days?\b/i, handler: (m: RegExpMatchArray) => format(addDays(new Date(), parseInt(m[1])), 'yyyy-MM-dd') },
  { regex: /\bin\s+(\d+)\s*weeks?\b/i, handler: (m: RegExpMatchArray) => format(addWeeks(new Date(), parseInt(m[1])), 'yyyy-MM-dd') },
  { regex: /\bin\s+(\d+)\s*months?\b/i, handler: (m: RegExpMatchArray) => format(addMonths(new Date(), parseInt(m[1])), 'yyyy-MM-dd') },
  { regex: /\bnext\s+week\b/i, handler: () => format(addWeeks(new Date(), 1), 'yyyy-MM-dd') },
  { regex: /\btoday\b/i, handler: () => format(new Date(), 'yyyy-MM-dd') },
  { regex: /\btomorrow\b/i, handler: () => format(addDays(new Date(), 1), 'yyyy-MM-dd') },
  { regex: /\bday\s*after\s*tomorrow\b/i, handler: () => format(addDays(new Date(), 2), 'yyyy-MM-dd') },
  { regex: /\bthis\s*weekend\b/i, handler: () => format(nextSaturday(new Date()), 'yyyy-MM-dd') },
  { regex: /\b(?:end\s*of\s*week|eow)\b/i, handler: () => format(nextFriday(new Date()), 'yyyy-MM-dd') },
  { regex: /\b(?:start\s*of\s*(?:next\s*)?week|beginning\s*of\s*week)\b/i, handler: () => format(nextMonday(new Date()), 'yyyy-MM-dd') },
  { regex: /\b(?:end\s*of\s*month|eom)\b/i, handler: () => format(endOfMonth(new Date()), 'yyyy-MM-dd') },
  { regex: /\bnext\s*month\b/i, handler: () => format(startOfMonth(addMonths(new Date(), 1)), 'yyyy-MM-dd') },
  { regex: /\b(?:in\s*a\s*)?fortnight\b/i, handler: () => format(addDays(new Date(), 14), 'yyyy-MM-dd') },
  { regex: /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i, handler: parseMonthDay },
  { regex: /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i, handler: parseDayMonth },
  { regex: /\b(\d{1,2})[\/\-](\d{1,2})\b/, handler: parseNumericDate },
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

// Duration patterns - enhanced
const DURATION_PATTERNS = [
  { regex: /\bfor\s+(\d+)\s*h(?:ours?)?\b/i, handler: (m: RegExpMatchArray) => parseInt(m[1]) * 60 },
  { regex: /\bfor\s+(\d+)\s*m(?:in(?:utes?)?)?\b/i, handler: (m: RegExpMatchArray) => parseInt(m[1]) },
  { regex: /\b(\d+)\s*h(?:ours?)?\s*(?:(\d+)\s*m(?:in)?s?)?\b/i, handler: (m: RegExpMatchArray) => parseInt(m[1]) * 60 + (m[2] ? parseInt(m[2]) : 0) },
  { regex: /\b(\d+)\s*m(?:in(?:utes?)?)?\b/i, handler: (m: RegExpMatchArray) => parseInt(m[1]) },
  { regex: /\bhalf\s*(?:an?\s*)?hour\b/i, handler: () => 30 },
  { regex: /\bquarter\s*(?:of\s*an?\s*)?hour\b/i, handler: () => 15 },
  { regex: /\b(?:a\s*)?couple\s*(?:of\s*)?hours?\b/i, handler: () => 120 },
  { regex: /\b(?:a\s*)?few\s*(?:of\s*)?hours?\b/i, handler: () => 180 },
  { regex: /\b(?:a\s*)?few\s*(?:of\s*)?min(?:ute)?s?\b/i, handler: () => 10 },
  { regex: /\b(?:all|full)\s*day\b/i, handler: () => 480 },
  { regex: /\bhalf\s*day\b/i, handler: () => 240 },
  { regex: /\bquick\b/i, handler: () => 15 },
  { regex: /\bbrief\b/i, handler: () => 5 },
  { regex: /\bpomodoro\b/i, handler: () => 25 },
  { regex: /\bdeep\s*work\b/i, handler: () => 90 },
  { regex: /\bsprint\b/i, handler: () => 45 },
];

// Difficulty patterns
const DIFFICULTY_PATTERNS = [
  { regex: /\b(super\s+)?easy\b/i, result: 'easy' as const },
  { regex: /\bsimple\b/i, result: 'easy' as const },
  { regex: /\blight\b/i, result: 'easy' as const },
  { regex: /\bbasic\b/i, result: 'easy' as const },
  { regex: /\btrivial\b/i, result: 'easy' as const },
  { regex: /\bhard\b/i, result: 'hard' as const },
  { regex: /\bdifficult\b/i, result: 'hard' as const },
  { regex: /\bchallenging\b/i, result: 'hard' as const },
  { regex: /\bcomplex\b/i, result: 'hard' as const },
  { regex: /\btough\b/i, result: 'hard' as const },
  { regex: /\bintense\b/i, result: 'hard' as const },
];

// Priority patterns
const PRIORITY_PATTERNS: Array<{ regex: RegExp; priority?: 'low' | 'medium' | 'high' | 'urgent'; isTopThree?: boolean }> = [
  { regex: /!{4,}/, priority: 'urgent' },
  { regex: /!{3}/, priority: 'high' },
  { regex: /!{2}/, priority: 'medium' },
  { regex: /!1\b/i, priority: 'urgent' },
  { regex: /!2\b/i, priority: 'high' },
  { regex: /!3\b/i, priority: 'medium' },
  { regex: /!4\b/i, priority: 'low' },
  { regex: /\bp1\b/i, priority: 'urgent' },
  { regex: /\bp2\b/i, priority: 'high' },
  { regex: /\bp3\b/i, priority: 'medium' },
  { regex: /\bp4\b/i, priority: 'low' },
  { regex: /\bURGENT\b/i, priority: 'urgent' },
  { regex: /\bASAP\b/i, priority: 'urgent' },
  { regex: /\bcritical\b/i, priority: 'urgent' },
  { regex: /\bemergency\b/i, priority: 'urgent' },
  { regex: /\bhigh\s*priority\b/i, priority: 'high' },
  { regex: /\bimportant\b/i, priority: 'high' },
  { regex: /\bmust\s+do\b/i, priority: 'high' },
  { regex: /\bmedium\s*priority\b/i, priority: 'medium' },
  { regex: /\blow\s*priority\b/i, priority: 'low' },
  { regex: /\bsomeday\b/i, priority: 'low' },
  { regex: /\bbacklog\b/i, priority: 'low' },
  { regex: /\bwhenever\b/i, priority: 'low' },
  { regex: /\btop\s*3\b/i, isTopThree: true },
  { regex: /\b#1\b/, isTopThree: true },
  { regex: /\bpriority\s*(?:one|1)\b/i, isTopThree: true },
  { regex: /\bmost\s*important\b/i, isTopThree: true },
  { regex: /\bmain\s*focus\b/i, isTopThree: true },
];

// Recurrence patterns
const RECURRENCE_PATTERNS = [
  { regex: /\bevery\s*day\b/i, result: 'daily' },
  { regex: /\bdaily\b/i, result: 'daily' },
  { regex: /\bevery\s*week\b/i, result: 'weekly' },
  { regex: /\bweekly\b/i, result: 'weekly' },
  { regex: /\bevery\s*month\b/i, result: 'monthly' },
  { regex: /\bmonthly\b/i, result: 'monthly' },
  { regex: /\bevery\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, result: 'weekly' },
  { regex: /\b(?:twice\s*(?:a\s*)?(?:day|daily)|2x\s*daily)\b/i, result: 'twice_daily' },
  { regex: /\b(?:alternate\s*days?|every\s*other\s*day)\b/i, result: 'alternate' },
  { regex: /\b(?:biweekly|every\s*(?:two|2)\s*weeks?)\b/i, result: 'biweekly' },
];

// Frequency/Custom days patterns
const FREQUENCY_PATTERNS: Array<{ regex: RegExp; days?: number[]; frequency?: string }> = [
  { regex: /\bweekdays?\s*(?:only)?\b/i, days: [1, 2, 3, 4, 5] },
  { regex: /\bweekends?\s*(?:only)?\b/i, days: [0, 6] },
  { regex: /\bMWF\b|mon(?:day)?\s*wed(?:nesday)?\s*fri(?:day)?/i, days: [1, 3, 5] },
  { regex: /\bTTh?\b|tue(?:sday)?\s*thu(?:rsday)?/i, days: [2, 4] },
  { regex: /\b(\d)x\s*(?:a\s*)?week\b/i, frequency: 'custom' },
  { regex: /\b(?:three|3)\s*times?\s*(?:a\s*)?week\b/i, frequency: '3x_week' },
  { regex: /\b(?:five|5)\s*times?\s*(?:a\s*)?week\b/i, frequency: '5x_week' },
  { regex: /\b(?:twice|2x?)\s*(?:a\s*)?week\b/i, frequency: '2x_week' },
];

// Context patterns
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
  { regex: /@online\b/i, result: 'online' },
];

// Energy patterns
const ENERGY_PATTERNS = [
  { regex: /\blow\s*energy\b/i, result: 'low' as const },
  { regex: /\btired\b/i, result: 'low' as const },
  { regex: /\bexhausted\b/i, result: 'low' as const },
  { regex: /\blazy\b/i, result: 'low' as const },
  { regex: /\bhigh\s*energy\b/i, result: 'high' as const },
  { regex: /\bfocused\b/i, result: 'high' as const },
  { regex: /\benergetic\b/i, result: 'high' as const },
  { regex: /\bpumped\b/i, result: 'high' as const },
  { regex: /\bpeak\b/i, result: 'high' as const },
];

// Reminder patterns
const REMINDER_PATTERNS: Array<{ regex: RegExp; handler: (m: RegExpMatchArray) => number }> = [
  { regex: /remind\s*(?:me\s+)?(\d+)\s*(?:min(?:ute)?s?)\s*(?:before|early|prior)/i, handler: (m) => parseInt(m[1]) },
  { regex: /remind\s*(?:me\s+)?(?:at\s+least\s+)?(\d+)\s*(?:h(?:ou)?rs?)\s*(?:before|early|prior)/i, handler: (m) => parseInt(m[1]) * 60 },
  { regex: /remind\s*(?:me\s+)?(?:a\s+)?half\s*(?:an?\s+)?(?:h(?:ou)?r)\s*(?:before|early|prior)/i, handler: () => 30 },
  { regex: /remind\s*(?:me\s+)?(?:an?\s+|one\s+)(?:h(?:ou)?r)\s*(?:before|early|prior)/i, handler: () => 60 },
  { regex: /remind\s*me\b/i, handler: () => 15 },
  { regex: /(?:set|with)\s*(?:a\s+)?reminder/i, handler: () => 15 },
];

// Notes patterns
const NOTE_PATTERNS: Array<{ regex: RegExp; handler: (m: RegExpMatchArray) => string }> = [
  { regex: /\bnotes?:\s*(.+?)(?=\s*(?:!{1,4}|p[1-4]|\bat\s+\d|@|\bremind|\btomorrow|\btoday|$))/i, handler: (m) => m[1].trim() },
  { regex: /\/\/\s*(.+?)$/i, handler: (m) => m[1].trim() },
  { regex: /\(([^)]+)\)\s*$/i, handler: (m) => m[1].trim() },
];

// Clear/remove patterns - enhanced
const CLEAR_PATTERNS: Array<{ regex: RegExp; clears: string }> = [
  { regex: /\b(?:remove|clear|delete|no|unset)\s*(?:the\s*)?(?:scheduled?\s*)?time\b/i, clears: 'time' },
  { regex: /\b(?:remove|clear|delete|no|unset)\s*(?:the\s*)?(?:scheduled?\s*)?date\b/i, clears: 'date' },
  { regex: /\b(?:remove|clear|delete|no|unset)\s*(?:the\s*)?(?:estimated?\s*)?duration\b/i, clears: 'duration' },
  { regex: /\b(?:remove|clear|delete|no|unset|stop)\s*(?:the\s*)?(?:recurrence|repeat(?:ing)?)\b/i, clears: 'recurrence' },
  { regex: /\bunschedule\b/i, clears: 'both' },
  { regex: /\bclear\s*(?:all\s*)?schedule\b/i, clears: 'both' },
  { regex: /\b(?:reset|clear\s*all|start\s*fresh|defaults?)\b/i, clears: 'all' },
  { regex: /\b(?:remove|clear|delete|no)\s*(?:the\s*)?category\b/i, clears: 'category' },
  { regex: /\b(?:remove|clear|delete|no)\s*(?:the\s*)?(?:attribute|type)\b/i, clears: 'category' },
  { regex: /\b(?:remove|clear|delete|no)\s*(?:the\s*)?priority\b/i, clears: 'priority' },
  { regex: /\b(?:remove|clear|delete|no)\s*(?:the\s*)?notes?\b/i, clears: 'notes' },
  { regex: /\b(?:remove|clear|delete|no)\s*(?:the\s*)?remind(?:er)?\b/i, clears: 'reminder' },
];

// Category/Attribute patterns
const CATEGORY_PATTERNS: Array<{ regex: RegExp; category: 'mind' | 'body' | 'soul' }> = [
  { regex: /\b(?:for\s+)?(?:mind|mental|brain|cognitive|intellectual|thinking|#mind)\b/i, category: 'mind' },
  { regex: /\b(?:for\s+)?(?:body|physical|fitness|workout|exercise|health|#body)\b/i, category: 'body' },
  { regex: /\b(?:for\s+)?(?:soul|spirit(?:ual)?|emotional|heart|inner|#soul)\b/i, category: 'soul' },
];

// Status patterns
const STATUS_PATTERNS: Array<{ regex: RegExp; paused?: boolean; archived?: boolean }> = [
  { regex: /\b(?:pause|skip|disable|deactivate|turn\s*off|stop)\s*(?:this)?\b/i, paused: true },
  { regex: /\b(?:resume|activate|enable|turn\s*on|unpause|start)\s*(?:this)?\b/i, paused: false },
  { regex: /\b(?:archive|hide)\s*(?:this)?\b/i, archived: true },
  { regex: /\b(?:unarchive|unhide|restore)\s*(?:this)?\b/i, archived: false },
];

// Bonus/Optional patterns
const BONUS_PATTERNS: Array<{ regex: RegExp; isBonus: boolean }> = [
  { regex: /\b(?:bonus|extra\s*credit|stretch\s*goal|optional|nice\s*to\s*have)\b/i, isBonus: true },
  { regex: /\b(?:required|mandatory|essential|core)\b/i, isBonus: false },
];

// Milestone patterns
const MILESTONE_PATTERNS = [
  { regex: /\b(?:milestone|checkpoint|key\s*moment|major|significant|big\s*step)\b/i, isMilestone: true },
];

// XP/Reward patterns
const XP_PATTERNS: Array<{ regex: RegExp; handler?: (m: RegExpMatchArray) => number; xp?: number; multiplier?: number }> = [
  { regex: /\b(?:worth\s*)?(\d+)\s*(?:xp|points?|pts?)\b/i, handler: (m) => parseInt(m[1]) },
  { regex: /\b(?:double|2x)\s*xp\b/i, multiplier: 2 },
  { regex: /\b(?:triple|3x)\s*xp\b/i, multiplier: 3 },
  { regex: /\bhigh\s*value\b/i, xp: 100 },
  { regex: /\bquick\s*win\b/i, xp: 25 },
];

// Title/Rename patterns
const RENAME_PATTERNS = [
  { regex: /\b(?:rename|call\s*it|change\s*(?:name|title)\s*to)\s*[:\s]*["']?(.+?)["']?$/i, handler: (m: RegExpMatchArray) => m[1].trim() },
];

// AI/Decomposition patterns
const DECOMPOSITION_PATTERNS = [
  { regex: /\b(?:break\s*(?:this\s*)?down|decompose|split\s*(?:into\s*)?(?:sub)?tasks?|suggest\s*(?:sub)?steps?|expand)\b/i, trigger: true },
];

// Plan My Day patterns
const PLAN_MY_DAY_PATTERNS = [
  { regex: /\b(?:plan|schedule|organize|optimise|optimize)\s*(?:my|the|today'?s?)?\s*(?:day|schedule|tasks?|quests?)\b/i, trigger: true },
  { regex: /\b(?:help\s*me\s*)?plan\s*(?:out\s*)?today\b/i, trigger: true },
  { regex: /\bwhat\s*should\s*I\s*do\s*(?:today|first|next)\b/i, trigger: true },
  { regex: /\b(?:build|create|make)\s*(?:my|a)?\s*schedule\b/i, trigger: true },
  { regex: /\bauto[- ]?schedule\b/i, trigger: true },
];

// Plan My Week patterns
const PLAN_MY_WEEK_PATTERNS = [
  { regex: /\b(?:plan|schedule|organize|optimise|optimize)\s*(?:my|the|this)?\s*week\b/i, trigger: true },
  { regex: /\bweekly\s*(?:plan|planning|schedule)\b/i, trigger: true },
  { regex: /\bwhat\s*should\s*I\s*do\s*this\s*week\b/i, trigger: true },
  { regex: /\b(?:build|create|make)\s*(?:my|a)?\s*weekly\s*(?:plan|schedule)\b/i, trigger: true },
  { regex: /\bplan\s*(?:out\s*)?(?:the\s*)?(?:next\s*)?(?:7|seven)\s*days?\b/i, trigger: true },
  { regex: /\bweek\s*ahead\b/i, trigger: true },
];

function cleanTaskText(text: string): string {
  let cleaned = text;

  const patternsToRemove = [
    ...TIME_PATTERNS.map(p => p.regex),
    ...DATE_PATTERNS.map(p => p.regex),
    ...DURATION_PATTERNS.map(p => p.regex),
    ...DIFFICULTY_PATTERNS.map(p => p.regex),
    ...PRIORITY_PATTERNS.map(p => p.regex),
    ...RECURRENCE_PATTERNS.map(p => p.regex),
    ...FREQUENCY_PATTERNS.map(p => p.regex),
    ...CONTEXT_PATTERNS.map(p => p.regex),
    ...ENERGY_PATTERNS.map(p => p.regex),
    ...REMINDER_PATTERNS.map(p => p.regex),
    ...NOTE_PATTERNS.map(p => p.regex),
    ...CLEAR_PATTERNS.map(p => p.regex),
    ...CATEGORY_PATTERNS.map(p => p.regex),
    ...STATUS_PATTERNS.map(p => p.regex),
    ...BONUS_PATTERNS.map(p => p.regex),
    ...MILESTONE_PATTERNS.map(p => p.regex),
    ...XP_PATTERNS.map(p => p.regex),
    ...RENAME_PATTERNS.map(p => p.regex),
    ...DECOMPOSITION_PATTERNS.map(p => p.regex),
    ...PLAN_MY_DAY_PATTERNS.map(p => p.regex),
    ...PLAN_MY_WEEK_PATTERNS.map(p => p.regex),
  ];

  patternsToRemove.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });

  cleaned = cleaned
    .replace(/\s+/g, ' ')
    .replace(/^\s*[-,;:]\s*/, '')
    .replace(/\s*[-,;:]\s*$/, '')
    .trim();

  return cleaned;
}

export function parseNaturalLanguage(input: string): ParsedTask {
  const result: ParsedTask = {
    text: input,
    difficulty: 'medium',
    scheduledTime: null,
    scheduledDate: null,
    estimatedDuration: null,
    recurrencePattern: null,
    priority: null,
    energyLevel: 'medium',
    context: null,
    isTopThree: false,
    reminderEnabled: false,
    reminderMinutesBefore: null,
    notes: null,
    contactId: null,
    autoLogInteraction: true,
    mentionedContactName: null,
    clearTime: false,
    clearDate: false,
    clearDuration: false,
    clearRecurrence: false,
    clearAll: false,
    clearCategory: false,
    clearPriority: false,
    clearNotes: false,
    clearReminder: false,
    category: null,
    frequency: null,
    customDays: null,
    paused: null,
    archived: null,
    isBonus: null,
    isMilestone: null,
    xpReward: null,
    xpMultiplier: null,
    newTitle: null,
    triggerDecomposition: false,
    triggerPlanMyDay: false,
    triggerPlanMyWeek: false,
    imageUrl: null,
  };

  // Parse clear patterns first
  for (const pattern of CLEAR_PATTERNS) {
    if (pattern.regex.test(input)) {
      if (pattern.clears === 'time' || pattern.clears === 'both') result.clearTime = true;
      if (pattern.clears === 'date' || pattern.clears === 'both') result.clearDate = true;
      if (pattern.clears === 'duration') result.clearDuration = true;
      if (pattern.clears === 'recurrence') result.clearRecurrence = true;
      if (pattern.clears === 'all') result.clearAll = true;
      if (pattern.clears === 'category') result.clearCategory = true;
      if (pattern.clears === 'priority') result.clearPriority = true;
      if (pattern.clears === 'notes') result.clearNotes = true;
      if (pattern.clears === 'reminder') result.clearReminder = true;
    }
  }

  // Parse time
  for (const pattern of TIME_PATTERNS) {
    const match = input.match(pattern.regex);
    if (match) {
      result.scheduledTime = pattern.handler(match);
      break;
    }
  }

  // Parse date
  for (const pattern of DATE_PATTERNS) {
    const match = input.match(pattern.regex);
    if (match) {
      result.scheduledDate = pattern.handler(match);
      break;
    }
  }

  // Parse duration
  for (const pattern of DURATION_PATTERNS) {
    const match = input.match(pattern.regex);
    if (match) {
      result.estimatedDuration = pattern.handler(match);
      break;
    }
  }

  // Parse difficulty
  for (const pattern of DIFFICULTY_PATTERNS) {
    if (pattern.regex.test(input)) {
      result.difficulty = pattern.result;
      break;
    }
  }

  // Parse priority
  for (const pattern of PRIORITY_PATTERNS) {
    if (pattern.regex.test(input)) {
      if (pattern.isTopThree) result.isTopThree = true;
      else if (pattern.priority && !result.priority) result.priority = pattern.priority;
    }
  }

  // Parse recurrence
  for (const pattern of RECURRENCE_PATTERNS) {
    if (pattern.regex.test(input)) {
      result.recurrencePattern = pattern.result;
      break;
    }
  }

  // Parse frequency/custom days
  for (const pattern of FREQUENCY_PATTERNS) {
    const match = input.match(pattern.regex);
    if (match) {
      if (pattern.days) result.customDays = pattern.days;
      if (pattern.frequency) result.frequency = pattern.frequency;
      break;
    }
  }

  // Parse context
  for (const pattern of CONTEXT_PATTERNS) {
    if (pattern.regex.test(input)) {
      result.context = pattern.result;
      break;
    }
  }

  // Parse energy
  for (const pattern of ENERGY_PATTERNS) {
    if (pattern.regex.test(input)) {
      result.energyLevel = pattern.result;
      break;
    }
  }

  // Parse reminder
  for (const pattern of REMINDER_PATTERNS) {
    const match = input.match(pattern.regex);
    if (match) {
      result.reminderEnabled = true;
      result.reminderMinutesBefore = pattern.handler(match);
      break;
    }
  }

  // Parse category
  for (const pattern of CATEGORY_PATTERNS) {
    if (pattern.regex.test(input)) {
      result.category = pattern.category;
      break;
    }
  }

  // Parse status
  for (const pattern of STATUS_PATTERNS) {
    if (pattern.regex.test(input)) {
      if (pattern.paused !== undefined) result.paused = pattern.paused;
      if (pattern.archived !== undefined) result.archived = pattern.archived;
      break;
    }
  }

  // Parse bonus
  for (const pattern of BONUS_PATTERNS) {
    if (pattern.regex.test(input)) {
      result.isBonus = pattern.isBonus;
      break;
    }
  }

  // Parse milestone
  for (const pattern of MILESTONE_PATTERNS) {
    if (pattern.regex.test(input)) {
      result.isMilestone = pattern.isMilestone;
      break;
    }
  }

  // Parse XP
  for (const pattern of XP_PATTERNS) {
    const match = input.match(pattern.regex);
    if (match) {
      if (pattern.handler) result.xpReward = pattern.handler(match);
      else if (pattern.xp) result.xpReward = pattern.xp;
      else if (pattern.multiplier) result.xpMultiplier = pattern.multiplier;
      break;
    }
  }

  // Parse rename
  for (const pattern of RENAME_PATTERNS) {
    const match = input.match(pattern.regex);
    if (match) {
      result.newTitle = pattern.handler(match);
      break;
    }
  }

  // Parse decomposition
  for (const pattern of DECOMPOSITION_PATTERNS) {
    if (pattern.regex.test(input)) {
      result.triggerDecomposition = pattern.trigger;
      break;
    }
  }

  // Parse plan my week (check first, more specific)
  for (const pattern of PLAN_MY_WEEK_PATTERNS) {
    if (pattern.regex.test(input)) {
      result.triggerPlanMyWeek = pattern.trigger;
      break;
    }
  }

  // Parse plan my day (only if not already week)
  if (!result.triggerPlanMyWeek) {
    for (const pattern of PLAN_MY_DAY_PATTERNS) {
      if (pattern.regex.test(input)) {
        result.triggerPlanMyDay = pattern.trigger;
        break;
      }
    }
  }

  // Parse notes
  for (const pattern of NOTE_PATTERNS) {
    const match = input.match(pattern.regex);
    if (match) {
      result.notes = pattern.handler(match);
      break;
    }
  }

  // Clean text
  result.text = cleanTaskText(input);

  return result;
}

export function useNaturalLanguageParser() {
  const [input, setInput] = useState('');
  const [parsed, setParsed] = useState<ParsedTask | null>(null);

  useEffect(() => {
    if (input.trim()) {
      setParsed(parseNaturalLanguage(input));
    } else {
      setParsed(null);
    }
  }, [input]);

  const reset = useCallback(() => {
    setInput('');
    setParsed(null);
  }, []);

  return { input, setInput, parsed, reset };
}
