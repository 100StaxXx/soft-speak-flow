import { useTasksQuery, type DailyTask } from "./useTasksQuery";
import { useQuestMutations, type CreateQuestParams } from "./useQuestMutations";

interface DailyTasksOptions {
  enabled?: boolean;
}

/**
 * Composite hook for daily tasks - maintains backward compatibility
 * while using smaller, focused hooks internally
 */
export const useDailyTasks = (selectedDate?: Date, options: DailyTasksOptions = {}) => {
  const { enabled = true } = options;
  const { 
    tasks, 
    isLoading, 
    taskDate, 
    completedCount, 
    totalCount 
  } = useTasksQuery(selectedDate, { enabled });
  
  const { 
    createQuest,
    toggleQuest,
    deleteQuest,
    setMainQuest,
    updateQuest,
    reorderQuests,
    moveQuestToSection,
    moveQuestToDate,
    restoreQuest,
    isAdding, 
    isToggling,
    isDeleting,
    isUpdating,
    isReordering,
    isMoving,
    isMovingDate,
    isRestoring,
  } = useQuestMutations(taskDate);

  return {
    tasks,
    isLoading,
    addTask: createQuest,
    toggleTask: toggleQuest,
    deleteTask: deleteQuest,
    setMainQuest,
    updateTask: updateQuest,
    reorderTasks: reorderQuests,
    moveTaskToSection: moveQuestToSection,
    moveTaskToDate: moveQuestToDate,
    restoreTask: restoreQuest,
    isAdding,
    isToggling,
    isDeleting,
    isUpdating,
    isReordering,
    isMoving,
    isMovingDate,
    isRestoring,
    completedCount,
    totalCount,
  };
};

// Re-export types for convenience
export type { DailyTask, CreateQuestParams as AddTaskParams };
