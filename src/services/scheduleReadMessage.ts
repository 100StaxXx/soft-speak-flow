import type { CalendarProvider } from '@/hooks/useCalendarIntegrations';
export type ScheduleReadIssue = 'timeout' | 'calendar-settings' | 'device-storage' | 'local-sync' | 'schedule-updating' | 'offline' | 'tasks' | 'time-blocks' | CalendarProvider | 'apple-access' | 'apple-missing' | 'apple-unselected' | 'apple-unavailable' | 'apple-range' | 'apple-timeout';
export function calendarReadIssue(provider: CalendarProvider, reason: unknown): ScheduleReadIssue {
  const message = reason && typeof reason === 'object' && 'message' in reason ? reason.message : reason;
  if (message === 'Schedule check timed out') return provider === 'apple' ? 'apple-timeout' : 'timeout';
  if (provider !== 'apple') return provider;
  if (reason && typeof reason === 'object' && 'code' in reason && reason.code === 'UNIMPLEMENTED') return 'apple-unavailable';
  switch (message) {
    case 'Calendar access not granted':
    case 'Permission denied': return 'apple-access';
    case 'Calendar not found': return 'apple-missing';
    case 'Choose an Apple calendar in Preferences before syncing Agenda.': return 'apple-unselected';
    case 'Apple Calendar is unavailable in this app build.': return 'apple-unavailable';
    case 'Invalid calendar event range':
    case 'calendarId, startDate, and endDate are required': return 'apple-range';
    default: return 'apple';
  }
}

export function scheduleReadMessage(issues: ScheduleReadIssue[] = []): string {
  const messages: Record<ScheduleReadIssue, string> = {
    timeout: 'Checking your schedule took too long. Try again, or review the time yourself.',
    'calendar-settings': 'Your calendar connections could not be loaded. Try again to refresh them.',
    'device-storage': 'Your on-device schedule could not be read. Close and reopen COSMIQ, then try again.',
    'local-sync': 'Some schedule changes are still syncing. We’ll check again when sync finishes.',
    'schedule-updating': 'Your schedule is updating. Please check again in a moment.',
    offline: 'You’re offline. Reconnect to check your latest schedule.',
    tasks: 'Your saved quests could not be loaded. Check your connection and try again.',
    'time-blocks': 'Your recurring quests could not be checked. Review them in Agenda, then try again.',
    apple: 'COSMIQ couldn’t read Apple Calendar. Try again.',
    'apple-access': 'COSMIQ doesn’t have permission to read events. Give COSMIQ Full Access to Calendars in iPhone Settings, then retry.',
    'apple-missing': 'Your selected Apple calendar could not be found on this device. Choose an available calendar in COSMIQ Preferences, then retry.',
    'apple-unselected': 'Choose an Apple calendar in COSMIQ Preferences, then retry.',
    'apple-unavailable': 'This version of COSMIQ can’t read Apple Calendar here. Use the iPhone app or plan with your own input.',
    'apple-range': 'COSMIQ couldn’t check Apple Calendar for the requested dates. Review the planning date and retry.',
    'apple-timeout': 'Apple Calendar took too long to respond. Tap Retry to check it again.',
    google: 'Google Calendar could not be checked. Review its connection in Calendar settings, then try again.',
    outlook: 'Outlook Calendar could not be checked. Review its connection in Calendar settings, then try again.',
  };
  return issues.length ? [...new Set(issues)].map(issue => messages[issue]).join(' ') : 'Some booked time could not be checked. Try again before planning.';
}
