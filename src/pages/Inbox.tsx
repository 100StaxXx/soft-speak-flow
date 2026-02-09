import { useState, useCallback, memo } from "react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Inbox as InboxIcon, Plus, Check, CalendarDays, Trash2, Circle, Pencil } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { BottomNav } from "@/components/BottomNav";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useInboxTasks } from "@/hooks/useInboxTasks";
import { DraggableFAB } from "@/components/DraggableFAB";
import { AddQuestSheet, type AddQuestData } from "@/components/AddQuestSheet";
import { EditQuestDialog } from "@/features/quests/components/EditQuestDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTaskMutations } from "@/hooks/useTaskMutations";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { haptics } from "@/utils/haptics";

const InboxPage = memo(function InboxPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { inboxTasks, inboxCount, isLoading, toggleInboxTask, deleteInboxTask, scheduleTask } = useInboxTasks();

  const [showAddQuest, setShowAddQuest] = useState(false);
  const [schedulingTaskId, setSchedulingTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<typeof inboxTasks[number] | null>(null);

  const { updateTask, deleteTask, isUpdating, isDeleting } = useTaskMutations(format(new Date(), "yyyy-MM-dd"));

  const handleSaveEdit = useCallback(async (taskId: string, updates: any) => {
    await updateTask({ taskId, updates });
    queryClient.invalidateQueries({ queryKey: ["inbox-tasks"] });
    setEditingTask(null);
  }, [updateTask, queryClient]);

  const handleAddQuest = useCallback(async (data: AddQuestData) => {
    if (!user?.id) return;
    const { error } = await supabase.from("daily_tasks").insert({
      user_id: user.id,
      task_text: data.text,
      xp_reward: 10,
      task_date: null, // Always inbox
      completed: false,
    });
    if (error) {
      toast.error("Failed to add task");
    } else {
      toast.success("Added to inbox");
      queryClient.invalidateQueries({ queryKey: ["inbox-tasks"] });
    }
    setShowAddQuest(false);
  }, [user?.id, queryClient]);

  const handleSchedule = useCallback((taskId: string, date: Date) => {
    const targetDate = format(date, "yyyy-MM-dd");
    scheduleTask({ taskId, targetDate });
    setSchedulingTaskId(null);
    toast.success(`Scheduled for ${format(date, "MMM d")}`);
    haptics.light();
  }, [scheduleTask]);

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-24">
        <StarfieldBackground />

        {/* Header */}
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/30">
          <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <InboxIcon className="h-5 w-5 text-celestial-blue" />
              <h1 className="text-lg font-bold">Inbox</h1>
              {inboxCount > 0 && (
                <Badge variant="celestial" className="text-xs">
                  {inboxCount}
                </Badge>
              )}
            </div>
          </div>
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
              description="Capture tasks with the + button — schedule them later when you're ready."
              actionLabel="Add a task"
              onAction={() => setShowAddQuest(true)}
            />
          ) : (
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {inboxTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    className="flex items-center gap-3 py-3 px-3 rounded-xl bg-card/60 backdrop-blur-sm border border-border/20"
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
                      <Popover
                        open={schedulingTaskId === task.id}
                        onOpenChange={(open) => setSchedulingTaskId(open ? task.id : null)}
                      >
                        <PopoverTrigger asChild>
                          <button
                            className="p-2 rounded-lg hover:bg-muted/50 text-celestial-blue transition-colors touch-manipulation"
                            aria-label="Schedule task"
                          >
                            <CalendarDays className="w-4 h-4" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <Calendar
                            mode="single"
                            selected={undefined}
                            onSelect={(date) => date && handleSchedule(task.id, date)}
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          />
                        </PopoverContent>
                      </Popover>

                      <button
                        onClick={() => {
                          setEditingTask(task);
                          haptics.light();
                        }}
                        className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
                        aria-label="Edit task"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          deleteInboxTask(task.id);
                          haptics.light();
                        }}
                        className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors touch-manipulation"
                        aria-label="Delete task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
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
