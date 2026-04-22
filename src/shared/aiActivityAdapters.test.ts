import { describe, expect, it } from "vitest";

import {
  toAiActivityFromChat,
  toAiActivityFromInteraction,
  toAiActivityFromPendingAction,
  toAiActivityFromValidation,
} from "./aiActivityAdapters";

describe("ai activity adapters", () => {
  it("maps telemetry rows into canonical AI activity records", () => {
    expect(toAiActivityFromInteraction({
      id: "interaction-1",
      ai_response: { reply: "You've got this." },
      context_snapshot: null,
      created_at: "2026-04-22T10:00:00.000Z",
      detected_intent: "plan_day",
      input_text: "Help me plan today",
      interaction_type: "planner",
      modifications: null,
      response_time_ms: 1200,
      session_id: "session-1",
      user_action: "accepted",
      user_id: "user-1",
    })).toMatchObject({
      activityType: "interaction",
      sessionId: "session-1",
      intent: "plan_day",
      status: "accepted",
      summary: "Help me plan today",
      sourceTable: "ai_interactions",
    });
  });

  it("keeps validation log records separate from chat and pending-action storage classes", () => {
    expect(toAiActivityFromValidation({
      id: "validation-1",
      created_at: "2026-04-22T10:01:00.000Z",
      input_data: { prompt: "test" },
      model_used: "gpt-5.4-mini",
      output_data: { okay: true },
      response_time_ms: 800,
      template_key: "daily-plan",
      tokens_used: 200,
      user_id: "user-1",
      validation_errors: null,
      validation_passed: true,
    })).toMatchObject({
      activityType: "validation",
      status: "passed",
      summary: "daily-plan",
      sourceTable: "ai_output_validation_log",
    });
  });

  it("maps chat persistence and pending actions into the same canonical boundary without blurring source tables", () => {
    expect(toAiActivityFromChat({
      companion_id: "companion-1",
      content: "Let's break that goal down.",
      created_at: "2026-04-22T10:02:00.000Z",
      id: "chat-1",
      input_mode: "text",
      role: "assistant",
      session_id: "session-1",
      source: "agent",
      surface: "journeys",
      user_id: "user-1",
    })).toMatchObject({
      activityType: "chat_message",
      surface: "journeys",
      sessionId: "session-1",
      summary: "Let's break that goal down.",
      sourceTable: "companion_chats",
    });

    expect(toAiActivityFromPendingAction({
      action_type: "task_create",
      affected_entities: null,
      cancelled_at: null,
      companion_id: "companion-1",
      confirmation_message: "Want me to lock that in?",
      confirmed_at: null,
      created_at: "2026-04-22T10:03:00.000Z",
      executed_at: null,
      execution_error: null,
      execution_result: null,
      expires_at: "2026-04-22T22:03:00.000Z",
      id: "pending-1",
      idempotency_key: "dedupe-1",
      intent: "schedule_task",
      metadata: null,
      normalized_payload: { taskTitle: "Deep work block" },
      replaced_by_action_id: null,
      session_id: "session-1",
      status: "pending",
      summary: "Create Deep work block at 10:15",
      thread_id: "session-1",
      user_id: "user-1",
    })).toMatchObject({
      activityType: "pending_action",
      intent: "schedule_task",
      status: "pending",
      summary: "Create Deep work block at 10:15",
      sourceTable: "companion_pending_actions",
    });
  });
});
