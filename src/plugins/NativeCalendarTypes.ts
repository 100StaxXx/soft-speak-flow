export interface NativeCalendarDescriptor {
  readOnly?: boolean;
  id: string;
  title: string;
  isPrimary: boolean;
}

export interface NativeCalendarEventOptions {
  recurrence?: { frequency: "daily" | "weekly" | "monthly" | "yearly"; weekdays?: number[]; monthDays?: number[] };
  reminderMinutes?: number;
  expectedModifiedAt?: string;
  calendarId: string;
  eventId?: string;
  title: string;
  notes?: string | null;
  location?: string | null;
  startDate: string;
  endDate: string;
  isAllDay?: boolean;
}

export interface NativeCalendarEventDescriptor {
  notes?: string | null;
  isRecurring?: boolean;
  modifiedAt?: string | null;
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  location?: string | null;
  calendarId: string;
  calendarName: string;
  htmlLink?: string | null;
}

export interface NativeCalendarPlugin {
  findOrCreateReminder(options: { intentId: string; listId: string; createIfMissing: boolean; title?: string; notes?: string | null;
    dueDate?: string | null; completed?: boolean }): Promise<{ task: NativeReminder | null }>;
  requestReminderPermissions(): Promise<{ granted: boolean }>;
  listReminderLists(): Promise<{ lists: Array<{ id: string; title: string; readOnly?: boolean }> }>;
  listReminders(options: { listId: string }): Promise<{ tasks: NativeReminder[] }>;
  getReminder(options: { id: string }): Promise<{ task: NativeReminder | null }>;
  updateReminder(options: { id: string; title: string; dueDate: string | null; completed: boolean; etag: string }): Promise<void>;
  getEvent(options: { eventId: string }): Promise<{ event: NativeCalendarEventDescriptor | null }>;
  isAvailable(): Promise<{ available: boolean }>;
  requestPermissions(): Promise<{ granted: boolean }>;
  listCalendars(): Promise<{ calendars: NativeCalendarDescriptor[] }>;
  listEvents(options: {
    calendarId: string;
    startDate: string;
    endDate: string;
  }): Promise<{ events: NativeCalendarEventDescriptor[] }>;
  createOrUpdateEvent(options: NativeCalendarEventOptions): Promise<{ eventId: string }>;
  deleteEvent(options: { eventId: string }): Promise<{ success: boolean }>;
}

export interface NativeReminder { id: string; listId: string; title: string; notes: string | null; dueDate: string | null; completed: boolean; etag: string | null }
