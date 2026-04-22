import { toQuest } from "@/features/quests/adapters";
import { useDailyTasks } from "@/hooks/useDailyTasks";

type UseDailyTasksArgs = Parameters<typeof useDailyTasks>;

export const useQuests = (
  selectedDate?: UseDailyTasksArgs[0],
  options: UseDailyTasksArgs[1] = {},
) => {
  const legacyTasks = useDailyTasks(selectedDate, options);

  return {
    quests: legacyTasks.tasks.map(toQuest),
    isLoading: legacyTasks.isLoading,
    completedCount: legacyTasks.completedCount,
    totalCount: legacyTasks.totalCount,
    createQuest: legacyTasks.addTask,
    toggleQuest: legacyTasks.toggleTask,
    deleteQuest: legacyTasks.deleteTask,
    setMainQuest: legacyTasks.setMainQuest,
    updateQuest: legacyTasks.updateTask,
    reorderQuests: legacyTasks.reorderTasks,
    moveQuestToSection: legacyTasks.moveTaskToSection,
    moveQuestToDate: legacyTasks.moveTaskToDate,
    restoreQuest: legacyTasks.restoreTask,
    isAdding: legacyTasks.isAdding,
    isToggling: legacyTasks.isToggling,
    isDeleting: legacyTasks.isDeleting,
    isUpdating: legacyTasks.isUpdating,
    isReordering: legacyTasks.isReordering,
    isMoving: legacyTasks.isMoving,
    isMovingDate: legacyTasks.isMovingDate,
    isRestoring: legacyTasks.isRestoring,
  };
};
