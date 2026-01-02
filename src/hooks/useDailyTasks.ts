import { useTasksQuery, type DailyTask } from "./useTasksQuery";
import { useTaskMutations, type AddTaskParams } from "./useTaskMutations";

/**
 * Composite hook for daily tasks - maintains backward compatibility
 * while using smaller, focused hooks internally
 */
export const useDailyTasks = (selectedDate?: Date) => {
  const { 
    tasks, 
    isLoading, 
    taskDate, 
    completedCount, 
    totalCount 
  } = useTasksQuery(selectedDate);
  
  const { 
    addTask, 
    toggleTask, 
    deleteTask, 
    setMainQuest,
    updateTask,
    reorderTasks,
    moveTaskToSection,
    isAdding, 
    isToggling,
    isUpdating,
    isReordering,
    isMoving,
  } = useTaskMutations(taskDate);

  return {
    tasks,
    isLoading,
    addTask,
    toggleTask,
    deleteTask,
    setMainQuest,
    updateTask,
    reorderTasks,
    moveTaskToSection,
    isAdding,
    isToggling,
    isUpdating,
    isReordering,
    isMoving,
    completedCount,
    totalCount,
  };
};

// Re-export types for convenience
export type { DailyTask, AddTaskParams };
