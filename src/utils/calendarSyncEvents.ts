export const CALENDAR_TASK_UPDATED_EVENT = "calendar-task-updated";
export const CALENDAR_TASK_DELETE_REQUEST_EVENT = "calendar-task-delete-request";

export interface CalendarTaskUpdatedDetail {
  taskId: string;
}

export interface CalendarTaskDeleteRequestDetail {
  taskId: string;
  register: (operation: Promise<unknown>) => void;
}

export function dispatchCalendarTaskUpdated(taskId: string | null | undefined): void {
  if (!taskId) return;
  window.dispatchEvent(new CustomEvent<CalendarTaskUpdatedDetail>(CALENDAR_TASK_UPDATED_EVENT, {
    detail: { taskId },
  }));
}

export async function requestCalendarTaskDeleteSync(taskId: string): Promise<void> {
  const operations: Promise<unknown>[] = [];
  window.dispatchEvent(new CustomEvent<CalendarTaskDeleteRequestDetail>(CALENDAR_TASK_DELETE_REQUEST_EVENT, {
    detail: {
      taskId,
      register: (operation) => operations.push(operation),
    },
  }));

  if (operations.length === 0) return;
  await Promise.allSettled(operations);
}
