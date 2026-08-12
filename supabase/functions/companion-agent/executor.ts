import {
  loadPendingActionForResolution,
  loadThread,
  persistActionReceipt,
  updatePendingAction,
} from "./persistence.ts";
import {
  isCompanionCampaignLifecycleStatus,
  type PendingActionRow,
} from "./types.ts";

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
    proposalId: null,
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

function readCampaignLifecycleStatus(value: unknown) {
  if (value === undefined || value === null) return undefined;
  if (isCompanionCampaignLifecycleStatus(value)) return value;
  throw new Error("Unsupported campaign status");
}

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];

const asQuestCategory = (value: unknown): "mind" | "body" | "soul" | null =>
  value === "mind" || value === "body" || value === "soul" ? value : null;

async function syncTasksToRequestedCalendars(params: {
  supabase: any;
  actorSupabase?: any;
  userId: string;
  taskIds: string[];
  payload: Record<string, unknown>;
}) {
  if (params.payload.send_to_calendar !== true || params.taskIds.length === 0) {
    return { requested: false, synced: [], failed: [] };
  }
  if (!params.actorSupabase) {
    return {
      requested: true,
      synced: [],
      failed: [{
        provider: "calendar",
        reason: "Caller calendar access unavailable",
      }],
    };
  }

  const requestedProvider = typeof params.payload.calendar_provider === "string"
    ? params.payload.calendar_provider
    : null;
  let connectionQuery = params.supabase
    .from("user_calendar_connections")
    .select("id, provider")
    .eq("user_id", params.userId)
    .eq("sync_enabled", true)
    .in("provider", ["google", "outlook"]);
  if (requestedProvider && requestedProvider !== "all") {
    connectionQuery = connectionQuery.eq("provider", requestedProvider);
  }
  const { data: connectionRows, error: connectionError } =
    await connectionQuery;
  if (connectionError) {
    return {
      requested: true,
      synced: [],
      failed: [{
        provider: requestedProvider ?? "calendar",
        reason: connectionError.message ??
          "Could not load calendar connections",
      }],
    };
  }

  const connections = (connectionRows ?? []) as Array<{
    id: string;
    provider: "google" | "outlook";
  }>;
  const selectedConnections = requestedProvider === "all"
    ? connections
    : connections.slice(0, 1);
  if (selectedConnections.length === 0) {
    return {
      requested: true,
      synced: [],
      failed: [{
        provider: requestedProvider ?? "calendar",
        reason: "No matching connected calendar",
      }],
    };
  }

  const { data: linkRows, error: linkError } = await params.supabase
    .from("quest_calendar_links")
    .select("task_id, connection_id")
    .eq("user_id", params.userId)
    .in("task_id", params.taskIds)
    .in(
      "connection_id",
      selectedConnections.map((connection) => connection.id),
    );
  if (linkError) {
    return {
      requested: true,
      synced: [],
      failed: [{
        provider: requestedProvider ?? "calendar",
        reason: linkError.message ?? "Could not load calendar links",
      }],
    };
  }
  const existingLinks = new Set(
    (linkRows ?? []).map((link: Record<string, unknown>) =>
      `${String(link.task_id)}:${String(link.connection_id)}`
    ),
  );

  const synced: Array<Record<string, unknown>> = [];
  const failed: Array<Record<string, unknown>> = [];
  for (const connection of selectedConnections) {
    for (const taskId of params.taskIds) {
      const action = existingLinks.has(`${taskId}:${connection.id}`)
        ? "updateLinkedEvent"
        : "createLinkedEvent";
      try {
        const { data, error } = await params.actorSupabase.functions.invoke(
          `${connection.provider}-calendar-events`,
          { body: { action, taskId } },
        );
        if (!error && !data?.error) {
          synced.push({ provider: connection.provider, task_id: taskId });
          continue;
        }
        failed.push({
          provider: connection.provider,
          task_id: taskId,
          reason: error?.message ?? data?.error ?? "Calendar sync failed",
        });
      } catch (error) {
        failed.push({
          provider: connection.provider,
          task_id: taskId,
          reason: error instanceof Error
            ? error.message
            : "Calendar sync failed",
        });
      }
    }
  }

  return { requested: true, synced, failed };
}

async function executeAction(params: {
  supabase: any;
  actorSupabase?: any;
  userId: string;
  action: PendingActionRow;
}) {
  const payload = params.action.normalized_payload;

  switch (params.action.action_type) {
    case "task_create": {
      const difficulty =
        payload.difficulty === "easy" || payload.difficulty === "hard"
          ? payload.difficulty
          : "medium";
      const { data, error } = await params.supabase
        .from("daily_tasks")
        .insert({
          user_id: params.userId,
          task_text: String(payload.title ?? "New task"),
          task_date: typeof payload.task_date === "string"
            ? payload.task_date
            : null,
          scheduled_time: typeof payload.scheduled_time === "string"
            ? payload.scheduled_time
            : null,
          estimated_duration: typeof payload.estimated_duration === "number"
            ? payload.estimated_duration
            : 30,
          difficulty,
          xp_reward: difficulty === "easy"
            ? 12
            : difficulty === "hard"
            ? 22
            : 16,
          energy_type: typeof payload.energy_type === "string"
            ? payload.energy_type
            : null,
          notes: typeof payload.notes === "string" ? payload.notes : null,
          category: asQuestCategory(payload.category),
          reminder_enabled: payload.reminder_enabled === true,
          reminder_minutes_before:
            typeof payload.reminder_minutes_before === "number"
              ? payload.reminder_minutes_before
              : null,
          source: "plan_my_day",
          ai_generated: true,
        })
        .select("id, task_text, task_date, scheduled_time")
        .single();
      if (error) throw error;

      const calendarSync = await syncTasksToRequestedCalendars({
        ...params,
        taskIds: [data.id],
        payload,
      });
      const syncNote = calendarSync.failed.length > 0
        ? " I added it in Cosmiq, but couldn’t send it to the connected calendar."
        : calendarSync.synced.length > 0
        ? " It’s also on your connected calendar."
        : "";
      return {
        receiptMessage: data.task_date
          ? `Done. "${data.task_text}" is scheduled.${syncNote}`
          : `Done. "${data.task_text}" is in your inbox.${syncNote}`,
        executionResult: {
          task_id: data.id,
          task: data,
          calendar_sync: calendarSync,
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
        receiptMessage: `Got it. "${data.task_text}" is updated.`,
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
          preferred_time: typeof payload.preferred_time === "string"
            ? payload.preferred_time
            : null,
          estimated_minutes: typeof payload.estimated_minutes === "number"
            ? payload.estimated_minutes
            : null,
          description: typeof payload.description === "string"
            ? payload.description
            : null,
          category: asQuestCategory(payload.category),
          reminder_enabled: payload.reminder_enabled === true,
          reminder_minutes_before:
            typeof payload.reminder_minutes_before === "number"
              ? payload.reminder_minutes_before
              : null,
          is_active: true,
        })
        .select("id, title")
        .single();

      if (error) throw error;

      return {
        receiptMessage: `Got it. Ritual "${data.title}" is set.`,
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
        reminder_minutes_before:
          typeof payload.reminder_minutes_before === "number"
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
        receiptMessage: "Got it. Reminder set.",
        executionResult: {
          target_type: targetType,
          target_id: targetId,
        },
      };
    }
    case "campaign_update": {
      const campaignId = String(payload.campaign_id ?? "");
      const status = readCampaignLifecycleStatus(payload.status);
      const patch = Object.fromEntries(
        Object.entries({
          title: payload.title,
          description: payload.description,
          end_date: payload.end_date,
          status,
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
        receiptMessage: `Got it. Campaign "${data.title}" is updated.`,
        executionResult: {
          campaign_id: data.id,
          campaign: data,
        },
      };
    }
    case "campaign_create": {
      const { data, error } = await params.supabase.rpc(
        "create_cosmiq_agent_campaign",
        { p_user_id: params.userId, p_payload: payload },
      );
      if (error) throw error;
      return {
        receiptMessage: `Done. Campaign "${
          String(payload.title ?? "New campaign")
        }" is active.`,
        executionResult: data as Record<string, unknown>,
      };
    }
    case "campaign_adjust": {
      const campaignId = String(payload.campaign_id ?? "");
      if (!campaignId) {
        throw new Error("Missing campaign id for adjustment");
      }

      const adjustmentType = typeof payload.adjustment_type === "string" &&
          payload.adjustment_type.length > 0
        ? payload.adjustment_type
        : "custom";
      const reason = typeof payload.description === "string" &&
          payload.description.length > 0
        ? payload.description
        : typeof payload.requested_summary === "string" &&
            payload.requested_summary.length > 0
        ? payload.requested_summary
        : undefined;

      const { data: adjustmentResult, error: adjustmentError } = await params
        .supabase.functions.invoke("adjust-epic-plan", {
          body: {
            epicId: campaignId,
            adjustmentType,
            reason,
            customRequest: reason,
          },
        });

      if (adjustmentError) throw adjustmentError;

      const suggestions = Array.isArray(
          (adjustmentResult as { suggestions?: unknown[] } | null)
            ?.suggestions,
        )
        ? (adjustmentResult as { suggestions: unknown[] }).suggestions
        : [];

      if (suggestions.length === 0) {
        throw new Error("No campaign adjustments were generated.");
      }

      const { error: applyError } = await params.supabase.functions.invoke(
        "apply-epic-adjustments",
        {
          body: {
            epicId: campaignId,
            adjustments: suggestions,
            adjustmentType,
            reason,
          },
        },
      );

      if (applyError) throw applyError;

      const { data: campaign, error: campaignError } = await params.supabase
        .from("epics")
        .select("id, title")
        .eq("id", campaignId)
        .eq("user_id", params.userId)
        .single();

      if (campaignError) throw campaignError;

      return {
        receiptMessage:
          `Got it. I adjusted "${campaign.title}" so the next move is more realistic.`,
        executionResult: {
          campaign_id: campaign.id,
          campaign,
          adjustment_count: suggestions.length,
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
    case "day_plan_apply": {
      const { data, error } = await params.supabase.rpc(
        "apply_cosmiq_agent_day_plan",
        {
          p_user_id: params.userId,
          p_plan_date: String(payload.plan_date ?? ""),
          p_blocks: payload.blocks,
        },
      );
      if (error) throw error;
      const result = (data ?? {}) as Record<string, unknown>;
      const taskIds = asStringArray(result.committedTaskIds);
      const calendarSync = await syncTasksToRequestedCalendars({
        ...params,
        taskIds,
        payload,
      });
      const syncNote = calendarSync.failed.length > 0
        ? " The Cosmiq plan is saved, but some calendar events couldn’t be sent."
        : calendarSync.synced.length > 0
        ? " I also sent its blocks to your connected calendar."
        : "";
      return {
        receiptMessage: `Done. Your plan for ${
          String(payload.plan_date)
        } is on the day.${syncNote}`,
        executionResult: { ...result, calendar_sync: calendarSync },
      };
    }
    default:
      throw new Error(`Unsupported action type: ${params.action.action_type}`);
  }
}

export async function confirmPendingAction(params: {
  supabase: any;
  actorSupabase?: any;
  userId: string;
  sessionId: string;
  actionId?: string;
}) {
  const action = await resolveActivePendingAction(params);
  if (!action) {
    throw new Error("No pending action found");
  }

  const thread = await loadThread(
    params.supabase,
    params.userId,
    params.sessionId,
  );
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
      actorSupabase: params.actorSupabase,
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
      receipt,
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
      receipt,
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

  const thread = await loadThread(
    params.supabase,
    params.userId,
    params.sessionId,
  );
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
    receipt,
  });

  return {
    action: cancelled,
    receipt,
    thread,
    pendingAction: null,
  };
}
