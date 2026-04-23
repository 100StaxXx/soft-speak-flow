import { useTaskMutations } from "@/hooks/useTaskMutations";

type UseTaskMutationsArgs = Parameters<typeof useTaskMutations>;
type TaskMutationsResult = ReturnType<typeof useTaskMutations>;

export type CreateQuestParams = Parameters<TaskMutationsResult["addTask"]>[0];
export type ToggleQuestParams = Parameters<TaskMutationsResult["toggleTask"]>[0];
export type DeleteQuestParams = Parameters<TaskMutationsResult["deleteTask"]>[0];
export type RestoreQuestParams = Parameters<TaskMutationsResult["restoreTask"]>[0];
export type SetMainQuestParams = Parameters<TaskMutationsResult["setMainQuest"]>[0];
export type UpdateQuestParams = Parameters<TaskMutationsResult["updateTask"]>[0];
export type UpdateQuestInput = UpdateQuestParams["updates"];
export type ReorderQuestsParams = Parameters<TaskMutationsResult["reorderTasks"]>[0];
export type MoveQuestToSectionParams = Parameters<TaskMutationsResult["moveTaskToSection"]>[0];
export type MoveQuestToDateParams = Parameters<TaskMutationsResult["moveTaskToDate"]>[0];

// Canonical app-boundary noun: Quest. Storage ownership stays in
// useTaskMutations for now; this wrapper only normalizes the public API.
export const useQuestMutations = (
  taskDate: UseTaskMutationsArgs[0],
) => {
  const legacyMutations = useTaskMutations(taskDate);

  return {
    createQuest: legacyMutations.addTask,
    toggleQuest: legacyMutations.toggleTask,
    deleteQuest: legacyMutations.deleteTask,
    restoreQuest: legacyMutations.restoreTask,
    setMainQuest: legacyMutations.setMainQuest,
    updateQuest: legacyMutations.updateTask,
    reorderQuests: legacyMutations.reorderTasks,
    moveQuestToSection: legacyMutations.moveTaskToSection,
    moveQuestToDate: legacyMutations.moveTaskToDate,
    isAdding: legacyMutations.isAdding,
    isToggling: legacyMutations.isToggling,
    isDeleting: legacyMutations.isDeleting,
    isRestoring: legacyMutations.isRestoring,
    isUpdating: legacyMutations.isUpdating,
    isReordering: legacyMutations.isReordering,
    isMoving: legacyMutations.isMoving,
    isMovingDate: legacyMutations.isMovingDate,
  };
};
