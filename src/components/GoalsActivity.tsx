import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QuestInboxSection } from "@/components/QuestInboxSection";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { useInboxTasks } from "@/hooks/useInboxTasks";
import { useProfile } from "@/hooks/useProfile";
import { useStreakMultiplier } from "@/hooks/useStreakMultiplier";
import { getEffectiveMissionDate } from "@/utils/timezone";
import { ConnectedTasks } from "@/components/calendar/ConnectedTasks";

/** Goal progress belongs here; Calendar remains focused on scheduling. */
export function GoalsActivity() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const missionDate = getEffectiveMissionDate(profile?.timezone ?? undefined);
  const today = useMemo(() => new Date(`${missionDate}T12:00:00`), [missionDate]);
  const { completedCount, totalCount } = useTasksQuery(today);
  const { currentStreak } = useStreakMultiplier();
  const { inboxTasks, isLoading, toggleInboxTask, deleteInboxTask } = useInboxTasks();
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mb-6 space-y-5" data-testid="goals-activity">
      <section aria-label="Your progress" className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
        <span>{completedCount} of {totalCount} quests complete today</span>
        <span>{currentStreak} day streak</span>
      </section>
      <QuestInboxSection
        tasks={inboxTasks}
        isLoading={isLoading}
        isExpanded={expanded}
        onExpandedChange={setExpanded}
        onToggleQuest={(taskId, completed) => toggleInboxTask({ taskId, completed })}
        onEditQuest={(task) => navigate(`/journeys?taskId=${encodeURIComponent(task.id)}`)}
        onDeleteQuest={(taskId) => { deleteInboxTask(taskId); }}
      />
      <ConnectedTasks />
    </div>
  );
}
