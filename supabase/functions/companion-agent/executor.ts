import {
  loadPendingActionForResolution,
  loadThread,
  persistActionReceipt,
  updatePendingAction,
} from "./persistence.ts";
import type { PendingActionRow } from "./types.ts";

function buildReceipt(params: {
  action: PendingActionRow;
  status: "cancelled" | "failed" | "executed";
  message: string;
  executionResult?: Record<string, unknown> | null;
  executionError?: Record<string, unknown> | null;
}) {
  return {
    actionId: params.action.id,
    status: params.status,
    message: params.message,
    summary: params.action.summary,
    createdAt: new Date().toISOString(),
    executionResult: params.executionResult ?? null,
    executionError: params.executionError ?? null,
  };
}

async function resolveActivePendingAction(params: {
  supabase: any;
  userId: string;
  sessionId: string;
  actionId?: string;
}) {
  const active = await loadPendingActionForResolution({
    supabase: params.supabase,
    userId: params.userId,
    sessionId: params.sessionId,
  });

  if (!active) {
    if (!params.actionId) return null;
    return await loadPendingActionForResolution({
      supabase: params.supabase,
      userId: params.userId,
      sessionId: params.sessionId,
      actionId: params.actionId,
    });
  }

  if (params.actionId && active.id !== params.actionId) {
    throw new Error("Pending action mismatch");
  }

  return active;
}

function taskScheduleLabel(task: Record<string, unknown>) {
  const taskDate = typeof task.task_date === "string" ? task.task_date : null;
  const scheduledTime = typeof task.scheduled_time === "string" ? task.scheduled_time : null;
  if (taskDate && scheduledTime) return `${taskDate} at ${scheduledTime}`;
  return taskDate ?? "your schedule";
}

async function executeAction(params: {
  supabase: any;
  userId: string;
  action: PendingActionRow;
}) {
  const payload = params.action.normalized_payload;

  switch (params.action.action_type) {
    case "task_create": {
      const insertPayload = {
        user_id: params.userId,
        task_text: String(payload.title ?? "New task"),
        task_date: typeof payload.task_date === "string" ? payload.task_date : null,
        scheduled_time: typeof payload.scheduled_time === "string" ? payload.scheduled_time : null,
        estimated_duration: typeof payload.estimated_duration === "number"
          ? payload.estimated_duration
          : null,
        notes: typeof payload.notes === "string" ? payload.notes : null,
        location: typeof payload.location === "string" ? payload.location : null,
        epic_id: typeof payload.epic_id === "string" ? payload.epic_id : null,
        priority: typeof payload.priority === "string" ? payload.priority : null,
        reminder_enabled: payload.reminder_enabled === true,
        reminder_minutes_before: typeof payload.reminder_minutes_before === "number"
          ? payload.reminder_minutes_before
          : null,
        source: "companion_agent",
      };

      const { data, error } = await params.supabase
        .from("daily_tasks")
        .insert(insertPayload)
        .select("id, task_text, task_date, scheduled_time")
        .single();

      if (error) throw error;

      return {
        receiptMessage: `Got it — "${data.task_text}" added for ${taskScheduleLabel(data as Record<string, unknown>)}.`,
        executionResult: {
          task_id: data.id,
          task: data,
        },
      };
    }
    case "task_update": {
      const taskId = String(payload.task_id ?? "");
      const patch = Object.fromEntries(
        Object.entries({
          task_text: payload.title,
          task_date: payload.task_date,
          scheduled_time: payload.scheduled_time,
          estimated_duration: payload.estimated_duration,
          notes: payload.notes,
          location: payload.location,
          priority: payload.priority,
          completed: payload.completed,
          reminder_enabled: payload.reminder_enabled,
          reminder_minutes_before: payload.reminder_minutes_before,
        }).filter(([, value]) => value !== undefined),
      );

      const { data, error } = await params.supabase
        .from("daily_tasks")
        .update(patch)
        .eq("id", taskId)
        .eq("user_id", params.userId)
        .select("id, task_text, task_date, scheduled_time")
        .single();

      if (error) throw error;

      return {
        receiptMessage: `Got it — "${data.task_text}" is updated.`,
        executionResult: {
          task_id: data.id,
          task: data,
        },
      };
    }
    case "ritual_create": {
      const { data, error } = await params.supabase
        .from("habits")
        .insert({
          user_id: params.userId,
          title: String(payload.title ?? "New ritual"),
          frequency: String(payload.frequency ?? "daily"),
          preferred_time: typeof payload.preferred_time === "string" ? payload.preferred_time : null,
          estimated_minutes: typeof payload.estimated_minutes === "number"
            ? payload.estimated_minutes
            : null,
          description: typeof payload.description === "string" ? payload.description : null,
          category: typeof payload.category === "string" ? payload.category : null,
          reminder_enabled: payload.reminder_enabled === true,
          reminder_minutes_before: typeof payload.reminder_minutes_before === "number"
            ? payload.reminder_minutes_before
            : null,
          is_active: true,
        })
        .select("id, title")
        .single();

      if (error) throw error;

      return {
        receiptMessage: `Got it — ritual "${data.title}" is set.`,
        executionResult: {
          ritual_id: data.id,
          ritual: data,
        },
      };
    }
    case "reminder_create": {
      const targetType = String(payload.target_type ?? "");
      const targetId = String(payload.target_id ?? "");
      const patch = {
        reminder_enabled: payload.reminder_enabled !== false,
        reminder_minutes_before: typeof payload.reminder_minutes_before === "number"
          ? payload.reminder_minutes_before
          : null,
      };

      if (targetType === "task") {
        const { error } = await params.supabase
          .from("daily_tasks")
          .update(patch)
          .eq("id", targetId)
          .eq("user_id", params.userId);
        if (error) throw error;
      } else if (targetType === "ritual") {
        const { error } = await params.supabase
          .from("habits")
          .update(patch)
          .eq("id", targetId)
          .eq("user_id", params.userId);
        if (error) throw error;
      } else {
        throw new Error("Unsupported reminder target");
      }

      return {
        receiptMessage: "Got it — reminder set.",
        executionResult: {
          target_type: targetType,
          target_id: targetId,
        },
      };
    }
    case "campaign_update": {
      const campaignId = String(payload.campaign_id ?? "");
      const patch = Object.fromEntries(
        Object.entries({
          title: payload.title,
          description: payload.description,
          end_date: payload.end_date,
          status: payload.status,
          target_days: payload.target_days,
          updated_at: new Date().toISOString(),
        }).filter(([, value]) => value !== undefined),
      );

      const { data, error } = await params.supabase
        .from("epics")
        .update(patch)
        .eq("id", campaignId)
        .eq("user_id", params.userId)
        .select("id, title")
        .single();

      if (error) throw error;

      return {
        receiptMessage: `Got it — campaign "${data.title}" is updated.`,
        executionResult: {
          campaign_id: data.id,
          campaign: data,
        },
      };
    }
    case "journal_entry": {
      const reflectionDate = typeof payload.reflection_date === "string"
        ? payload.reflection_date
        : new Date().toISOString().slice(0, 10);
      const { data, error } = await params.supabase
        .from("user_reflections")
        .insert({
          user_id: params.userId,
          mood: typeof payload.mood === "string" ? payload.mood : "neutral",
          note: typeof payload.note === "string" ? payload.note : null,
          reflection_date: reflectionDate,
        })
        .select("id, reflection_date")
        .single();

      if (error) throw error;

      return {
        receiptMessage: "Saved that to your journal.",
        executionResult: {
          journal_entry_id: data.id,
          reflection_date: data.reflection_date,
        },
      };
    }
    default:
      throw new Error(`Unsupported action type: ${params.action.action_type}`);
  }
}

export async function confirmPendingAction(params: {
  supabase: any;
  userId: string;
  sessionId: string;
  actionId?: string;
}) {
  const action = await resolveActivePendingAction(params);
  if (!action) {
    throw new Error("No pending action found");
  }

  const thread = await loadThread(params.supabase, params.userId, params.sessionId);
  if (!thread) throw new Error("Thread not found");

  if (action.status === "executed") {
    return {
      action,
      receipt: buildReceipt({
        action,
        status: "executed",
        message: "That action was already confirmed.",
        executionResult: action.execution_result,
      }),
      thread,
      pendingAction: null,
    };
  }

  if (action.status !== "pending") {
    throw new Error(`Action is not pending: ${action.status}`);
  }

  if (new Date(action.expires_at).getTime() <= Date.now()) {
    const expired = await updatePendingAction(params.supabase, action.id, {
      status: "expired",
    });
    return {
      action: expired,
      receipt: buildReceipt({
        action: expired,
        status: "failed",
        message: "That confirmation expired, so I didn’t apply it.",
        executionError: { code: "expired" },
      }),
      thread,
      pendingAction: null,
    };
  }

  await updatePendingAction(params.supabase, action.id, {
    status: "confirmed",
    confirmed_at: new Date().toISOString(),
  });

  try {
    const execution = await executeAction({
      supabase: params.supabase,
      userId: params.userId,
      action,
    });

    const executed = await updatePendingAction(params.supabase, action.id, {
      status: "executed",
      executed_at: new Date().toISOString(),
      execution_result: execution.executionResult,
      execution_error: null,
    });

    const receipt = buildReceipt({
      action: executed,
      status: "executed",
      message: execution.receiptMessage,
      executionResult: execution.executionResult,
    });

    await persistActionReceipt({
      supabase: params.supabase,
      userId: params.userId,
      companionId: thread.companion_id,
      sessionId: params.sessionId,
      surface: thread.surface,
      userMessage: "Confirm",
      assistantReply: receipt.message,
    });

    return {
      action: executed,
      receipt,
      thread,
      pendingAction: null,
    };
  } catch (error) {
    const executionError = {
      message: error instanceof Error ? error.message : String(error),
    };
    const failed = await updatePendingAction(params.supabase, action.id, {
      status: "failed",
      execution_error: executionError,
    });

    const receipt = buildReceipt({
      action: failed,
      status: "failed",
      message: "I couldn’t complete that change. Nothing else was applied.",
      executionError,
    });

    await persistActionReceipt({
      supabase: params.supabase,
      userId: params.userId,
      companionId: thread.companion_id,
      sessionId: params.sessionId,
      surface: thread.surface,
      userMessage: "Confirm",
      assistantReply: receipt.message,
    });

    return {
      action: failed,
      receipt,
      thread,
      pendingAction: null,
    };
  }
}

export async function cancelPendingAction(params: {
  supabase: any;
  userId: string;
  sessionId: string;
  actionId?: string;
}) {
  const action = await resolveActivePendingAction(params);
  if (!action) {
    throw new Error("No pending action found");
  }

  const thread = await loadThread(params.supabase, params.userId, params.sessionId);
  if (!thread) throw new Error("Thread not found");

  if (action.status === "cancelled") {
    return {
      action,
      receipt: buildReceipt({
        action,
        status: "cancelled",
        message: "Okay, I won’t schedule that.",
      }),
      thread,
      pendingAction: null,
    };
  }

  const cancelled = await updatePendingAction(params.supabase, action.id, {
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
  });

  const receipt = buildReceipt({
    action: cancelled,
    status: "cancelled",
    message: "Okay, I won’t schedule that.",
  });

  await persistActionReceipt({
    supabase: params.supabase,
    userId: params.userId,
    companionId: thread.companion_id,
    sessionId: params.sessionId,
    surface: thread.surface,
    userMessage: "Cancel",
    assistantReply: receipt.message,
  });

  return {
    action: cancelled,
    receipt,
    thread,
    pendingAction: null,
  };
}
