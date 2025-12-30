import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  LayoutList,
  GitBranch,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useMilestones, Milestone } from "@/hooks/useMilestones";
import { useCompanionPostcards } from "@/hooks/useCompanionPostcards";
import { useCompanion } from "@/hooks/useCompanion";
import { RescheduleDrawer } from "./RescheduleDrawer";
import { PhaseProgressTimeline } from "./journey/PhaseProgressTimeline";
import { PhaseProgressCard } from "./journey/PhaseProgressCard";
import { PostcardUnlockCelebration } from "./PostcardUnlockCelebration";

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
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('timeline');
  
  const {
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

  const { checkMilestoneForPostcard, postcardJustUnlocked, clearPostcardUnlocked } = useCompanionPostcards();
  const { companion } = useCompanion();

  const currentPhase = getCurrentPhase();
  const phaseStats = getPhaseStats();

  const handleMilestoneToggle = async (milestone: Milestone) => {
    if (milestone.completed_at) {
      uncompleteMilestone.mutate(milestone.id);
    } else {
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
    }
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
      <Drawer open={open} onOpenChange={setOpen}>
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

        {/* View Mode Tabs */}
        <div className="px-4 pb-3">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'timeline' | 'list')}>
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger value="timeline" className="text-xs gap-1.5">
                <GitBranch className="w-3.5 h-3.5" />
                Timeline
              </TabsTrigger>
              <TabsTrigger value="list" className="text-xs gap-1.5">
                <LayoutList className="w-3.5 h-3.5" />
                List
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div 
          className="flex-1 px-4 pb-6 max-h-[60vh] overflow-y-auto overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
          data-vaul-no-drag
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : milestonesByPhase.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Map className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No milestones yet</p>
            </div>
          ) : viewMode === 'timeline' ? (
            <div className="space-y-4">
              {/* Phase Progress Card */}
              <PhaseProgressCard
                milestonesByPhase={milestonesByPhase}
                currentPhaseName={currentPhase}
              />
              
              {/* Visual Timeline */}
              <PhaseProgressTimeline
                milestonesByPhase={milestonesByPhase}
                currentPhaseName={currentPhase}
                deadline={currentDeadline}
                variant="vertical"
              />
            </div>
          ) : (
            <div className="space-y-6">
              <AnimatePresence mode="wait">
                {milestonesByPhase.map((phase, phaseIndex) => (
                  <motion.div
                    key={phase.phaseName}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: phaseIndex * 0.1 }}
                    className="relative"
                  >
                    {/* Phase Header */}
                    <div className={cn(
                      "flex items-center gap-2 mb-3 py-2 px-3 rounded-lg",
                      currentPhase === phase.phaseName 
                        ? "bg-primary/10 border border-primary/20" 
                        : "bg-secondary/50"
                    )}>
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                        currentPhase === phase.phaseName
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {phaseIndex + 1}
                      </div>
                      <span className="font-semibold text-sm">{phase.phaseName}</span>
                      {currentPhase === phase.phaseName && (
                        <Badge className="ml-auto text-[10px]" variant="default">
                          Current
                        </Badge>
                      )}
                    </div>

                    {/* Milestones in Phase */}
                    <div className="ml-3 border-l-2 border-border pl-4 space-y-3">
                      {phase.milestones.map((milestone, mIndex) => {
                        const status = getMilestoneStatus(milestone);
                        const daysUntil = getDaysUntilMilestone(milestone);

                        return (
                          <motion.div
                            key={milestone.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: phaseIndex * 0.1 + mIndex * 0.05 }}
                            data-vaul-no-drag
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => handleMilestoneToggle(milestone)}
                            style={{ 
                              touchAction: 'manipulation',
                              WebkitTapHighlightColor: 'transparent',
                              userSelect: 'none'
                            }}
                            className={cn(
                              "relative flex items-start gap-3 p-3 rounded-lg transition-all cursor-pointer",
                              status === "completed" && "bg-green-500/5",
                              status === "overdue" && "bg-destructive/5",
                              status === "pending" && "bg-background hover:bg-secondary/30",
                              isCompleting && "opacity-50 pointer-events-none"
                            )}
                          >
                            {/* Timeline dot */}
                            <div className="absolute -left-[21px] top-4 w-2.5 h-2.5 rounded-full border-2 border-background"
                              style={{
                                backgroundColor: status === "completed" 
                                  ? "hsl(var(--primary))" 
                                  : status === "overdue"
                                    ? "hsl(var(--destructive))"
                                    : "hsl(var(--muted-foreground))"
                              }}
                            />

                            {/* Checkbox */}
                            <Checkbox
                              checked={!!milestone.completed_at}
                              onCheckedChange={() => handleMilestoneToggle(milestone)}
                              disabled={isCompleting}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-0.5"
                            />

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "font-medium text-sm",
                                  status === "completed" && "line-through text-muted-foreground"
                                )}>
                                  {milestone.title}
                                </span>
                                {milestone.is_postcard_milestone && (
                                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                )}
                              </div>

                              {milestone.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                  {milestone.description}
                                </p>
                              )}

                              {/* Date and Status */}
                              <div className="flex items-center gap-2 mt-1.5">
                                {milestone.target_date && (
                                  <div className={cn(
                                    "flex items-center gap-1 text-[10px]",
                                    status === "overdue" && "text-destructive"
                                  )}>
                                    <Calendar className="w-3 h-3" />
                                    {format(new Date(milestone.target_date), "MMM d")}
                                    {daysUntil !== null && status === "pending" && (
                                      <span className="text-muted-foreground">
                                        ({daysUntil > 0 ? `in ${daysUntil}d` : "today"})
                                      </span>
                                    )}
                                  </div>
                                )}

                                {status === "completed" && (
                                  <Badge variant="outline" className="text-[10px] text-green-600 border-green-200">
                                    <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                                    Done
                                  </Badge>
                                )}

                                {status === "overdue" && (
                                  <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
                                    <AlertCircle className="w-2.5 h-2.5 mr-0.5" />
                                    Overdue
                                  </Badge>
                                )}

                                {milestone.is_postcard_milestone && !milestone.completed_at && (
                                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200">
                                    <Star className="w-2.5 h-2.5 mr-0.5" />
                                    Celebration
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
    </>
  );
};
