import { WebPlugin } from '@capacitor/core';
import type {
  WidgetDataPlugin,
  WidgetSyncDiagnostics,
  WidgetSyncProbeResult,
  WidgetTask,
} from './WidgetDataPlugin';

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
      appGroupId: 'group.com.darrylgraham.revolution',
      dataKey: 'widget_tasks_data',
      lastErrorCode: null,
      lastErrorMessage: null,
    };
  }

  async runWidgetSyncProbe(): Promise<WidgetSyncProbeResult> {
    if (import.meta.env.DEV) {
      console.debug('[WidgetData] Web fallback - no widget sync probe support');
    }

    return {
      appGroupAccessible: false,
      writeSucceeded: false,
      readBackSucceeded: false,
      payloadByteCount: 0,
      errorCode: 'UNSUPPORTED_PLATFORM',
      errorMessage: 'Widget sync probe is only available on native iOS.',
      timestamp: new Date().toISOString(),
    };
  }
}
