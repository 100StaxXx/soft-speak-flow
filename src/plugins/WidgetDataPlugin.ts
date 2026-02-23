import { registerPlugin } from '@capacitor/core';

export interface WidgetTask {
  id: string;
  text: string;
  completed: boolean;
  xpReward: number;
  isMainQuest: boolean;
  category: string | null;
  section: string;
  scheduledTime: string | null;
}

export interface WidgetSyncDiagnostics {
  appGroupAccessible: boolean;
  hasPayload: boolean;
  payloadDate: string | null;
  payloadUpdatedAt: string | null;
  payloadByteCount: number;
}

export interface WidgetDataPlugin {
  updateWidgetData(options: {
    tasks: WidgetTask[];
    completedCount: number;
    totalCount: number;
    ritualCount: number;
    ritualCompleted: number;
    date: string;
  }): Promise<void>;
  reloadWidget(): Promise<void>;
  getWidgetSyncDiagnostics(): Promise<WidgetSyncDiagnostics>;
}

export const WidgetData = registerPlugin<WidgetDataPlugin>('WidgetData', {
  web: () => import('./WidgetDataWeb').then(m => new m.WidgetDataWeb()),
});
