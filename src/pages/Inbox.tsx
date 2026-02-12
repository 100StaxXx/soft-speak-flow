import { useState, useCallback, memo } from "react";
import { format } from "date-fns";
import { motion, useReducedMotion } from "framer-motion";
import { Inbox as InboxIcon, Check, Trash2, Pencil } from "lucide-react";
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

const InboxPage = memo(function InboxPage() {
  const prefersReducedMotion = useReducedMotion();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { inboxTasks, inboxCount, isLoading, toggleInboxTask, deleteInboxTask } = useInboxTasks();

  const [showAddQuest, setShowAddQuest] = useState(false);
  const [editingTask, setEditingTask] = useState<typeof inboxTasks[number] | null>(null);

  const { addTask, updateTask, isUpdating } = useTaskMutations(format(new Date(), "yyyy-MM-dd"));

  const handleSaveEdit = useCallback(async (taskId: string, updates: any) => {
    await updateTask({ taskId, updates });
    queryClient.invalidateQueries({ queryKey: ["inbox-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["inbox-count"] });
    setEditingTask(null);
  }, [updateTask, queryClient]);

  const handleAddQuest = useCallback(async (data: AddQuestData) => {
    if (!user?.id) return;
    const taskDate = data.sendToInbox
      ? null
      : (data.taskDate ?? format(new Date(), 'yyyy-MM-dd'));

    await addTask({
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
    if (!data.sendToInbox) {
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
    }
    queryClient.invalidateQueries({ queryKey: ["inbox-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["inbox-count"] });
    setShowAddQuest(false);
  }, [user?.id, addTask, queryClient]);

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
                        deleteInboxTask(task.id);
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
          onDelete={async (taskId) => {
            deleteInboxTask(taskId);
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
