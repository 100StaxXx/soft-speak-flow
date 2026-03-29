import { useState, type ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      children,
      layout: _layout,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock("./SubtaskList", () => ({
  SubtaskList: () => <div data-testid="subtask-list" />,
}));

vi.mock("./PriorityBadge", () => ({
  PriorityBadge: () => <div data-testid="priority-badge" />,
}));

vi.mock("./BlockedBadge", () => ({
  BlockedBadge: () => <div data-testid="blocked-badge" />,
}));

vi.mock("./ProgressRing", () => ({
  ProgressRing: () => <div data-testid="progress-ring" />,
}));

vi.mock("./DecomposeTaskDialog", () => ({
  DecomposeTaskDialog: () => null,
}));

vi.mock("@/components/QuestImageThumbnail", () => ({
  QuestImageThumbnail: () => <div data-testid="quest-image-thumbnail" />,
}));

vi.mock("../hooks/useSubtasks", () => ({
  useSubtasks: () => ({
    subtasks: [],
    progressPercent: 0,
  }),
}));

vi.mock("../hooks/useTaskDependencies", () => ({
  useTaskDependencies: () => ({
    isBlocked: false,
    incompleteBlockers: [],
  }),
}));

vi.mock("@/hooks/useHapticFeedback", () => ({
  useHapticFeedback: () => ({
    success: vi.fn(),
    light: vi.fn(),
  }),
}));

import { EnhancedTaskCard, type TaskCardTask } from "./EnhancedTaskCard";

const handleToggleComplete = vi.fn();
const handleDelete = vi.fn();

const buildTask = (id: string, taskText: string): TaskCardTask => ({
  id,
  task_text: taskText,
  completed: false,
});

const openDropdownMenu = (trigger: HTMLElement) => {
  act(() => {
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter", code: "Enter" });
  });
};

function ControlledMenuHarness() {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const tasks = [
    buildTask("task-1", "Morning focus"),
    buildTask("task-2", "Deep work"),
  ];

  return (
    <div>
      {tasks.map((task) => (
        <EnhancedTaskCard
          key={task.id}
          task={task}
          onToggleComplete={handleToggleComplete}
          onDelete={handleDelete}
          actionMenuOpen={openTaskId === task.id}
          onActionMenuOpenChange={(open) => {
            setOpenTaskId((current) => {
              if (open) return task.id;
              return current === task.id ? null : current;
            });
          }}
        />
      ))}
    </div>
  );
}

describe("EnhancedTaskCard", () => {
  it("supports parent-controlled exclusive task action menus", async () => {
    render(<ControlledMenuHarness />);

    const [firstActionTrigger, secondActionTrigger] = screen.getAllByLabelText("Task actions");

    openDropdownMenu(firstActionTrigger);

    await waitFor(() => {
      expect(screen.getAllByText("Delete quest")).toHaveLength(1);
    });

    openDropdownMenu(secondActionTrigger);

    await waitFor(() => {
      expect(screen.getAllByText("Delete quest")).toHaveLength(1);
    });
  });
});
