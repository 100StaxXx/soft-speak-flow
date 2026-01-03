import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

export interface NativeTaskItem {
  id: string;
  task_text: string;
  completed: boolean;
  xp_reward: number;
  difficulty: string | null;
  category: string | null;
  scheduled_time: string | null;
  is_main_quest: boolean;
  section: string; // morning, afternoon, evening, unscheduled
}

export interface ShowTaskListOptions {
  tasks: NativeTaskItem[];
  frame: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface TasksReorderedEvent {
  taskIds: string[];
}

export interface TaskToggledEvent {
  taskId: string;
  completed: boolean;
}

export interface TaskDeletedEvent {
  taskId: string;
}

export interface NativeTaskListPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  showTaskList(options: ShowTaskListOptions): Promise<void>;
  updateTasks(options: { tasks: NativeTaskItem[] }): Promise<void>;
  hideTaskList(): Promise<void>;
  
  addListener(
    eventName: 'tasksReordered',
    callback: (event: TasksReorderedEvent) => void
  ): Promise<PluginListenerHandle>;
  
  addListener(
    eventName: 'taskToggled',
    callback: (event: TaskToggledEvent) => void
  ): Promise<PluginListenerHandle>;
  
  addListener(
    eventName: 'taskDeleted',
    callback: (event: TaskDeletedEvent) => void
  ): Promise<PluginListenerHandle>;
  
  removeAllListeners(): Promise<void>;
}

export const NativeTaskList = registerPlugin<NativeTaskListPlugin>('NativeTaskList', {
  web: () => import('./NativeTaskListWeb').then(m => new m.NativeTaskListWeb()),
});
