import { useState, useCallback, memo } from "react";
import { format } from "date-fns";
import { motion, useReducedMotion } from "framer-motion";
import { Inbox as InboxIcon, Check, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { PageTransition } from "@/components/PageTransition";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { BottomNav } from "@/components/BottomNav";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useInboxTasks } from "@/hooks/useInboxTasks";
import { DraggableFAB } from "@/components/DraggableFAB";
import { AddQuestSheet, type AddQuestData } from "@/components/AddQuestSheet";
import { EditQuestDialog } from "@/features/quests/components/EditQuestDialog";

import { useAuth } from "@/hooks/useAuth";
import { useTaskMutations } from "@/hooks/useTaskMutations";
import { useQueryClient } from "@tanstack/react-query";
import { haptics } from "@/utils/haptics";
import { useQuestCalendarSync } from "@/hooks/useQuestCalendarSync";

const TIME_24H_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_INPUT_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const InboxPage = memo(function InboxPage() {
  const prefersReducedMotion = useReducedMotion();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { inboxTasks, inboxCount, isLoading, toggleInboxTask, deleteInboxTask } = useInboxTasks();

  const [showAddQuest, setShowAddQuest] = useState(false);
  const [editingTask, setEditingTask] = useState<typeof inboxTasks[number] | null>(null);

  const { addTask, updateTask, isUpdating } = useTaskMutations(format(new Date(), "yyyy-MM-dd"));
  const { sendTaskToCalendar, syncTaskUpdate, syncTaskDelete, hasLinkedEvent } = useQuestCalendarSync();

  const handleSendTaskToCalendar = useCallback(async (taskId: string) => {
    let taskDateOverride: string | undefined;
    let scheduledTimeOverride: string | undefined;

    const attempt = async () => {
      await sendTaskToCalendar.mutateAsync({
        taskId,
        options: taskDateOverride || scheduledTimeOverride
          ? {
              taskDate: taskDateOverride,
              scheduledTime: scheduledTimeOverride,
            }
          : undefined,
      });
    };

    try {
      await attempt();
      toast.success("Quest synced to calendar");
      return;
    } catch (error) {
      let message = error instanceof Error ? error.message : "Failed to send quest to calendar";

      for (let attemptIndex = 0; attemptIndex < 2; attemptIndex += 1) {
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

        if (message.includes("SCHEDULED_TIME_REQUIRED") && !scheduledTimeOverride) {
          const pickedTime = window.prompt("Choose a time to send this quest (HH:mm)", "09:00");
          if (!pickedTime || !TIME_24H_REGEX.test(pickedTime)) {
            toast.error("Calendar send cancelled. Please choose a valid HH:mm time.");
            return;
          }
          scheduledTimeOverride = pickedTime;
        }

        try {
          await attempt();
          toast.success("Quest synced to calendar");
          return;
        } catch (retryError) {
          message = retryError instanceof Error ? retryError.message : "Failed to send quest to calendar";
          if (
            !message.includes("TASK_DATE_REQUIRED")
            && !message.includes("SCHEDULED_TIME_REQUIRED")
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

      if (message.includes("SCHEDULED_TIME_REQUIRED")) {
        toast.error("Please assign a time before sending this quest to calendar.");
        return;
      }

      toast.error(message);
    }
  }, [sendTaskToCalendar]);

  const handleSaveEdit = useCallback(async (taskId: string, updates: any) => {
    await updateTask({ taskId, updates });
    await syncTaskUpdate.mutateAsync({ taskId }).catch(() => {
      toast.error("Saved quest, but failed to sync linked calendar event");
    });
    queryClient.invalidateQueries({ queryKey: ["inbox-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["inbox-count"] });
    setEditingTask(null);
  }, [updateTask, syncTaskUpdate, queryClient]);

  const handleDeleteQuest = useCallback(async (taskId: string) => {
    await syncTaskDelete.mutateAsync({ taskId }).catch(() => {
      toast.error("Failed to remove linked calendar event");
    });
    deleteInboxTask(taskId);
  }, [deleteInboxTask, syncTaskDelete]);

  const handleAddQuest = useCallback(async (data: AddQuestData) => {
    if (!user?.id) return;
    const taskDate = data.sendToInbox
      ? null
      : (data.taskDate ?? format(new Date(), 'yyyy-MM-dd'));

    const createdTask = await addTask({
      taskText: data.text,
      difficulty: data.difficulty,
      taskDate: taskDate,
      isMainQuest: false,
      scheduledTime: data.scheduledTime,
      estimatedDuration: data.estimatedDuration,
      recurrencePattern: data.recurrencePattern,
      recurrenceDays: data.recurrenceDays,
      reminderEnabled: data.reminderEnabled,
      reminderMinutesBefore: data.reminderMinutesBefore,
      notes: data.moreInformation,
      location: data.location,
      contactId: data.contactId,
      autoLogInteraction: data.autoLogInteraction,
      subtasks: data.subtasks,
    });

    if (data.sendToCalendar && createdTask?.id) {
      await handleSendTaskToCalendar(createdTask.id);
    }
    if (!data.sendToInbox) {
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
    }
    queryClient.invalidateQueries({ queryKey: ["inbox-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["inbox-count"] });
    setShowAddQuest(false);
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

        {/* FAB */}
        <DraggableFAB onTap={() => setShowAddQuest(true)} />

        <AddQuestSheet
          open={showAddQuest}
          onOpenChange={setShowAddQuest}
          selectedDate={new Date()}
          onAdd={handleAddQuest}
        />

        <EditQuestDialog
          task={editingTask}
          open={!!editingTask}
          onOpenChange={(open) => !open && setEditingTask(null)}
          onSave={handleSaveEdit}
          isSaving={isUpdating}
          onSendToCalendar={handleSendTaskToCalendar}
          hasCalendarLink={editingTask ? hasLinkedEvent(editingTask.id) : false}
          isSendingToCalendar={sendTaskToCalendar.isPending}
          onDelete={async (taskId) => {
            await handleDeleteQuest(taskId);
            setEditingTask(null);
          }}
          isDeleting={false}
        />

        <BottomNav />
      </div>
    </PageTransition>
  );
});

export default InboxPage;
