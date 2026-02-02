import { useState, useCallback } from "react";
import { QuestDifficulty, QuestFormState, PendingTaskData } from "../types";
import { format } from "date-fns";

const initialFormState: QuestFormState = {
  newTaskText: "",
  taskDifficulty: "medium",
  showAdvanced: false,
  scheduledTime: null,
  estimatedDuration: null,
  recurrencePattern: null,
  recurrenceDays: [],
  recurrenceEndDate: null,
  reminderEnabled: false,
  reminderMinutesBefore: 15,
  moreInformation: null,
};

export function useQuestForm(selectedDate: Date) {
  const [formState, setFormState] = useState<QuestFormState>(initialFormState);

  const setNewTaskText = useCallback((text: string) => {
    setFormState(prev => ({ ...prev, newTaskText: text }));
  }, []);

  const setTaskDifficulty = useCallback((difficulty: QuestDifficulty) => {
    setFormState(prev => ({ ...prev, taskDifficulty: difficulty }));
  }, []);

  const setShowAdvanced = useCallback((show: boolean) => {
    setFormState(prev => ({ ...prev, showAdvanced: show }));
  }, []);

  const setScheduledTime = useCallback((time: string | null) => {
    setFormState(prev => ({ ...prev, scheduledTime: time }));
  }, []);

  const setEstimatedDuration = useCallback((duration: number | null) => {
    setFormState(prev => ({ ...prev, estimatedDuration: duration }));
  }, []);

  const setRecurrencePattern = useCallback((pattern: string | null) => {
    setFormState(prev => ({ ...prev, recurrencePattern: pattern }));
  }, []);

  const setRecurrenceDays = useCallback((days: number[]) => {
    setFormState(prev => ({ ...prev, recurrenceDays: days }));
  }, []);

  const setRecurrenceEndDate = useCallback((date: string | null) => {
    setFormState(prev => ({ ...prev, recurrenceEndDate: date }));
  }, []);

  const setReminderEnabled = useCallback((enabled: boolean) => {
    setFormState(prev => ({ ...prev, reminderEnabled: enabled }));
  }, []);

  const setReminderMinutesBefore = useCallback((minutes: number) => {
    setFormState(prev => ({ ...prev, reminderMinutesBefore: minutes }));
  }, []);

  const setMoreInformation = useCallback((info: string | null) => {
    setFormState(prev => ({ ...prev, moreInformation: info }));
  }, []);

  const createPendingTaskData = useCallback((): PendingTaskData => {
    return {
      text: formState.newTaskText,
      difficulty: formState.taskDifficulty,
      date: format(selectedDate, 'yyyy-MM-dd'),
      scheduledTime: formState.scheduledTime,
      estimatedDuration: formState.estimatedDuration,
      recurrencePattern: formState.recurrencePattern,
      recurrenceDays: formState.recurrenceDays,
      recurrenceEndDate: formState.recurrenceEndDate,
      reminderEnabled: formState.reminderEnabled,
      reminderMinutesBefore: formState.reminderMinutesBefore,
      moreInformation: formState.moreInformation,
    };
  }, [formState, selectedDate]);

  const resetForm = useCallback(() => {
    setFormState(initialFormState);
  }, []);

  return {
    ...formState,
    setNewTaskText,
    setTaskDifficulty,
    setShowAdvanced,
    setScheduledTime,
    setEstimatedDuration,
    setRecurrencePattern,
    setRecurrenceDays,
    setRecurrenceEndDate,
    setReminderEnabled,
    setReminderMinutesBefore,
    setMoreInformation,
    createPendingTaskData,
    resetForm,
  };
}
