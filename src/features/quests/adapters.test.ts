import { describe, expect, it } from "vitest";

import type { DailyTask } from "@/services/dailyTasksRemote";

import { toQuest } from "./adapters";

const buildTask = (): DailyTask => ({
  id: "task-1",
  user_id: "user-1",
  task_text: "Ship wrapper hooks",
  difficulty: "hard",
  xp_reward: 30,
  task_date: "2026-04-22",
  completed: false,
  completed_at: null,
  is_main_quest: true,
  scheduled_time: "09:30",
  estimated_duration: 45,
  recurrence_pattern: null,
  recurrence_days: null,
  recurrence_month_days: null,
  recurrence_custom_period: null,
  recurrence_end_date: null,
  is_recurring: false,
  reminder_enabled: true,
  reminder_minutes_before: 10,
  reminder_sent: false,
  parent_template_id: null,
  category: "mind",
  is_bonus: false,
  created_at: "2026-04-22T07:00:00.000Z",
  priority: "high",
  is_top_three: true,
  actual_time_spent: null,
  ai_generated: true,
  context_id: null,
  source: "manual",
  habit_source_id: "habit-1",
  epic_id: "epic-1",
  epic_title: "Normalization",
  sort_order: 2,
  contact_id: null,
  auto_log_interaction: false,
  contact: null,
  image_url: null,
  notes: "Keep it behavior-preserving.",
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
    { id: "subtask-2", title: "Write tests", completed: false, sort_order: 2 },
    { id: "subtask-1", title: "Add adapters", completed: true, sort_order: 1 },
  ],
});

describe("quest adapters", () => {
  it("maps a DailyTask into the canonical quest shape", () => {
    expect(toQuest(buildTask())).toMatchObject({
      id: "task-1",
      userId: "user-1",
      title: "Ship wrapper hooks",
      taskDate: "2026-04-22",
      scheduledTime: "09:30",
      estimatedDuration: 45,
      completed: false,
      priority: "high",
      difficulty: "hard",
      campaignId: "epic-1",
      campaignTitle: "Normalization",
      habitSourceId: "habit-1",
      isMainQuest: true,
      reminderEnabled: true,
      reminderMinutesBefore: 10,
      aiGenerated: true,
      notes: "Keep it behavior-preserving.",
      location: "Desk",
      source: "manual",
      category: "mind",
      subtasks: [
        {
          id: "subtask-1",
          questId: "task-1",
          title: "Add adapters",
          completed: true,
          sortOrder: 1,
        },
        {
          id: "subtask-2",
          questId: "task-1",
          title: "Write tests",
          completed: false,
          sortOrder: 2,
        },
      ],
      attachments: [
        expect.objectContaining({
          id: "attachment-1",
          fileName: "diagram.png",
        }),
      ],
    });
  });

  it("does not coerce template-local string subtasks into canonical Subtask rows", () => {
    const task = buildTask();
    task.subtasks = ["Draft outline", "Fill details"] as unknown as DailyTask["subtasks"];

    expect(toQuest(task).subtasks).toEqual([]);
  });
});
