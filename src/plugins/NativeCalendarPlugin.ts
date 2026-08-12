import { registerPlugin } from '@capacitor/core';
import type { NativeCalendarPlugin } from "./NativeCalendarTypes";

export type {
  NativeCalendarDescriptor,
  NativeCalendarEventDescriptor,
  NativeCalendarEventOptions,
  NativeCalendarPlugin,
} from "./NativeCalendarTypes";

export const NativeCalendar = registerPlugin<NativeCalendarPlugin>('NativeCalendar', {
  web: () => import('./NativeCalendarWeb').then((m) => new m.NativeCalendarWeb()),
});
