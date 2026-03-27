import { memo, useEffect, useMemo, useState, type RefObject } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { haptics } from "@/utils/haptics";
import { Check, ChevronDown, Inbox, Pencil, Plus, Trash2 } from "lucide-react";

const PREVIEW_LIMIT = 4;

export interface InboxQuestItem {
  id: string;
  task_text: string;
  completed: boolean;
  task_date?: string | null;
  difficulty?: string | null;
  scheduled_time?: string | null;
  estimated_duration?: number | null;
  recurrence_pattern?: string | null;
  recurrence_days?: number[] | null;
  recurrence_month_days?: number[] | null;
  recurrence_custom_period?: "week" | "month" | null;
  reminder_enabled?: boolean | null;
  reminder_minutes_before?: number | null;
  category?: string | null;
  notes?: string | null;
  habit_source_id?: string | null;
  image_url?: string | null;
  location?: string | null;
}

interface QuestInboxSectionProps {
  tasks: InboxQuestItem[];
  isLoading: boolean;
  isExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onAddQuest: () => void;
  onToggleQuest: (taskId: string, completed: boolean) => void;
  onEditQuest: (task: InboxQuestItem) => void | Promise<void>;
  onDeleteQuest: (taskId: string) => void | Promise<void>;
  sectionRef?: RefObject<HTMLDivElement | null>;
}

export const QuestInboxSection = memo(function QuestInboxSection({
  tasks,
  isLoading,
  isExpanded,
  onExpandedChange,
  onAddQuest,
  onToggleQuest,
  onEditQuest,
  onDeleteQuest,
  sectionRef,
}: QuestInboxSectionProps) {
  const [showAllTasks, setShowAllTasks] = useState(false);

  useEffect(() => {
    if (tasks.length <= PREVIEW_LIMIT) {
      setShowAllTasks(false);
    }
  }, [tasks.length]);

  const visibleTasks = useMemo(() => {
    if (showAllTasks || tasks.length <= PREVIEW_LIMIT) {
      return tasks;
    }
    return tasks.slice(0, PREVIEW_LIMIT);
  }, [showAllTasks, tasks]);

  const hiddenTaskCount = Math.max(0, tasks.length - visibleTasks.length);

  return (
    <section
      ref={sectionRef}
      data-testid="journeys-inbox-section"
      className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(23,20,38,0.94),rgba(16,13,27,0.9))] p-4 shadow-[0_20px_40px_rgba(0,0,0,0.2)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-celestial-blue/15 text-celestial-blue">
            <Inbox className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Inbox</h2>
              <Badge className="border-0 bg-celestial-blue/15 text-celestial-blue">
                {tasks.length}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Quests without an assigned time yet. Plan them here before they hit your day.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="gap-2"
            onClick={() => {
              haptics.light();
              onAddQuest();
            }}
          >
            <Plus className="h-4 w-4" />
            Add quest
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Collapse inbox section" : "Expand inbox section"}
            className="rounded-2xl"
            onClick={() => {
              haptics.light();
              onExpandedChange(!isExpanded);
            }}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
          </Button>
        </div>
      </div>

      {isExpanded ? (
        <div className="mt-4 space-y-3">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-14 animate-pulse rounded-2xl bg-white/[0.05]"
                />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div
              data-testid="journeys-inbox-empty"
              className="rounded-2xl border border-dashed border-border/50 bg-white/[0.03] px-4 py-6 text-center"
            >
              <p className="text-sm font-medium text-foreground">Inbox is empty</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add a quest here when you want to capture it now and schedule it later.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {visibleTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 rounded-2xl border border-border/55 bg-card/82 px-3 py-3 backdrop-blur-lg shadow-[0_8px_18px_rgba(0,0,0,0.16)]"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        haptics.light();
                        onToggleQuest(task.id, !task.completed);
                      }}
                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/40 transition-colors hover:border-primary"
                      aria-label={task.completed ? "Mark quest incomplete" : "Mark quest complete"}
                    >
                      {task.completed ? <Check className="h-4 w-4 text-primary" /> : null}
                    </button>

                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-sm text-foreground",
                          task.completed && "text-muted-foreground line-through",
                        )}
                      >
                        {task.task_text}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        No time assigned yet
                      </p>
                    </div>

                    <div className="flex flex-shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          haptics.light();
                          onEditQuest(task);
                        }}
                        className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted/55 hover:text-foreground"
                        aria-label="Edit quest"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          haptics.light();
                          void onDeleteQuest(task.id);
                        }}
                        className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-destructive/12 hover:text-destructive"
                        aria-label="Delete quest"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {hiddenTaskCount > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full rounded-2xl text-muted-foreground"
                  onClick={() => setShowAllTasks((current) => !current)}
                >
                  {showAllTasks ? "Show less" : `Show ${hiddenTaskCount} more quest${hiddenTaskCount === 1 ? "" : "s"}`}
                </Button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
});
