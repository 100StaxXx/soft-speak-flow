import type { ParsedTask } from './naturalLanguageTaskParser';

export type SchedulingIntentDisposition =
  | 'read_only'
  | 'schedule_action'
  | 'conversation';

export type SchedulingIntentSurface = 'companion' | 'journeys';

export interface SchedulingIntentAnalysis {
  disposition: SchedulingIntentDisposition;
  isScheduleRead: boolean;
  isDirectDayPlanning: boolean;
  isChatFirstCoaching: boolean;
  isChatEscape: boolean;
  hasExplicitPlannerAction: boolean;
  hasConcreteSchedulingPayload: boolean;
  hasMeaningfulTitle: boolean;
}

const SCHEDULE_QUESTION_REGEX =
  /\b(what do i have coming up|what do i have scheduled|what(?:'s| is) coming up|what(?:'s| is) on my calendar|what(?:'s| is) my schedule|what(?:'s| is) on my plate|when am i free|am i free|where do i have room|what(?:'s| is) open|what openings do i have|what time do i have free|show me (?:today|tomorrow|my|this|next|upcoming).*(?:route|schedule)|how does (?:today|tomorrow|my day|my upcoming|this|next|upcoming).*(?:look|feel))\b/i;

const SCHEDULE_DAY_REFERENCE_REGEX =
  /\b(?:today|tomorrow|my day|(?:my\s+)?(?:this\s+|next\s+|upcoming\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i;

const DIRECT_DAY_PLANNING_REGEX =
  /\b(plan(?: my)? (?:day|today|tomorrow|week)|organize(?: my)? (?:day|today|week)|prioritize(?: my)? (?:day|today|week)|build (?:me )?(?:a )?(?:day|week) plan|help me break a big goal into steps|help me make room for what matters)\b/i;

const CHAT_FIRST_COACHING_REGEX =
  /\b(what should i focus on|help me figure out (?:today|tomorrow|this week)|help me sort out (?:today|tomorrow|this week)|i feel scattered|i feel overwhelmed|how should i use (?:today|tomorrow))\b/i;

const CHAT_ESCAPE_REGEX =
  /\b(talk to me|help me think|i feel|i'm feeling|how do i|can we just chat|just chat|pep talk|talk it through)\b/i;

const PLANNER_ACTION_REGEX =
  /\b(schedule|reschedule|move|shift|push|pull|adjust|edit|update|rename|repeat|remind(?: me)?|create|add|set up|put|place|slot|book|fit|squeeze|lock in|turn .+ into|make .+ repeat)\b/i;

const PLANNER_ENTITY_REGEX =
  /\b(calendar|campaign|ritual|habit|quest|quests|task|tasks|reminder|reminders)\b/i;

const CALENDAR_SLOT_REGEX =
  /\b(today|tomorrow|tonight|this morning|this afternoon|this evening|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening|night|daily|weekly|monthly|weekdays|every day|every week|every month|at \d{1,2}(?::\d{2})?|\d{4}-\d{2}-\d{2})\b/i;

const PARSED_TITLE_SCAFFOLD_TOKENS = new Set([
  'add',
  'at',
  'calendar',
  'for',
  'in',
  'into',
  'my',
  'on',
  'onto',
  'place',
  'put',
  's',
  'schedule',
  'slot',
  'the',
  'to',
  'today',
  'todays',
  'tomorrow',
  'tomorrows',
]);

const hasMeaningfulParsedSchedulingTitle = (value: string | null | undefined): boolean => {
  const normalized = (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return false;

  return normalized
    .split(' ')
    .some((token) => token.length > 0 && !PARSED_TITLE_SCAFFOLD_TOKENS.has(token));
};

export const isScheduleReadMessage = (message: string): boolean => {
  if (SCHEDULE_QUESTION_REGEX.test(message)) return true;
  if (!SCHEDULE_DAY_REFERENCE_REGEX.test(message)) return false;

  if (
    /\b(when am i free|am i free|where do i have room|what(?:'s| is) open|what openings do i have|what time do i have free)\b/i
      .test(message)
  ) {
    return true;
  }

  return /\b(show me|how does|how(?:'s| is)|what does)\b/i.test(message) &&
    /\b(route|look|looking|schedule)\b/i.test(message);
};

export const analyzeSchedulingIntent = (
  message: string,
  parsed: ParsedTask,
): SchedulingIntentAnalysis => {
  const isScheduleRead = isScheduleReadMessage(message);
  const isDirectDayPlanning = DIRECT_DAY_PLANNING_REGEX.test(message);
  const isChatFirstCoaching = CHAT_FIRST_COACHING_REGEX.test(message);
  const isChatEscape = CHAT_ESCAPE_REGEX.test(message);
  const hasMeaningfulTitle = hasMeaningfulParsedSchedulingTitle(parsed.text);
  const hasConcreteSchedulingPayload = Boolean(
    parsed.scheduledDate ||
    parsed.scheduledTime ||
    parsed.recurrencePattern ||
    parsed.reminderMinutesBefore,
  );

  const hasExplicitPlannerAction = PLANNER_ACTION_REGEX.test(message) && (
    PLANNER_ENTITY_REGEX.test(message) ||
    CALENDAR_SLOT_REGEX.test(message) ||
    hasMeaningfulTitle ||
    /turn .+ into/i.test(message)
  );

  const isReadOnly = isScheduleRead ||
    isDirectDayPlanning ||
    isChatFirstCoaching ||
    isChatEscape;

  if (isReadOnly) {
    return {
      disposition: 'read_only',
      isScheduleRead,
      isDirectDayPlanning,
      isChatFirstCoaching,
      isChatEscape,
      hasExplicitPlannerAction,
      hasConcreteSchedulingPayload,
      hasMeaningfulTitle,
    };
  }

  if (hasExplicitPlannerAction || (hasMeaningfulTitle && hasConcreteSchedulingPayload)) {
    return {
      disposition: 'schedule_action',
      isScheduleRead,
      isDirectDayPlanning,
      isChatFirstCoaching,
      isChatEscape,
      hasExplicitPlannerAction,
      hasConcreteSchedulingPayload,
      hasMeaningfulTitle,
    };
  }

  return {
    disposition: 'conversation',
    isScheduleRead,
    isDirectDayPlanning,
    isChatFirstCoaching,
    isChatEscape,
    hasExplicitPlannerAction,
    hasConcreteSchedulingPayload,
    hasMeaningfulTitle,
  };
};

export const shouldRouteMessageToPlanner = ({
  surface,
  analysis,
  hasOpenPlannerThread = false,
}: {
  surface: SchedulingIntentSurface;
  analysis: SchedulingIntentAnalysis;
  hasOpenPlannerThread?: boolean;
}): boolean => {
  const isJourneysChatFirst = analysis.disposition === 'read_only';

  if (hasOpenPlannerThread) {
    if (surface !== 'journeys') return true;
    if (!isJourneysChatFirst) return true;
  }

  if (surface === 'journeys') {
    return analysis.disposition === 'schedule_action';
  }

  if (analysis.disposition === 'schedule_action') return true;
  if (analysis.isScheduleRead || analysis.isDirectDayPlanning) return true;
  return false;
};
