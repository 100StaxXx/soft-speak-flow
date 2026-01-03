import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface DraggedTask {
  id: string;
  task_text: string;
  xp_reward: number;
  task_date: string;
}

interface TaskDragContextValue {
  isDragging: boolean;
  draggedTask: DraggedTask | null;
  hoveredDate: Date | null;
  startDrag: (task: DraggedTask) => void;
  endDrag: () => void;
  setHoveredDate: (date: Date | null) => void;
}

const TaskDragContext = createContext<TaskDragContextValue | null>(null);

export function TaskDragProvider({ children }: { children: ReactNode }) {
  const [draggedTask, setDraggedTask] = useState<DraggedTask | null>(null);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

  const startDrag = useCallback((task: DraggedTask) => {
    setDraggedTask(task);
  }, []);

  const endDrag = useCallback(() => {
    setDraggedTask(null);
    setHoveredDate(null);
  }, []);

  return (
    <TaskDragContext.Provider
      value={{
        isDragging: draggedTask !== null,
        draggedTask,
        hoveredDate,
        startDrag,
        endDrag,
        setHoveredDate,
      }}
    >
      {children}
    </TaskDragContext.Provider>
  );
}

export function useTaskDrag() {
  const context = useContext(TaskDragContext);
  if (!context) {
    throw new Error("useTaskDrag must be used within a TaskDragProvider");
  }
  return context;
}

// Optional hook that doesn't throw if used outside provider
export function useTaskDragOptional() {
  return useContext(TaskDragContext);
}
