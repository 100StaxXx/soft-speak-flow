import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Flag, 
  Calendar, 
  Sparkles, 
  AlertCircle,
  ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useMilestones, Milestone } from "@/hooks/useMilestones";
import { useCompanionPostcards } from "@/hooks/useCompanionPostcards";
import { useCompanion } from "@/hooks/useCompanion";
import { JourneyDetailDrawer } from "./JourneyDetailDrawer";
import { PostcardUnlockCelebration } from "./PostcardUnlockCelebration";

interface MilestoneProgressProps {
  epicId: string;
  epicTitle: string;
  epicGoal?: string;
  currentDeadline?: string;
  compact?: boolean;
}

export const MilestoneProgress = ({ 
  epicId, 
  epicTitle,
  epicGoal,
  currentDeadline,
  compact = false 
}: MilestoneProgressProps) => {
  const {
    milestones,
    completedCount,
    totalCount,
    nextMilestone,
    completeMilestone,
    isMilestoneOverdue,
    getDaysUntilMilestone,
    isCompleting,
  } = useMilestones(epicId);

  const { checkMilestoneForPostcard, postcardJustUnlocked, clearPostcardUnlocked } = useCompanionPostcards();
  const { companion } = useCompanion();

  const handleQuickComplete = async (milestone: Milestone, e: React.MouseEvent) => {
    e.stopPropagation();
    completeMilestone.mutate({
      milestoneId: milestone.id,
      epicId,
      onPostcardTrigger: (completedMilestone) => {
        checkMilestoneForPostcard(completedMilestone.id, epicId, companion?.id || "", {
          spirit_animal: companion?.spirit_animal,
          favorite_color: companion?.favorite_color,
          core_element: companion?.core_element,
          eye_color: companion?.eye_color,
          fur_color: companion?.fur_color,
        });
      },
    });
  };

  if (totalCount === 0) {
    return null;
  }

  // Compact view for JourneyCard - just shows progress and next milestone
  if (compact) {
    return (
      <>
        <PostcardUnlockCelebration
          show={!!postcardJustUnlocked}
          milestoneTitle={postcardJustUnlocked?.milestoneTitle}
          chapterNumber={postcardJustUnlocked?.chapterNumber}
          onDismiss={clearPostcardUnlocked}
        />
        <div className="space-y-2">
        {/* Progress Bar */}
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground flex items-center gap-1">
            <Flag className="w-3 h-3" />
            Milestones
          </span>
          <span className="font-medium">{completedCount} / {totalCount}</span>
        </div>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / totalCount) * 100}%` }}
          />
        </div>

        {/* Next Milestone */}
        {nextMilestone && (
          <div className={cn(
            "flex items-center gap-2 p-2 rounded-lg text-xs",
            isMilestoneOverdue(nextMilestone) 
              ? "bg-destructive/10 border border-destructive/20" 
              : "bg-secondary/50"
          )}>
            <Checkbox
              checked={false}
              onCheckedChange={() => handleQuickComplete(nextMilestone, {} as React.MouseEvent)}
              disabled={isCompleting}
              className="h-4 w-4"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-medium truncate">{nextMilestone.title}</span>
                {nextMilestone.is_postcard_milestone && (
                  <Sparkles className="w-3 h-3 text-stardust-gold flex-shrink-0" />
                )}
              </div>
              {nextMilestone.target_date && (
                <div className={cn(
                  "flex items-center gap-1 text-[10px]",
                  isMilestoneOverdue(nextMilestone) ? "text-destructive" : "text-muted-foreground"
                )}>
                  <Calendar className="w-2.5 h-2.5" />
                  {format(new Date(nextMilestone.target_date), "MMM d")}
                  {isMilestoneOverdue(nextMilestone) && (
                    <AlertCircle className="w-2.5 h-2.5" />
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* View All Link */}
        <JourneyDetailDrawer epicId={epicId} epicTitle={epicTitle} epicGoal={epicGoal} currentDeadline={currentDeadline}>
          <Button variant="ghost" size="sm" className="w-full text-xs h-7 text-muted-foreground">
            Milestones
            <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </JourneyDetailDrawer>
        </div>
      </>
    );
  }

  // Full view - shows multiple upcoming milestones
  const upcomingMilestones = milestones
    .filter(m => !m.completed_at)
    .slice(0, 3);

  return (
    <>
      <PostcardUnlockCelebration
        show={!!postcardJustUnlocked}
        milestoneTitle={postcardJustUnlocked?.milestoneTitle}
        chapterNumber={postcardJustUnlocked?.chapterNumber}
        onDismiss={clearPostcardUnlocked}
      />
      <div className="space-y-3">
      {/* Header with progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flag className="w-4 h-4 text-celestial-blue" />
          <span className="font-medium text-sm">Milestones</span>
        </div>
        <Badge variant="gold" className="text-xs">
          {completedCount} / {totalCount}
        </Badge>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-celestial-blue via-primary to-stardust-gold rounded-full transition-all duration-500"
          style={{ width: `${(completedCount / totalCount) * 100}%` }}
        />
      </div>

      {/* Upcoming Milestones */}
      {upcomingMilestones.length > 0 && (
        <div className="space-y-2">
          {upcomingMilestones.map((milestone) => {
            const daysUntil = getDaysUntilMilestone(milestone);
            const isOverdue = isMilestoneOverdue(milestone);

            return (
              <div
                key={milestone.id}
                className={cn(
                  "flex items-center gap-3 p-2.5 rounded-lg transition-colors",
                  isOverdue 
                    ? "bg-destructive/10 border border-destructive/20" 
                    : "bg-secondary/50 hover:bg-secondary/70"
                )}
              >
                <Checkbox
                  checked={false}
                  onCheckedChange={() => handleQuickComplete(milestone, {} as React.MouseEvent)}
                  disabled={isCompleting}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm truncate">
                      {milestone.title}
                    </span>
                    {milestone.is_postcard_milestone && (
                      <Sparkles className="w-3.5 h-3.5 text-stardust-gold flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {milestone.phase_name && (
                      <span className="text-[10px] text-muted-foreground">
                        {milestone.phase_name}
                      </span>
                    )}
                    {milestone.target_date && (
                      <div className={cn(
                        "flex items-center gap-1 text-[10px]",
                        isOverdue ? "text-destructive" : "text-muted-foreground"
                      )}>
                        <Calendar className="w-2.5 h-2.5" />
                        {format(new Date(milestone.target_date), "MMM d")}
                        {daysUntil !== null && !isOverdue && (
                          <span>({daysUntil > 0 ? `${daysUntil}d` : "today"})</span>
                        )}
                        {isOverdue && <AlertCircle className="w-2.5 h-2.5" />}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View All Button */}
      <JourneyDetailDrawer epicId={epicId} epicTitle={epicTitle} epicGoal={epicGoal} currentDeadline={currentDeadline}>
        <Button variant="outline" size="sm" className="w-full text-xs">
          View full timeline
          <ChevronRight className="w-3 h-3 ml-1" />
        </Button>
      </JourneyDetailDrawer>
      </div>
    </>
  );
};
