import { WebPlugin } from '@capacitor/core';
import type { WidgetDataPlugin, WidgetTask } from './WidgetDataPlugin';

export class WidgetDataWeb extends WebPlugin implements WidgetDataPlugin {
  async updateWidgetData(_options: {
    tasks: WidgetTask[];
    completedCount: number;
    totalCount: number;
    ritualCount: number;
    ritualCompleted: number;
    date: string;
  }): Promise<void> {
    console.log('[WidgetData] Web fallback - no widget support');
  }
  
  async reloadWidget(): Promise<void> {
    console.log('[WidgetData] Web fallback - no widget support');
  }
}
