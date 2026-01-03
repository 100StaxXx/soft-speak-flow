import { useEffect, useRef, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { NativeTaskList, NativeTaskItem } from '@/plugins/NativeTaskListPlugin';
import { getTaskSection } from '@/components/DraggableSectionList';

interface Task {
  id: string;
  task_text: string;
  completed: boolean | null;
  xp_reward: number;
  difficulty?: string | null;
  category?: string | null;
  scheduled_time?: string | null;
  is_main_quest?: boolean | null;
}

interface UseNativeTaskListOptions {
  tasks: Task[];
  containerRef: React.RefObject<HTMLDivElement>;
  onReorder: (taskIds: string[]) => void;
  onToggle: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
}

export function useNativeTaskList({
  tasks,
  containerRef,
  onReorder,
  onToggle,
  onDelete,
}: UseNativeTaskListOptions) {
  const [isNativeAvailable, setIsNativeAvailable] = useState(false);
  const [isNativeActive, setIsNativeActive] = useState(false);
  const listenersRef = useRef<Array<{ remove: () => void }>>([]);
  const isInitializedRef = useRef(false);
  
  // Check if native plugin is available
  useEffect(() => {
    const checkAvailability = async () => {
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
        try {
          const result = await NativeTaskList.isAvailable();
          setIsNativeAvailable(result.available);
        } catch {
          setIsNativeAvailable(false);
        }
      }
    };
    
    checkAvailability();
  }, []);
  
  // Convert tasks to native format
  const convertToNativeTasks = useCallback((tasks: Task[]): NativeTaskItem[] => {
    return tasks.map(task => ({
      id: task.id,
      task_text: task.task_text,
      completed: task.completed ?? false,
      xp_reward: task.xp_reward,
      difficulty: task.difficulty ?? null,
      category: task.category ?? null,
      scheduled_time: task.scheduled_time ?? null,
      is_main_quest: task.is_main_quest ?? false,
      section: getTaskSection(task.scheduled_time),
    }));
  }, []);
  
  // Setup native list
  useEffect(() => {
    if (!isNativeAvailable || isInitializedRef.current) return;
    
    const setupNativeList = async () => {
      try {
        // Get container position
        const container = containerRef.current;
        if (!container) return;
        
        const rect = container.getBoundingClientRect();
        const safeAreaTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0', 10);
        
        // Setup event listeners
        const reorderListener = await NativeTaskList.addListener('tasksReordered', (event) => {
          onReorder(event.taskIds);
        });
        
        const toggleListener = await NativeTaskList.addListener('taskToggled', (event) => {
          onToggle(event.taskId);
        });
        
        const deleteListener = await NativeTaskList.addListener('taskDeleted', (event) => {
          onDelete?.(event.taskId);
        });
        
        listenersRef.current = [reorderListener, toggleListener, deleteListener];
        
        // Show native list
        await NativeTaskList.showTaskList({
          tasks: convertToNativeTasks(tasks),
          frame: {
            x: rect.left,
            y: rect.top + safeAreaTop,
            width: rect.width,
            height: rect.height,
          },
        });
        
        setIsNativeActive(true);
        isInitializedRef.current = true;
      } catch (error) {
        console.error('[NativeTaskList] Failed to setup:', error);
        setIsNativeAvailable(false);
      }
    };
    
    setupNativeList();
    
    return () => {
      // Cleanup on unmount
      if (isInitializedRef.current) {
        NativeTaskList.hideTaskList().catch(() => {});
        listenersRef.current.forEach(l => l.remove());
        listenersRef.current = [];
        isInitializedRef.current = false;
      }
    };
  }, [isNativeAvailable, containerRef, convertToNativeTasks, onReorder, onToggle, onDelete, tasks]);
  
  // Update tasks when they change
  useEffect(() => {
    if (!isNativeActive) return;
    
    NativeTaskList.updateTasks({
      tasks: convertToNativeTasks(tasks),
    }).catch(console.error);
  }, [tasks, isNativeActive, convertToNativeTasks]);
  
  return {
    isNative: isNativeActive,
    isNativeAvailable,
  };
}
