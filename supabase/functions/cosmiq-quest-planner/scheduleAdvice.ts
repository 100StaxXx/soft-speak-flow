import { calendarLocalParts, calendarZonedDate } from '../_shared/calendarTime.ts';
import { ritualScheduledOnDate } from '../../../src/shared/ritualSchedule.ts';
import { shiftCommitmentDate } from '../_shared/commitmentSchedule.ts';
import { interestKey } from '../_shared/plannerLearning.ts';
import type { PlanningReply } from './planning.ts';

export type ScheduleCheck = { kind: 'reuse' | 'prerequisite'; booking_id: string; activity: string; needed_item?: string | null };
export type ScheduleAnchor = { id: string; title: string; start: string };
type Routine = Parameters<typeof ritualScheduledOnDate>[0] & {id: string; title: string};
type RoutineDay = {id: string; title: string; routineDate: string};
type PlanningAnchor = ScheduleAnchor | RoutineDay;

/** A ritual date can support reuse without reserving a clock time. */
export function upcomingRoutineDays(routines: Routine[], date: string, through: string) {
  const upcoming = new Map<string, RoutineDay>();
  for (let day = shiftCommitmentDate(date, 1); day <= through; day = shiftCommitmentDate(day, 1)) {
    for (const routine of routines) {
      if (upcoming.has(routine.id) || !routine.frequency || !ritualScheduledOnDate(routine, day)) continue;
      upcoming.set(routine.id, {id:'routine:' + routine.id + '@' + day, title:routine.title, routineDate:day});
    }
  }
  return [...upcoming.values()];
}
type DatedTask = {
  id: string; task_text: string; task_date: string | null; scheduled_time: string | null;
  schedule_timezone: string | null;
};

export function scheduleAnchors(rows: DatedTask[], bookings: ScheduleAnchor[], date: string, through: string, zone: string, now = Date.now()) {
  const occurrences = new Map<string, ScheduleAnchor>();
  function add(booking: ScheduleAnchor) {
    // A recurring template may have multiple real occurrences with the same row ID.
    const id = booking.id + '@' + Date.parse(booking.start);
    occurrences.set(id, {...booking, id});
  }
  for (const row of rows) {
    if (!row.task_date || !row.scheduled_time) continue;
    // A future entry with an invalid wall clock cannot establish a booking.
    let start: Date;
    try { start = calendarZonedDate(row.task_date, row.scheduled_time.slice(0, 5), row.schedule_timezone || zone); }
    catch { continue; }
    add({ id: row.id, title: row.task_text, start: start.toISOString() });
  }
  for (const booking of bookings) add(booking);
  return [...occurrences.values()].filter(booking => {
    const day = calendarLocalParts(new Date(booking.start), zone).date;
    return Date.parse(booking.start) >= now && day >= date && day <= through;
  }).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

export function scheduleCheckQuestion(check: ScheduleCheck, anchors: PlanningAnchor[], timezone: string) {
  const booking = anchors.find(anchor => anchor.id === check.booking_id);
  if (!booking || !['reuse', 'prerequisite'].includes(check.kind) || typeof check.activity !== 'string' || !check.activity.trim() || check.activity.length > 100)
    throw new Error('Use a real scheduleAnchors ID and the requested activity for a schedule check.');
  if (check.needed_item != null && (typeof check.needed_item !== 'string' || !check.needed_item.trim() || check.needed_item.length > 80))
    throw new Error('Describe the possible prerequisite briefly.');
  const routine = 'routineDate' in booking;
  if (routine && check.kind !== 'reuse') throw new Error('Use a confirmed booking for a prerequisite.');
  const when = routine
    ? new Intl.DateTimeFormat('en-US', {timeZone:'UTC', weekday:'long', month:'short', day:'numeric'}).format(new Date(booking.routineDate + 'T12:00:00Z'))
    : new Intl.DateTimeFormat('en-US', {timeZone:timezone, weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}).format(new Date(booking.start));
  const bookingLabel = booking.title.slice(0, 160) + (routine ? ' is part of your routine on ' : ' is scheduled for ') + when + '. ';
  const reuse = check.kind === 'reuse';
  return {
    phase: 'details' as const, schedule_check: check,
    reply: bookingLabel + (reuse ? 'Would you like to use that session for ' + check.activity + ', or add an extra session?' : 'Do you already have ' + (check.needed_item || 'what you need') + ' for ' + check.activity + ', or would it help to plan it after that booking?'),
    choices: reuse ? ['Use the existing session', 'Add an extra session'] : ['I have what I need', 'Help me plan it afterward'],
    input_hint: 'Choose an option or tell me what works for you…', quests: [], time_choices: [],
  };
}

export function existingSessionReply(message: string, draft: PlanningReply | null, anchors: PlanningAnchor[]): PlanningReply | null {
  if (message.trim() !== 'Use the existing session' || draft?.schedule_check?.kind !== 'reuse') return null;
  const booking = anchors.find(anchor => anchor.id === draft.schedule_check?.booking_id);
  if (!booking) return {phase:'details', reply:'I can no longer verify that session on your schedule. Would you like to check another session or choose a new time?', choices:['Check another session','Choose a new time'], engagements:draft.engagements || [], quests:[]};
  return { phase: 'goals', reply: 'You can use your existing ' + booking.title.slice(0, 160) + ' session. Anything else you’d like to plan?',
    choices: ['Plan another quest', 'Finish planning'], engagements: draft.engagements || [], quests: [] };
}

export function requestedExtraSession(message: string) {
  return /\b(?:another|extra|additional|second)\s+(?!(?:time|slot|option|date|day|idea|alternative|activity|quest to plan)\b)(?:[\w-]+\s+){0,2}(?:session|workout|walk|run|class|practice|lesson|occurrence|night)\b|\b(?:do (?:it|that) again|(?:read|cook|practice|walk|run|work out) again|twice (?:today|that day))\b/i.test(message)
    && !/\b(?:no|skip|avoid|without|don['’]t (?:want|add|need)) (?:an? )?(?:extra|another|second|additional)\b/i.test(message);
}

export function nextMemorySuggestion(suggestion: string | null | undefined, message: string, handled: string[]) {
  if (!suggestion || /\b(?:just (?:for )?(?:now|today|tonight|this (?:time|once))|(?:today|tonight|this time) only|one[- ]time exception|only (?:for )?(?:today|tonight|this time)|don['’]t (?:remember|save))\b/i.test(message)) return null;
  return handled.some(value => interestKey(value) === interestKey(suggestion)) ? null : suggestion;
}
