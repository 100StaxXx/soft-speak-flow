import { describe, it, expect } from 'vitest';
import { normalizeExternalCalendarEvent } from '@/types/externalCalendar';
import { findQuestConflicts, type AvailabilityQuest } from './calendarAvailability';
const event = normalizeExternalCalendarEvent({ id: 'event', title: 'Meeting', startDate: '2026-09-19T10:00Z', endDate: '2026-09-19T11:00Z' }, 'google', 'Work')!;
const task: AvailabilityQuest = { id: 'quest', task_text: 'Walk', task_date: '2026-09-19', scheduled_time: '10:30', estimated_duration: 30 };
const conflicts = (tasks: AvailabilityQuest[], excluded: string[] = []) => findQuestConflicts(event, tasks, excluded, 'UTC');
describe('loaded agenda availability', () => {
  it('finds overlaps with Cosmiq quests, without duplicating day/week entries', () => {
    expect(conflicts([task, task])).toEqual([task]);
  });
  it('does not flag back-to-back appointments', () => {
    expect(conflicts([{ ...task, scheduled_time: '09:30' }, { ...task, id: 'later', scheduled_time: '11:00' }])).toEqual([]);
  });
  it('ignores completed, unscheduled, invalid and already-linked quests', () => {
    expect(conflicts([{ ...task, completed: true }, { ...task, id: 'inbox', task_date: null },
      { ...task, id: 'bad', scheduled_time: '99:00' }, { ...task, id: 'untimed', scheduled_time: null },
      { ...task, id: 'external:other' }, task], ['quest'])).toEqual([]);
  });
  it('finds overnight overlap from the previous day', () => {
    const overnight = { ...task, task_date: '2026-09-18', scheduled_time: '23:30', estimated_duration: 660 };
    expect(conflicts([overnight])).toEqual([overnight]);
  });
  it('does not treat all-day or free events as occupied time', () => {
    expect(findQuestConflicts({ ...event, isAllDay: true }, [task], [], 'UTC')).toEqual([]);
    expect(findQuestConflicts({ ...event, availability: 'free' }, [task], [], 'UTC')).toEqual([]);
  });
  it('interprets task wall-clock times in the chosen timezone', () => {
    expect(findQuestConflicts(event, [{ ...task, scheduled_time: '03:30' }], [], 'America/Los_Angeles')).toHaveLength(1);
  });
});
