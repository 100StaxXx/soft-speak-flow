import { useState, useMemo, type CSSProperties } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Checkbox } from "@/components/ui/checkbox";

import { 
  Map, 
  CheckCircle2, 
  Star, 
  AlertCircle,
  ChevronRight,
  Wand2,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useMilestones, Milestone } from "@/hooks/useMilestones";
import { useCompanionPostcards } from "@/hooks/useCompanionPostcards";
import { useCompanion } from "@/hooks/useCompanion";
import { useXPRewards } from "@/hooks/useXPRewards";
import { useJourneyPathImage } from "@/hooks/useJourneyPathImage";
import { usePlannerPathfinderAppearance } from "@/hooks/usePlannerPathfinderAppearance";
import { getCompanionFrostedThemeStyle } from "@/lib/companionFrostedTheme";
import { plannerPathfinderTheme } from "@/components/companion/plannerPathfinderTheme";
import { RescheduleDrawer } from "./RescheduleDrawer";
import { PostcardUnlockCelebration } from "./PostcardUnlockCelebration";
import { MilestoneDetailDrawer } from "./journey/MilestoneDetailDrawer";

interface JourneyDetailDrawerProps {
  epicId: string;
  epicTitle: string;
  epicGoal?: string;
  currentDeadline?: string;
  children?: React.ReactNode;
  companionFrostedThemeStyle?: CSSProperties;
}

export const JourneyDetailDrawer = ({ 
  epicId, 
  epicTitle,
  epicGoal,
  currentDeadline,
  children,
  companionFrostedThemeStyle,
}: JourneyDetailDrawerProps) => {
  const [open, setOpen] = useState(false);
  
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  
  const {
    milestones,
    milestonesByPhase,
    isLoading,
    completedCount,
    totalCount,
    completeMilestone,
    uncompleteMilestone,
    getCurrentPhase,
    isMilestoneOverdue,
    isCompleting,
  } = useMilestones(epicId);

  const { postcards, checkMilestoneForPostcard, postcardJustUnlocked, clearPostcardUnlocked } = useCompanionPostcards();
  const { companion } = useCompanion();
  const { themeModeClassName } = usePlannerPathfinderAppearance();
  const { awardMilestoneComplete, awardPhaseComplete, awardEpicComplete } = useXPRewards();
  const { regeneratePathForMilestone } = useJourneyPathImage(epicId);
  const resolvedCompanionFrostedThemeStyle = useMemo(
    () => companionFrostedThemeStyle ?? getCompanionFrostedThemeStyle(companion?.favorite_color),
    [companionFrostedThemeStyle, companion?.favorite_color],
  );

  const currentPhase = getCurrentPhase();
  // Get postcards for this epic
  const epicPostcards = useMemo(() => 
    postcards?.filter(p => p.epic_id === epicId) || [], 
    [postcards, epicId]
  );

  // Get postcard for a specific milestone
  const getPostcardForMilestone = (milestone: Milestone) => 
    epicPostcards.find(p => p.milestone_percent === milestone.milestone_percent);

  // Check if phase is complete after milestone completion
  const checkPhaseCompletion = (completedMilestone: Milestone) => {
    const phase = milestonesByPhase.find(p => p.phaseName === completedMilestone.phase_name);
    if (!phase) return;
    
    // Check if all milestones in phase will be complete after this one
    const allComplete = phase.milestones.every(m => 
      m.id === completedMilestone.id || m.completed_at
    );
    
    if (allComplete) {
      awardPhaseComplete(phase.phaseName);
    }
  };

  // Check if epic is complete after milestone completion
  const checkEpicCompletion = (completedMilestone: Milestone) => {
    // After this milestone, check if all will be complete
    const allComplete = milestones.every(m => 
      m.id === completedMilestone.id || m.completed_at
    );
    
    if (allComplete && totalCount > 0) {
      awardEpicComplete(epicTitle);
    }
  };

  const handleMilestoneComplete = async (milestone: Milestone) => {
    // Get the milestone index for path regeneration
    const milestoneIndex = milestones.findIndex(m => m.id === milestone.id);
    
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
    }, {
      onSuccess: () => {
        // Regenerate journey path image to reflect new location
        if (milestoneIndex >= 0) {
          regeneratePathForMilestone(milestoneIndex + 1); // +1 because 0 is initial
        }

        // Award XP
        awardMilestoneComplete(milestone.is_postcard_milestone || false);

        // Check for phase/epic completion bonuses
        checkPhaseCompletion(milestone);
        checkEpicCompletion(milestone);

        // Close the detail drawer
        setSelectedMilestone(null);
      },
    });
  };

  const handleMilestoneUncomplete = (milestone: Milestone) => {
    uncompleteMilestone.mutate(milestone.id);
    setSelectedMilestone(null);
  };

  const handleMilestoneClick = (milestone: Milestone) => {
    setSelectedMilestone(milestone);
  };

  const getMilestoneStatus = (milestone: Milestone) => {
    if (milestone.completed_at) return "completed";
    if (isMilestoneOverdue(milestone)) return "overdue";
    return "pending";
  };

  return (
    <>
      <PostcardUnlockCelebration
        show={!!postcardJustUnlocked}
        milestoneTitle={postcardJustUnlocked?.milestoneTitle}
        chapterNumber={postcardJustUnlocked?.chapterNumber}
        onDismiss={clearPostcardUnlocked}
      />
      <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false} handleOnly={true}>
      <DrawerTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
            <Map className="w-3.5 h-3.5" />
            View Timeline
          </Button>
        )}
      </DrawerTrigger>
      <DrawerContent
        className={cn(
          themeModeClassName,
          "max-h-[85vh] rounded-t-[2.25rem] border-2 border-[hsl(var(--celestial-blue)_/_0.34)] bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--card))_52%,hsl(var(--secondary))_100%)] text-foreground shadow-[0_-18px_56px_-36px_rgba(var(--primary-rgb),0.58),inset_0_1px_0_rgba(255,255,255,0.72)]",
        )}
        style={resolvedCompanionFrostedThemeStyle}
        data-testid="journey-detail-drawer-content"
      >
        <DrawerHeader className="border-b border-[hsl(var(--celestial-blue)_/_0.24)] bg-card/65 px-4 pb-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl">
          <DrawerTitle className="flex items-start gap-2 text-left text-base font-semibold leading-snug text-foreground">
            <Map className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--category-soul))]" />
            <span className="min-w-0 flex-1 break-words">{epicTitle}</span>
          </DrawerTitle>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Badge
                variant="secondary"
                className="border border-[hsl(var(--celestial-blue)_/_0.28)] bg-card/90 text-xs font-semibold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]"
              >
                {completedCount} / {totalCount} milestones
              </Badge>
              {currentPhase && (
                <Badge
                  variant="outline"
                  className="border-[hsl(var(--celestial-blue)_/_0.48)] bg-[hsl(var(--celestial-blue)_/_0.12)] text-xs font-semibold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]"
                >
                  Current: {currentPhase}
                </Badge>
              )}
            </div>
            {currentDeadline && (
              <RescheduleDrawer
                epicId={epicId}
                epicTitle={epicTitle}
                epicGoal={epicGoal}
                currentDeadline={currentDeadline}
                visualStyle="planner"
                companionFrostedThemeStyle={resolvedCompanionFrostedThemeStyle}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(plannerPathfinderTheme.outlineButton, "h-8 gap-1.5 px-3 text-xs font-semibold")}
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  Reschedule
                </Button>
              </RescheduleDrawer>
            )}
          </div>
        </DrawerHeader>

        <div 
          className="flex-1 px-4 pb-6 pt-4 max-h-[60vh] overflow-y-auto overscroll-contain text-foreground"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
          data-vaul-no-drag
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : milestones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Map className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No milestones yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {milestones
                .sort((a, b) => {
                  if (!a.target_date && !b.target_date) return 0;
                  if (!a.target_date) return 1;
                  if (!b.target_date) return -1;
                  return new Date(a.target_date).getTime() - new Date(b.target_date).getTime();
                })
                .map((milestone) => {
                  const status = getMilestoneStatus(milestone);
                  
                  return (
                    <div
                      key={milestone.id}
                      data-testid={`journey-milestone-row-${milestone.id}`}
                      onClick={() => handleMilestoneClick(milestone)}
                      className={cn(
                        "flex min-h-[4.5rem] cursor-pointer items-center gap-3 rounded-[1.4rem] border px-3.5 py-3 text-left text-foreground shadow-[0_10px_24px_-22px_rgba(var(--primary-rgb),0.42),inset_0_1px_0_rgba(255,255,255,0.72)] transition-colors",
                        status === "completed" && "border-epic-nature/25 bg-[linear-gradient(180deg,hsl(var(--card)_/_0.97),hsl(var(--epic-nature)_/_0.08))] hover:border-epic-nature/40 hover:bg-card",
                        status === "overdue" && "border-destructive/30 bg-[linear-gradient(180deg,hsl(var(--card)_/_0.97),hsl(var(--destructive)_/_0.08))] hover:border-destructive/45 hover:bg-card",
                        status === "pending" && "border-[hsl(var(--celestial-blue)_/_0.28)] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.97),hsl(var(--secondary)_/_0.68))] hover:border-[hsl(var(--celestial-blue)_/_0.48)] hover:bg-card"
                      )}
                    >
                      <Checkbox
                        checked={!!milestone.completed_at}
                        disabled={true}
                        className="pointer-events-none h-5 w-5 rounded-full border-2 border-[hsl(var(--celestial-blue)_/_0.58)] bg-card text-primary-foreground disabled:opacity-100 data-[state=checked]:border-epic-nature data-[state=checked]:bg-epic-nature"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <span
                          data-testid={`journey-milestone-title-${milestone.id}`}
                          className={cn(
                            "block text-sm font-semibold leading-5 text-foreground",
                            status === "completed" && "line-through opacity-70"
                          )}
                        >
                          {milestone.title}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {milestone.target_date && (
                          <span
                            data-testid={`journey-milestone-date-${milestone.id}`}
                            className={cn(
                              "text-xs font-semibold text-foreground/70",
                              status === "overdue" && "text-destructive"
                            )}
                          >
                            {format(new Date(milestone.target_date), "MMM d")}
                          </span>
                        )}
                        
                        {status === "completed" && (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-epic-nature" />
                        )}
                        {status === "overdue" && (
                          <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                        )}
                        {milestone.is_postcard_milestone && !milestone.completed_at && (
                          <Star className="h-4 w-4 shrink-0 text-amber-500" />
                        )}
                        
                        <ChevronRight className="h-4 w-4 shrink-0 text-foreground/35" />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
    
    {/* Milestone Detail Drawer */}
    <MilestoneDetailDrawer
      milestone={selectedMilestone}
      isOpen={!!selectedMilestone}
      onClose={() => setSelectedMilestone(null)}
      onComplete={handleMilestoneComplete}
      onUncomplete={handleMilestoneUncomplete}
      isCompleting={isCompleting}
      status={selectedMilestone ? getMilestoneStatus(selectedMilestone) : "pending"}
      postcard={selectedMilestone ? getPostcardForMilestone(selectedMilestone) : undefined}
      companionFrostedThemeStyle={resolvedCompanionFrostedThemeStyle}
    />
    </>
  );
};
