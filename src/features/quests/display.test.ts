import { describe, expect, it } from "vitest";

import type { DailyTask } from "@/services/dailyTasksRemote";

import { toDisplayQuestFromLegacyTask } from "./display";

const buildTask = (): DailyTask => ({
  id: "task-1",
  user_id: "user-1",
  task_text: "Open desktop quest details",
  difficulty: "medium",
  xp_reward: 20,
  task_date: "2026-04-22",
  completed: true,
  completed_at: "2026-04-22T09:00:00.000Z",
  is_main_quest: false,
  scheduled_time: "09:30",
  estimated_duration: 45,
  recurrence_pattern: "weekly",
  recurrence_days: [2],
  recurrence_month_days: null,
  recurrence_custom_period: null,
  recurrence_end_date: null,
  is_recurring: true,
  reminder_enabled: true,
  reminder_minutes_before: 10,
  reminder_sent: false,
  parent_template_id: null,
  category: "mind",
  is_bonus: false,
  created_at: "2026-04-22T07:00:00.000Z",
  priority: "high",
  is_top_three: null,
  actual_time_spent: null,
  ai_generated: false,
  context_id: null,
  source: "manual",
  habit_source_id: "habit-1",
  epic_id: null,
  epic_title: null,
  sort_order: null,
  contact_id: null,
  auto_log_interaction: false,
  contact: null,
  image_url: "https://example.com/quest.png",
  notes: "Bring the desktop shell onto the canonical contract.",
  location: "Desk",
  attachments: [
    {
      id: "attachment-1",
      taskId: "task-1",
      fileUrl: "https://example.com/diagram.png",
      filePath: "quest-attachments/diagram.png",
      fileName: "diagram.png",
      mimeType: "image/png",
      fileSizeBytes: 123,
      isImage: true,
      sortOrder: 0,
      createdAt: "2026-04-22T07:01:00.000Z",
    },
  ],
  subtasks: [
    { id: "subtask-2", title: "Keep callers stable", completed: false, sort_order: 2 },
    { id: "subtask-1", title: "Normalize prop names", completed: true, sort_order: 1 },
  ],
});

describe("quest display adapter", () => {
  it("maps a legacy task row into the canonical quest display shape", () => {
    expect(toDisplayQuestFromLegacyTask(buildTask())).toEqual({
      id: "task-1",
      title: "Open desktop quest details",
      completed: true,
      xpReward: 20,
      scheduledTime: "09:30",
      estimatedDuration: 45,
      isMainQuest: false,
      habitSourceId: "habit-1",
      notes: "Bring the desktop shell onto the canonical contract.",
      priority: "high",
      difficulty: "medium",
      category: "mind",
      isRecurring: true,
      recurrencePattern: "weekly",
      imageUrl: "https://example.com/quest.png",
      attachments: [
        expect.objectContaining({
          id: "attachment-1",
          fileName: "diagram.png",
        }),
      ],
      subtasks: [
        {
          id: "subtask-1",
          title: "Normalize prop names",
          completed: true,
          sortOrder: 1,
        },
        {
          id: "subtask-2",
          title: "Keep callers stable",
          completed: false,
          sortOrder: 2,
        },
      ],
      location: "Desk",
    });
  });
});
