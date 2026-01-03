import { WebPlugin } from '@capacitor/core';
import type { NativeTaskListPlugin, ShowTaskListOptions, NativeTaskItem } from './NativeTaskListPlugin';

/**
 * Web fallback - returns not available so React uses web-based drag
 */
export class NativeTaskListWeb extends WebPlugin implements NativeTaskListPlugin {
  async isAvailable(): Promise<{ available: boolean }> {
    return { available: false };
  }
  
  async showTaskList(_options: ShowTaskListOptions): Promise<void> {
    console.log('[NativeTaskList] Web fallback - using React drag-and-drop');
  }
  
  async updateTasks(_options: { tasks: NativeTaskItem[] }): Promise<void> {
    // No-op on web
  }
  
  async hideTaskList(): Promise<void> {
    // No-op on web
  }
}
