import { WebPlugin } from '@capacitor/core';
import type {
  NativeCalendarPlugin,
  NativeCalendarDescriptor,
  NativeCalendarEventDescriptor,
  NativeCalendarEventOptions,
} from './NativeCalendarTypes';

export class NativeCalendarWeb extends WebPlugin implements NativeCalendarPlugin {
  async findOrCreateReminder(): Promise<{ task: null }> { throw new Error('Apple Reminders requires the iOS app'); }
  async requestReminderPermissions() { return { granted: false }; }
  async listReminderLists() { return { lists: [] }; }
  async listReminders() { return { tasks: [] }; }
  async getReminder() { throw new Error('Apple Reminders requires the iOS app'); return { task: null }; }
  async updateReminder() { throw new Error('Apple Reminders requires the iOS app'); }
  async getEvent(): Promise<{ event: NativeCalendarEventDescriptor | null }> { throw new Error('Apple Calendar requires the iOS app'); }
  async isAvailable(): Promise<{ available: boolean }> {
    return { available: false };
  }

  async requestPermissions(): Promise<{ granted: boolean }> {
    return { granted: false };
  }

  async listCalendars(): Promise<{ calendars: NativeCalendarDescriptor[] }> {
    return { calendars: [] };
  }

  async listEvents(_options: {
    calendarId: string;
    startDate: string;
    endDate: string;
  }): Promise<{ events: NativeCalendarEventDescriptor[] }> {
    return { events: [] };
  }

  async createOrUpdateEvent(_options: NativeCalendarEventOptions): Promise<{ eventId: string }> {
    throw new Error('Native Apple Calendar is only available on iOS native builds');
  }

  async deleteEvent(_options: { eventId: string }): Promise<{ success: boolean }> {
    return { success: false };
  }
}
