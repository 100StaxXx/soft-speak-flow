import { WebPlugin } from '@capacitor/core';
import type { WidgetDataPlugin, WidgetSyncDiagnostics, WidgetTask } from './WidgetDataPlugin';

export class WidgetDataWeb extends WebPlugin implements WidgetDataPlugin {
  async updateWidgetData(_options: {
    tasks: WidgetTask[];
    completedCount: number;
    totalCount: number;
    ritualCount: number;
    ritualCompleted: number;
    date: string;
  }): Promise<void> {
    if (import.meta.env.DEV) {
      console.debug('[WidgetData] Web fallback - no widget support');
    }
  }
  
  async reloadWidget(): Promise<void> {
    if (import.meta.env.DEV) {
      console.debug('[WidgetData] Web fallback - no widget support');
    }
  }

  async getWidgetSyncDiagnostics(): Promise<WidgetSyncDiagnostics> {
    if (import.meta.env.DEV) {
      console.debug('[WidgetData] Web fallback - no widget diagnostics support');
    }

    return {
      appGroupAccessible: false,
      hasPayload: false,
      payloadDate: null,
      payloadUpdatedAt: null,
      payloadByteCount: 0,
    };
  }
}
