import { registerPlugin } from '@capacitor/core';

export interface NativeCalendarDescriptor {
  id: string;
  title: string;
  isPrimary: boolean;
}

export interface NativeCalendarEventOptions {
  calendarId: string;
  eventId?: string;
  title: string;
  notes?: string | null;
  location?: string | null;
  startDate: string; // ISO
  endDate: string; // ISO
  isAllDay?: boolean;
}

export interface NativeCalendarPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  requestPermissions(): Promise<{ granted: boolean }>;
  listCalendars(): Promise<{ calendars: NativeCalendarDescriptor[] }>;
  createOrUpdateEvent(options: NativeCalendarEventOptions): Promise<{ eventId: string }>;
  deleteEvent(options: { eventId: string }): Promise<{ success: boolean }>;
}

export const NativeCalendar = registerPlugin<NativeCalendarPlugin>('NativeCalendar', {
  web: () => import('./NativeCalendarWeb').then((m) => new m.NativeCalendarWeb()),
});
