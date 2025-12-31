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
import { Trophy, Flame, Target, Calendar, Zap, Share2, Check, X } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { ConstellationTrail } from "./ConstellationTrail";
import { EpicCheckInDrawer } from "./EpicCheckInDrawer";
import { PhaseProgressCard } from "./journey/PhaseProgressCard";
import { MilestonePostcardPreview } from "./journey/MilestonePostcardPreview";
import { MilestoneProgress } from "./MilestoneProgress";
import { cn } from "@/lib/utils";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionHealth } from "@/hooks/useCompanionHealth";
import { useMilestones } from "@/hooks/useMilestones";

type JourneyTheme = 'heroic' | 'warrior' | 'mystic' | 'nature' | 'solar';

const themeGradients: Record<JourneyTheme, string> = {
  heroic: "from-epic-heroic/15 to-purple-500/15",
  warrior: "from-epic-warrior/15 to-orange-500/15",
  mystic: "from-epic-mystic/15 to-blue-500/15",
  nature: "from-epic-nature/15 to-emerald-500/15",
  solar: "from-epic-solar/15 to-amber-500/15"
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
      custom_days?: number[] | null;
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
  
  const { companion } = useCompanion();
  const { health } = useCompanionHealth();
  
  const daysRemaining = Math.ceil(
    (new Date(journey.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );
  const isCompleted = journey.status === "completed";
  const isActive = journey.status === "active";
  const theme = (journey.theme_color || 'heroic') as JourneyTheme;
  const themeGradient = themeGradients[theme];
  const themeBorder = themeBorders[theme];

  // Get milestones for the trail
  const { milestones, milestonesByPhase, getCurrentPhase, nextMilestone } = useMilestones(journey.id);
  
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
        "p-5 bg-gradient-to-br border-2 transition-all bg-background/50",
        `${themeBorder}`,
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

        {/* Phase Progress */}
        {milestonesByPhase && milestonesByPhase.length > 0 && (
          <PhaseProgressCard
            milestonesByPhase={milestonesByPhase}
            currentPhaseName={getCurrentPhase()}
            className="mb-3"
            compact
          />
        )}

        {/* Compact Stats Bar */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 px-1">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {journey.target_days}d
          </span>
          <span className="text-muted-foreground/30">•</span>
          <span className="flex items-center gap-1">
            <Flame className="w-3 h-3 text-orange-500" />
            {isCompleted ? "Done!" : `${daysRemaining}d left`}
          </span>
          <span className="text-muted-foreground/30">•</span>
          <span className="flex items-center gap-1 text-stardust-gold">
            <Zap className="w-3 h-3" />
            {journey.xp_reward} XP
          </span>
        </div>

        {/* Milestone Postcard Preview */}
        {nextMilestone && (
          <MilestonePostcardPreview
            currentProgress={journey.progress_percentage}
            targetPercent={nextMilestone.milestone_percent}
            milestoneTitle={nextMilestone.title}
            chapterNumber={nextMilestone.chapter_number || 1}
            storySeed={journey.story_seed as any}
            companionSpecies={companion?.spirit_animal}
            compact
          />
        )}

        {/* Milestone Progress */}
        <MilestoneProgress
          epicId={journey.id}
          epicTitle={journey.title}
          epicGoal={journey.description}
          currentDeadline={journey.end_date}
          compact
        />

        {/* View Rituals Button */}
        {journey.epic_habits && ritualCount > 0 && (
          <div className="mb-3">
            <EpicCheckInDrawer
              epicId={journey.id}
              habits={journey.epic_habits
                .filter(eh => eh.habits)
                .map(eh => ({
                  id: eh.habit_id,
                  title: eh.habits?.title || 'Untitled',
                  difficulty: eh.habits?.difficulty || 'medium',
                  description: eh.habits?.description,
                  frequency: eh.habits?.frequency,
                  estimated_minutes: eh.habits?.estimated_minutes,
                  custom_days: eh.habits?.custom_days,
                }))}
              isActive={isActive}
              showAdjustPlan={isActive}
            />
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
