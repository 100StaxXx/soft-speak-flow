import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trophy, Flame, Target, Calendar, Zap, Share2, Check, X, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { ConstellationTrail } from "./ConstellationTrail";
import { EpicCheckInDrawer } from "./EpicCheckInDrawer";
import { MilestoneProgress } from "./MilestoneProgress";
import { PhaseProgressCard } from "./journey/PhaseProgressCard";
import { MilestonePostcardPreview } from "./journey/MilestonePostcardPreview";
import { cn } from "@/lib/utils";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionHealth } from "@/hooks/useCompanionHealth";
import { useMilestones } from "@/hooks/useMilestones";

type JourneyTheme = 'heroic' | 'warrior' | 'mystic' | 'nature' | 'solar';

const themeGradients: Record<JourneyTheme, string> = {
  heroic: "from-epic-heroic/20 to-purple-500/20",
  warrior: "from-epic-warrior/20 to-orange-500/20",
  mystic: "from-epic-mystic/20 to-blue-500/20",
  nature: "from-epic-nature/20 to-emerald-500/20",
  solar: "from-epic-solar/20 to-amber-500/20"
};

const themeBorders: Record<JourneyTheme, string> = {
  heroic: "border-epic-heroic/20 hover:border-epic-heroic/40",
  warrior: "border-epic-warrior/20 hover:border-epic-warrior/40",
  mystic: "border-epic-mystic/20 hover:border-epic-mystic/40",
  nature: "border-epic-nature/20 hover:border-epic-nature/40",
  solar: "border-epic-solar/20 hover:border-epic-solar/40"
};

interface Journey {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  target_days: number;
  start_date: string;
  end_date: string;
  status: string;
  xp_reward: number;
  progress_percentage: number;
  is_public?: boolean;
  invite_code?: string;
  theme_color?: string;
  story_seed?: unknown;
  story_type_slug?: string | null;
  book_title?: string | null;
  total_chapters?: number | null;
  epic_habits?: Array<{
    habit_id: string;
    habits: {
      id: string;
      title: string;
      difficulty: string;
      description?: string;
      frequency?: string;
      estimated_minutes?: number;
    };
  }>;
}

interface JourneyCardProps {
  journey: Journey;
  onComplete?: () => void;
  onAbandon?: () => void;
}

export const JourneyCard = ({ journey, onComplete, onAbandon }: JourneyCardProps) => {
  const [copied, setCopied] = useState(false);
  const [showAbandonDialog, setShowAbandonDialog] = useState(false);
  const [milestoneExpanded, setMilestoneExpanded] = useState(false);
  
  const { companion } = useCompanion();
  const { health } = useCompanionHealth();
  const { 
    milestonesByPhase, 
    getCurrentPhase, 
    getProgressToNextPostcard,
    getJourneyHealth,
  } = useMilestones(journey.id);
  
  const daysRemaining = Math.ceil(
    (new Date(journey.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );
  const isCompleted = journey.status === "completed";
  const isActive = journey.status === "active";
  const theme = (journey.theme_color || 'heroic') as JourneyTheme;
  const themeGradient = themeGradients[theme];
  const themeBorder = themeBorders[theme];
  
  const currentPhase = getCurrentPhase();
  const postcardProgress = getProgressToNextPostcard();
  const journeyHealth = getJourneyHealth(journey.start_date, journey.end_date);

  // Get milestones for the trail
  const { milestones } = useMilestones(journey.id);
  
  const trailMilestones = useMemo(() => {
    if (!milestones || milestones.length === 0) return undefined;
    return milestones.map(m => ({
      id: m.id,
      title: m.title,
      milestone_percent: m.milestone_percent,
      is_postcard_milestone: m.is_postcard_milestone,
      completed_at: m.completed_at,
      description: m.description,
      phase_name: m.phase_name,
      target_date: m.target_date,
      chapter_number: m.chapter_number,
    }));
  }, [milestones]);

  const handleShareJourney = async () => {
    if (!journey.invite_code) return;
    
    try {
      await navigator.clipboard.writeText(journey.invite_code);
      setCopied(true);
      toast.success("Invite code copied!", {
        description: "Share this code with others to invite them to your journey",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy code");
    }
  };

  // Count valid rituals (habits linked to journey)
  const ritualCount = journey.epic_habits?.filter(eh => eh.habits)?.length || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn(
        "p-5 bg-gradient-to-br border-2 transition-all",
        `from-background to-secondary/20 ${themeBorder}`,
        `bg-gradient-to-br ${themeGradient}`
      )}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {isCompleted ? (
                <Trophy className="w-5 h-5 text-yellow-400" />
              ) : (
                <Target className="w-5 h-5 text-primary" />
              )}
              <h3 className="text-lg font-bold">{journey.title}</h3>
              {journey.invite_code && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-primary hover:text-primary hover:bg-primary/10"
                  onClick={handleShareJourney}
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Share2 className="w-3.5 h-3.5" />
                  )}
                </Button>
              )}
            </div>
            {journey.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {journey.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 ml-2">
            <Badge variant={isCompleted ? "default" : "secondary"} className="text-xs">
              {isCompleted ? "Legendary" : isActive ? "Active" : "Abandoned"}
            </Badge>
            {isActive && onAbandon && (
              <button
                onClick={() => setShowAbandonDialog(true)}
                className="h-5 w-5 rounded-full hover:bg-destructive/10 flex items-center justify-center text-muted-foreground/40 hover:text-destructive transition-colors"
                title="Abandon journey"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Constellation Trail Progress */}
        <ConstellationTrail 
          progress={journey.progress_percentage} 
          targetDays={journey.target_days}
          className="mb-3"
          companionImageUrl={health?.imageUrl || companion?.current_image_url}
          companionMood={health?.moodState}
          showCompanion={true}
          milestones={trailMilestones}
        />

        {/* Phase Progress (compact) */}
        {milestonesByPhase.length > 0 && isActive && (
          <PhaseProgressCard
            milestonesByPhase={milestonesByPhase}
            currentPhaseName={currentPhase}
            compact
            className="mb-3"
          />
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="flex items-center gap-1.5 bg-background/50 rounded-lg p-2">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            <div>
              <div className="text-[10px] text-muted-foreground">Duration</div>
              <div className="text-xs font-bold">{journey.target_days}d</div>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 bg-background/50 rounded-lg p-2">
            <Flame className="w-3.5 h-3.5 text-orange-500" />
            <div>
              <div className="text-[10px] text-muted-foreground">Left</div>
              <div className="text-xs font-bold">
                {isCompleted ? "Done!" : `${daysRemaining}d`}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 bg-background/50 rounded-lg p-2">
            {journeyHealth ? (
              <>
                <div className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                  journeyHealth.score === 'A' && "bg-green-500/20 text-green-500",
                  journeyHealth.score === 'B' && "bg-celestial-blue/20 text-celestial-blue",
                  journeyHealth.score === 'C' && "bg-amber-500/20 text-amber-500",
                  journeyHealth.score === 'D' && "bg-orange-500/20 text-orange-500",
                  journeyHealth.score === 'F' && "bg-red-500/20 text-red-500",
                )}>
                  {journeyHealth.score}
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Health</div>
                  <div className="text-xs font-bold">
                    {journeyHealth.progressDelta > 0 ? '+' : ''}{Math.round(journeyHealth.progressDelta)}%
                  </div>
                </div>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 text-stardust-gold" />
                <div>
                  <div className="text-[10px] text-muted-foreground">XP</div>
                  <div className="text-xs font-bold text-stardust-gold">{journey.xp_reward}</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Next Postcard Preview - Always visible for active campaigns */}
        {postcardProgress && isActive && (
          <MilestonePostcardPreview
            currentProgress={postcardProgress.current}
            targetPercent={postcardProgress.target}
            milestoneTitle={postcardProgress.milestone.title}
            chapterNumber={postcardProgress.milestone.chapter_number || 1}
            compact={!milestoneExpanded}
            isExpanded={milestoneExpanded}
            onClick={() => setMilestoneExpanded(!milestoneExpanded)}
            className="mb-3"
            storySeed={journey.story_seed as import('@/types/narrativeTypes').StorySeed | null}
            totalChapters={journey.total_chapters}
            companionSpecies={companion?.spirit_animal}
          />
        )}

        {/* Milestone Progress Section */}
        <div className="mb-3">
          <MilestoneProgress 
            epicId={journey.id} 
            epicTitle={journey.title}
            epicGoal={journey.description}
            currentDeadline={journey.end_date}
            compact 
          />
        </div>

        {/* Check In Button & Rituals */}
        {journey.epic_habits && ritualCount > 0 && (
          <div className="mb-3">
            <EpicCheckInDrawer
              epicId={journey.id}
              habits={journey.epic_habits
                .filter(eh => eh.habits)
                .map(eh => ({
                  id: eh.habit_id,
                  title: eh.habits.title,
                  difficulty: eh.habits.difficulty || 'medium',
                  description: eh.habits.description,
                  frequency: eh.habits.frequency,
                  estimated_minutes: eh.habits.estimated_minutes,
                }))}
              isActive={isActive}
            />
            
            {/* Linked Rituals as badges */}
            <div className="mt-2">
              <div className="text-[10px] font-medium text-muted-foreground mb-1.5">
                Rituals ({ritualCount})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {journey.epic_habits
                  .filter(eh => eh.habits)
                  .slice(0, 4)
                  .map((eh) => (
                    <Badge key={eh.habit_id} variant="outline" className="text-[10px] px-1.5 py-0">
                      {eh.habits.title}
                    </Badge>
                  ))}
                {ritualCount > 4 && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    +{ritualCount - 4}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Complete Button (only at 100%) */}
        {isActive && journey.progress_percentage >= 100 && onComplete && (
          <Button
            onClick={onComplete}
            className="w-full bg-gradient-to-r from-stardust-gold to-amber-500 hover:from-stardust-gold/90 hover:to-amber-500/90 text-black font-bold"
          >
            <Trophy className="w-4 h-4 mr-2" />
            Complete Journey
          </Button>
        )}

        {/* Abandon Dialog */}
        <AlertDialog open={showAbandonDialog} onOpenChange={setShowAbandonDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Abandon this journey?</AlertDialogTitle>
              <AlertDialogDescription>
                You'll lose progress on "{journey.title}". This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Going</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setShowAbandonDialog(false);
                  onAbandon?.();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Abandon
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    </motion.div>
  );
};
