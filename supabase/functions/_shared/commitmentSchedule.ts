import { calendarLocalParts, calendarZonedDate } from './calendarTime.ts';

export interface CommitmentBlock {
  id: string;
  title: string;
  kind: 'work' | 'school' | 'commute' | 'other';
  repeat: 'weekly' | 'once';
  days: number[]; // Sunday = 0. A night shift belongs to its starting day.
  start: string;
  end: string;
  starts_on: string;
  ends_on: string | null;
  track_completion?: boolean;
}
export interface CommitmentSchedule {
  timezone: string;
  blocks: CommitmentBlock[];
}
export interface CommitmentOccurrence {
  id: string;
  block_id: string;
  occurrence_date: string;
  track_completion: boolean;
  title: string;
  start: string;
  end: string;
}
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export const shiftCommitmentDate = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
export function validateCommitmentSchedule(schedule: CommitmentSchedule): void {
  new Intl.DateTimeFormat('en', { timeZone: schedule.timezone }).format();
  if (!Array.isArray(schedule.blocks) || schedule.blocks.length > 50) throw new Error('Use up to 50 time blocks.');
  const ids = new Set<string>();
  for (const block of schedule.blocks) {
    if (block.track_completion !== undefined && typeof block.track_completion !== 'boolean') throw new Error('Choose whether to track completion.');
    if (!block.id || ids.has(block.id)) throw new Error('Each time block needs its own ID.');
    ids.add(block.id);
    if (!block.title?.trim() || block.title.length > 80) throw new Error('Give each block a name of up to 80 characters.');
    if (!['work', 'school', 'commute', 'other'].includes(block.kind)) throw new Error('Choose a commitment type.');
    if (!['weekly', 'once'].includes(block.repeat)) throw new Error('Choose a repeat schedule.');
    if (!timePattern.test(block.start) || !timePattern.test(block.end) || block.start === block.end) throw new Error('Choose different start and end times.');
    if (!Array.isArray(block.days) || block.days.some(day => !Number.isInteger(day) || day < 0 || day > 6)
      || new Set(block.days).size !== block.days.length || (block.repeat === 'weekly' && !block.days.length)) throw new Error('Choose the days for this block.');
    if (!validDate(block.starts_on) || (block.ends_on !== null && (!validDate(block.ends_on) || block.ends_on < block.starts_on))) throw new Error('Check the start and end dates.');
  }
}
// Fall-back folds reserve both copies of an ambiguous wall time. Spring gaps
// widen to the closest real boundaries so a nonexistent hour never looks free.
export function boundary(date: string, time: string, timezone: string, end: boolean): Date {
  let point: Date;
  try { point = calendarZonedDate(date, time, timezone); }
  catch {
    const wall = new Date(`${date}T${time}:00Z`);
    for (let minute = 1; minute <= 180; minute++) {
      const adjusted = new Date(wall.getTime() + (end ? minute : -minute) * 60000);
      try { return calendarZonedDate(adjusted.toISOString().slice(0, 10), adjusted.toISOString().slice(11, 16), timezone); }
      catch { /* Continue through the DST gap. */ }
    }
    throw new Error('Unable to resolve commitment timezone.');
  }
  const candidates = [point];
  for (const minutes of [-120, -90, -60, -30, 30, 60, 90, 120]) {
    const candidate = new Date(point.getTime() + minutes * 60000);
    const local = calendarLocalParts(candidate, timezone);
    if (local.date === date && local.time === time) candidates.push(candidate);
  }
  return new Date((end ? Math.max : Math.min)(...candidates.map(value => value.getTime())));
}
/** Range dates are in the viewer's timezone; blocks stay in their saved timezone. */
export function expandCommitments(schedule: CommitmentSchedule | null, from: string, through: string, viewerTimezone = schedule?.timezone ?? 'UTC'): CommitmentOccurrence[] {
  if (!schedule) return [];
  validateCommitmentSchedule(schedule);
  if (!validDate(from) || !validDate(through) || through < from
    || Date.parse(through) - Date.parse(from) > 370 * 86400000) throw new Error('Invalid commitment date range.');
  const offset = viewerTimezone === 'Z' || /^[+-]\d{2}:\d{2}$/.test(viewerTimezone);
  const rangeStart = offset ? Date.parse(`${from}T00:00:00${viewerTimezone}`) : boundary(from, '00:00', viewerTimezone, false).getTime();
  const rangeEnd = offset ? Date.parse(`${shiftCommitmentDate(through, 1)}T00:00:00${viewerTimezone}`) : boundary(shiftCommitmentDate(through, 1), '00:00', viewerTimezone, true).getTime();
  const first = shiftCommitmentDate(calendarLocalParts(new Date(rangeStart), schedule.timezone).date, -1);
  const last = calendarLocalParts(new Date(rangeEnd), schedule.timezone).date;
  const result: CommitmentOccurrence[] = [];
  for (let date = first; date <= last; date = shiftCommitmentDate(date, 1)) {
    const day = new Date(`${date}T12:00:00Z`).getUTCDay();
    for (const block of schedule.blocks) {
      if (date < block.starts_on || (block.ends_on && date > block.ends_on)) continue;
      if (block.repeat === 'once' ? date !== block.starts_on : !block.days.includes(day)) continue;
      const start = boundary(date, block.start, schedule.timezone, false);
      const end = boundary(block.end < block.start ? shiftCommitmentDate(date, 1) : date, block.end, schedule.timezone, true);
      if (start.getTime() < rangeEnd && end.getTime() > rangeStart) result.push({
        id: `commitment:${block.id}:${date}`, block_id: block.id, occurrence_date: date, track_completion: true, title: block.title, start: start.toISOString(), end: end.toISOString(),
      });
    }
  }
  return result.sort((a, b) => a.start.localeCompare(b.start));
}
/** Finds a possible window, never saves or moves a quest. Overlaps form a union. */
export function findCommitmentAwareSlot(busy: { start: number; end: number }[], start: number, end: number, minutes: number): number | null {
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  let cursor = Math.ceil(start / 300000) * 300000;
  const duration = minutes * 60000;
  for (const block of busy.filter(b => Number.isFinite(b.start) && b.end > b.start).sort((a, b) => a.start - b.start)) {
    if (block.end <= cursor) continue;
    if (cursor + duration <= Math.min(block.start, end)) return cursor;
    cursor = Math.max(cursor, block.end);
  }
  return cursor + duration <= end ? cursor : null;
}
