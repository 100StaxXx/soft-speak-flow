import { useState, useCallback, useMemo, memo } from "react";
import { format } from "date-fns";
import { motion, useReducedMotion } from "framer-motion";
import { Inbox as InboxIcon, Check, Trash2, Pencil } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { PageTransition } from "@/components/PageTransition";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useInboxTasks } from "@/hooks/useInboxTasks";
import { DraggableFAB } from "@/components/DraggableFAB";
import { AddQuestSheet, type AddQuestData } from "@/components/AddQuestSheet";
import { EditQuestDialog } from "@/features/quests/components/EditQuestDialog";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { useTaskMutations } from "@/hooks/useTaskMutations";
import { useQueryClient } from "@tanstack/react-query";
import { haptics } from "@/utils/haptics";
import { getCalendarSendSuccessCopy, useQuestCalendarSync } from "@/hooks/useQuestCalendarSync";
import { useCalendarIntegrations } from "@/hooks/useCalendarIntegrations";
import { useMainTabVisibility } from "@/contexts/MainTabVisibilityContext";
import { COMPANION_FLOATING_ACTION_BUTTON_ENABLED } from "@/config/companionLauncherFeatureFlags";
import { SEND_TO_CALENDAR_ENABLED } from "@/utils/calendarFeatureFlags";
import { isMacDesignedForIPadIOSApp } from "@/utils/platformTargets";
import { trackResilienceEvent } from "@/utils/resilienceTelemetry";
import {
  buildCalendarSendTargetOptions,
  isCalendarSendTargetAvailable,
  type CalendarSendTarget,
} from "@/utils/calendarDestinationOptions";

const TIME_24H_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_INPUT_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const InboxPage = memo(function InboxPage() {
  const prefersReducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const isMacHostedIOSApp = useMemo(() => isMacDesignedForIPadIOSApp(), []);
  const { user } = useAuth();
  const { isTabActive } = useMainTabVisibility();
  const queryClient = useQueryClient();
  const { inboxTasks, inboxCount, isLoading, toggleInboxTask, deleteInboxTask } = useInboxTasks({
    enabled: isTabActive,
  });

  const [showAddQuest, setShowAddQuest] = useState(false);
  const [editingTask, setEditingTask] = useState<typeof inboxTasks[number] | null>(null);

  const { addTask, updateTask, isUpdating } = useTaskMutations(format(new Date(), "yyyy-MM-dd"));
  const { sendTaskToCalendar, hasLinkedEvent } = useQuestCalendarSync({
    enabled: isTabActive,
  });
  const {
    connections: calendarConnections,
    defaultProvider: calendarDefaultProvider,
  } = useCalendarIntegrations({ enabled: isTabActive });

  const handleOpenCalendarPreferences = useCallback(() => {
    navigate("/profile", { state: { openTab: "preferences" } });
  }, [navigate]);

  const handleSendTaskToCalendar = useCallback(async (
    taskId: string,
    requestedTarget?: CalendarSendTarget | null,
  ) => {
    const routeToCalendarPreferences = () => {
      toast.error("No calendar connected. Opening Preferences...");
      handleOpenCalendarPreferences();
    };

    if (calendarConnections.length === 0) {
      routeToCalendarPreferences();
      return;
    }

    const resolveSendTarget = (): CalendarSendTarget | null => {
      if (requestedTarget && isCalendarSendTargetAvailable(requestedTarget, calendarConnections)) {
        return requestedTarget;
      }

      if (calendarConnections.length <= 1) {
        return calendarConnections[0]?.provider ?? null;
      }

      const options = buildCalendarSendTargetOptions(calendarConnections, {
        defaultProvider: calendarDefaultProvider,
        includeAll: true,
        scheduledOnly: false,
      });
      const promptMessage = [
        "Send this quest where?",
        ...options.map((option, index) => `${index + 1}. ${option.label} - ${option.description}`),
      ].join("\n");
      const picked = window.prompt(promptMessage, "1");
      const pickedIndex = picked ? Number.parseInt(picked, 10) - 1 : -1;
      const option = Number.isInteger(pickedIndex) ? options[pickedIndex] : undefined;

      return option?.target ?? null;
    };

    const selectedTarget = resolveSendTarget();
    if (!selectedTarget) {
      toast.error("Calendar send cancelled. Please choose a destination.");
      return;
    }

    const providerTargets = selectedTarget === "all"
      ? calendarConnections.map((connection) => connection.provider)
      : [selectedTarget];

    let taskDateOverride: string | undefined;
    let scheduledTimeOverride: string | undefined;

    const attempt = async () => {
      const results = [];
      for (const provider of providerTargets) {
        results.push(await sendTaskToCalendar.mutateAsync({
          taskId,
          options: {
            provider,
            ...(taskDateOverride ? { taskDate: taskDateOverride } : {}),
            ...(scheduledTimeOverride ? { scheduledTime: scheduledTimeOverride } : {}),
          },
        }));
      }
      return results;
    };

    const showSuccess = (results: Awaited<ReturnType<typeof attempt>>) => {
      if (results.length === 1) {
        const copy = getCalendarSendSuccessCopy(results[0], calendarConnections.length);
        toast.success(copy.title, { description: copy.description });
        return;
      }

      const destinations = results
        .map((result) => `${result.providerLabel} ${result.destinationKind === "todo" ? "To Do" : "Calendar"} -> ${result.destinationName}`)
        .join("; ");
      toast.success(`Quest sent to ${results.length} destinations`, {
        description: `Destinations: ${destinations}.`,
      });
    };

    try {
      const results = await attempt();
      showSuccess(results);
      return;
    } catch (error) {
      let message = error instanceof Error ? error.message : "Failed to send quest to calendar";
      if (message.includes("MULTI_DAY_MONTHLY_UNSUPPORTED")) {
        toast.error("Calendar send doesn't support multi-day monthly recurrence yet.");
        return;
      }
      if (message.includes("NO_CALENDAR_CONNECTION")) {
        routeToCalendarPreferences();
        return;
      }
      if (message.includes("CALENDAR_DEFAULT_REQUIRED")) {
        toast.error("Choose a default calendar provider before sending. Opening Preferences...");
        handleOpenCalendarPreferences();
        return;
      }

      for (let attemptIndex = 0; attemptIndex < 2; attemptIndex += 1) {
        if (message.includes("NO_CALENDAR_CONNECTION")) {
          routeToCalendarPreferences();
          return;
        }
        if (message.includes("CALENDAR_DEFAULT_REQUIRED")) {
          toast.error("Choose a default calendar provider before sending. Opening Preferences...");
          handleOpenCalendarPreferences();
          return;
        }

        if (message.includes("TASK_DATE_REQUIRED") && !taskDateOverride) {
          const pickedDate = window.prompt(
            "Choose a date to send this quest (YYYY-MM-DD)",
            format(new Date(), "yyyy-MM-dd"),
          );
          if (!pickedDate || !DATE_INPUT_REGEX.test(pickedDate)) {
            toast.error("Calendar send cancelled. Please choose a valid YYYY-MM-DD date.");
            return;
          }
          taskDateOverride = pickedDate;
        }

        if ((message.includes("SCHEDULED_TIME_REQUIRED") || message.includes("SCHEDULED_TIME_INVALID")) && !scheduledTimeOverride) {
          const pickedTime = window.prompt("Choose a time to send this quest (HH:mm)", "09:00");
          if (!pickedTime || !TIME_24H_REGEX.test(pickedTime)) {
            toast.error("Calendar send cancelled. Please choose a valid HH:mm time.");
            return;
          }
          scheduledTimeOverride = pickedTime;
        }

        try {
          const results = await attempt();
          showSuccess(results);
          return;
        } catch (retryError) {
          message = retryError instanceof Error ? retryError.message : "Failed to send quest to calendar";
          if (message.includes("MULTI_DAY_MONTHLY_UNSUPPORTED")) {
            toast.error("Calendar send doesn't support multi-day monthly recurrence yet.");
            return;
          }
          if (message.includes("NO_CALENDAR_CONNECTION")) {
            routeToCalendarPreferences();
            return;
          }
          if (message.includes("CALENDAR_DEFAULT_REQUIRED")) {
            toast.error("Choose a default calendar provider before sending. Opening Preferences...");
            handleOpenCalendarPreferences();
            return;
          }
          if (
            !message.includes("TASK_DATE_REQUIRED")
            && !message.includes("SCHEDULED_TIME_REQUIRED")
            && !message.includes("SCHEDULED_TIME_INVALID")
          ) {
            toast.error(message);
            return;
          }
        }
      }

      if (message.includes("TASK_DATE_REQUIRED")) {
        toast.error("Please assign a date before sending this quest to calendar.");
        return;
      }

      if (message.includes("SCHEDULED_TIME_REQUIRED") || message.includes("SCHEDULED_TIME_INVALID")) {
        toast.error("Please assign a time before sending this quest to calendar.");
        return;
      }

      toast.error(message);
    }
  }, [calendarConnections, calendarDefaultProvider, handleOpenCalendarPreferences, sendTaskToCalendar]);

  const handleSaveEdit = useCallback(async (taskId: string, updates: any) => {
    await updateTask({ taskId, updates });
    queryClient.invalidateQueries({ queryKey: ["inbox-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["inbox-count"] });
    setEditingTask(null);
  }, [updateTask, queryClient]);

  const handleDeleteQuest = useCallback(async (taskId: string) => {
    deleteInboxTask(taskId);
  }, [deleteInboxTask]);

  const handleAddQuest = useCallback(async (data: AddQuestData) => {
    if (!user?.id) return;
    const taskDate = data.sendToInbox
      ? null
      : (data.taskDate ?? format(new Date(), 'yyyy-MM-dd'));

    const createdTask = await addTask({
      taskText: data.text,
      difficulty: data.difficulty,
      source: data.creationSource,
      taskDate: taskDate,
      isMainQuest: false,
      scheduledTime: data.scheduledTime,
      estimatedDuration: data.estimatedDuration,
      recurrencePattern: data.recurrencePattern,
      recurrenceDays: data.recurrenceDays,
      recurrenceMonthDays: data.recurrenceMonthDays,
      recurrenceCustomPeriod: data.recurrenceCustomPeriod,
      reminderEnabled: data.reminderEnabled,
      reminderMinutesBefore: data.reminderMinutesBefore,
      reminderOffsetsMinutes: data.reminderOffsetsMinutes,
      notes: data.moreInformation,
      location: data.location,
      contactId: data.contactId,
      autoLogInteraction: data.autoLogInteraction,
      subtasks: data.subtasks,
      imageUrl: data.imageUrl,
      attachments: data.attachments,
    });

    setShowAddQuest(false);

    if (SEND_TO_CALENDAR_ENABLED && data.sendToCalendar && createdTask?.id) {
      const calendarSendStartedAt = Date.now();
      void handleSendTaskToCalendar(createdTask.id, data.sendToCalendarTarget).finally(() => {
        trackResilienceEvent("task_create_calendar_send", {
          taskId: createdTask.id,
          calendarSendMs: Date.now() - calendarSendStartedAt,
        });
      });
    }
    if (!data.sendToInbox) {
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
    }
    queryClient.invalidateQueries({ queryKey: ["inbox-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["inbox-count"] });
  }, [user?.id, addTask, handleSendTaskToCalendar, queryClient]);

  return (
    <PageTransition mode="instant">
      <div className="min-h-screen bg-transparent pb-24 pt-safe">
        <StarfieldBackground />

        {/* Hero Title */}
        <div className="max-w-lg mx-auto px-4 pt-6" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top, 0px))' }}>
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.24 }}
            className="text-center mb-6"
          >
            <h1 className="text-3xl font-semibold tracking-tight bg-gradient-to-r from-celestial-blue to-blue-400 bg-clip-text text-transparent">
              Inbox
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Capture now. Conquer later.</p>
            {inboxCount > 0 && (
              <Badge variant="celestial" className="text-xs mt-2">
                {inboxCount} quests
              </Badge>
            )}
          </motion.div>
        </div>

        {/* Content */}
        <div className="max-w-lg mx-auto px-4 pt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 bg-muted/30 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : inboxCount === 0 ? (
            <EmptyState
              icon={InboxIcon}
              title="Inbox is empty"
              description="Capture quests with the + button — schedule them later when you're ready."
              actionLabel="Add a quest"
              onAction={() => setShowAddQuest(true)}
            />
          ) : (
            <div className="space-y-2">
              {inboxTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 py-3 px-3 rounded-2xl bg-card/82 backdrop-blur-lg border border-border/55 shadow-[0_8px_18px_rgba(0,0,0,0.16)]"
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => {
                      toggleInboxTask({ taskId: task.id, completed: !task.completed });
                      haptics.light();
                    }}
                    className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-muted-foreground/40 hover:border-primary flex items-center justify-center transition-colors"
                  >
                    {task.completed && <Check className="w-4 h-4 text-primary" />}
                  </button>

                  {/* Task text */}
                  <span className={cn(
                    "text-sm flex-1 min-w-0",
                    task.completed && "line-through text-muted-foreground"
                  )}>
                    {task.task_text}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => {
                        setEditingTask(task);
                        haptics.light();
                      }}
                      className="p-2 rounded-xl hover:bg-muted/55 text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
                      aria-label="Edit quest"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        void handleDeleteQuest(task.id);
                        haptics.light();
                      }}
                      className="p-2 rounded-xl hover:bg-destructive/12 text-muted-foreground hover:text-destructive transition-colors touch-manipulation"
                      aria-label="Delete quest"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {COMPANION_FLOATING_ACTION_BUTTON_ENABLED ? (
          <DraggableFAB onTap={() => setShowAddQuest(true)} />
        ) : null}

        <AddQuestSheet
          open={showAddQuest}
          onOpenChange={setShowAddQuest}
          selectedDate={new Date()}
          onAdd={handleAddQuest}
          presentation={isMacHostedIOSApp ? "desktop-panel" : "mobile-sheet"}
          onOpenCalendarPreferences={handleOpenCalendarPreferences}
        />

        <EditQuestDialog
          task={editingTask}
          open={!!editingTask}
          onOpenChange={(open) => !open && setEditingTask(null)}
          onSave={handleSaveEdit}
          isSaving={isUpdating}
          onSendToCalendar={SEND_TO_CALENDAR_ENABLED ? handleSendTaskToCalendar : undefined}
          hasCalendarLink={editingTask ? hasLinkedEvent(editingTask.id) : false}
          isSendingToCalendar={sendTaskToCalendar.isPending}
          onDelete={async (taskId) => {
            await handleDeleteQuest(taskId);
            setEditingTask(null);
          }}
          isDeleting={false}
          presentation={isMacHostedIOSApp ? "desktop-panel" : "mobile-sheet"}
        />

      </div>
    </PageTransition>
  );
});

export default InboxPage;
