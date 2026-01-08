import { useState, useMemo } from "react";
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
  Calendar, 
  CheckCircle2, 
  Circle, 
  Star, 
  AlertCircle,
  ChevronRight,
  Sparkles,
  Wand2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useMilestones, Milestone } from "@/hooks/useMilestones";
import { useCompanionPostcards } from "@/hooks/useCompanionPostcards";
import { useCompanion } from "@/hooks/useCompanion";
import { useXPRewards } from "@/hooks/useXPRewards";
import { useStreakMultiplier } from "@/hooks/useStreakMultiplier";
import { useJourneyPathImage } from "@/hooks/useJourneyPathImage";
import { RescheduleDrawer } from "./RescheduleDrawer";
import { PostcardUnlockCelebration } from "./PostcardUnlockCelebration";
import { MilestoneDetailDrawer } from "./journey/MilestoneDetailDrawer";

interface JourneyDetailDrawerProps {
  epicId: string;
  epicTitle: string;
  epicGoal?: string;
  currentDeadline?: string;
  children?: React.ReactNode;
}

export const JourneyDetailDrawer = ({ 
  epicId, 
  epicTitle,
  epicGoal,
  currentDeadline,
  children 
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
    getPhaseStats,
    isMilestoneOverdue,
    getDaysUntilMilestone,
    isCompleting,
  } = useMilestones(epicId);

  const { postcards, checkMilestoneForPostcard, postcardJustUnlocked, clearPostcardUnlocked } = useCompanionPostcards();
  const { companion } = useCompanion();
  const { awardMilestoneComplete, awardPhaseComplete, awardEpicComplete } = useXPRewards();
  const { multiplier: streakMultiplier } = useStreakMultiplier();
  const { regeneratePathForMilestone } = useJourneyPathImage(epicId);

  const currentPhase = getCurrentPhase();
  const phaseStats = getPhaseStats();

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
  const checkEpicCompletion = () => {
    // After this milestone, check if all will be complete
    const allComplete = milestones.every(m => 
      m.id === selectedMilestone?.id || m.completed_at
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
    });
    
    // Regenerate journey path image to reflect new location
    if (milestoneIndex >= 0) {
      regeneratePathForMilestone(milestoneIndex + 1); // +1 because 0 is initial
    }
    
    // Award XP
    awardMilestoneComplete(milestone.is_postcard_milestone || false);
    
    // Check for phase/epic completion bonuses
    checkPhaseCompletion(milestone);
    checkEpicCompletion();
    
    // Close the detail drawer
    setSelectedMilestone(null);
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
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="flex items-center gap-2">
            <Map className="w-5 h-5 text-primary" />
            {epicTitle}
          </DrawerTitle>
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {completedCount} / {totalCount} milestones
              </Badge>
              {currentPhase && (
                <Badge variant="outline" className="text-xs">
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
              >
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7">
                  <Wand2 className="w-3.5 h-3.5" />
                  Reschedule
                </Button>
              </RescheduleDrawer>
            )}
          </div>
        </DrawerHeader>

        <div 
          className="flex-1 px-4 pb-6 max-h-[60vh] overflow-y-auto overscroll-contain"
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
            <div className="space-y-2">
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
                      onClick={() => handleMilestoneClick(milestone)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                        status === "completed" && "bg-green-500/5",
                        status === "overdue" && "bg-destructive/5",
                        status === "pending" && "bg-secondary/30 hover:bg-secondary/50"
                      )}
                    >
                      <Checkbox
                        checked={!!milestone.completed_at}
                        disabled={true}
                        className="pointer-events-none"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <span className={cn(
                          "text-sm",
                          status === "completed" && "line-through text-muted-foreground"
                        )}>
                          {milestone.title}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {milestone.target_date && (
                          <span className={cn(
                            "text-xs text-muted-foreground",
                            status === "overdue" && "text-destructive"
                          )}>
                            {format(new Date(milestone.target_date), "MMM d")}
                          </span>
                        )}
                        
                        {status === "completed" && (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        )}
                        {status === "overdue" && (
                          <AlertCircle className="w-4 h-4 text-destructive" />
                        )}
                        {milestone.is_postcard_milestone && !milestone.completed_at && (
                          <Star className="w-4 h-4 text-amber-500" />
                        )}
                        
                        <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
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
      streakMultiplier={streakMultiplier ?? 1}
    />
    </>
  );
};
