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
import { Trophy, Flame, Target, Calendar, Zap, Share2, Check, X, Swords } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ConstellationTrail } from "./ConstellationTrail";
import { EpicCheckInDrawer } from "./EpicCheckInDrawer";
// HIDDEN: Boss battle feature disabled
// import { AstralEncounterModal } from "./astral-encounters/AstralEncounterModal";
import { EpicRewardReveal } from "./EpicRewardReveal";
import { AdjustEpicPlanDialog } from "./AdjustEpicPlanDialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionHealth } from "@/hooks/useCompanionHealth";
import { useCompanionPostcards } from "@/hooks/useCompanionPostcards";
import { useMilestones } from "@/hooks/useMilestones";

import { useEpicRewards } from "@/hooks/useEpicRewards";
// HIDDEN: Boss battle feature disabled
// import { generateAdversary } from "@/utils/adversaryGenerator";
// import type { StorySeed, BossBattleContext } from "@/types/narrativeTypes";
// import type { Adversary, AstralEncounter } from "@/types/astralEncounters";
import type { RewardRevealData } from "@/types/epicRewards";
import { STORY_TYPE_BADGES } from "@/types/epicRewards";

type EpicTheme = 'heroic' | 'warrior' | 'mystic' | 'nature' | 'solar';

const themeGradients: Record<EpicTheme, string> = {
  heroic: "from-epic-heroic/20 to-purple-500/20",
  warrior: "from-epic-warrior/20 to-orange-500/20",
  mystic: "from-epic-mystic/20 to-blue-500/20",
  nature: "from-epic-nature/20 to-emerald-500/20",
  solar: "from-epic-solar/20 to-amber-500/20"
};

const themeBorders: Record<EpicTheme, string> = {
  heroic: "border-epic-heroic/20 hover:border-epic-heroic/40",
  warrior: "border-epic-warrior/20 hover:border-epic-warrior/40",
  mystic: "border-epic-mystic/20 hover:border-epic-mystic/40",
  nature: "border-epic-nature/20 hover:border-epic-nature/40",
  solar: "border-epic-solar/20 hover:border-epic-solar/40"
};

interface Epic {
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

interface EpicCardProps {
  epic: Epic;
  onComplete?: () => void;
  onAbandon?: () => void;
}

export const EpicCard = ({ epic, onComplete, onAbandon }: EpicCardProps) => {
  const [copied, setCopied] = useState(false);
  const [showAbandonDialog, setShowAbandonDialog] = useState(false);
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  // HIDDEN: Boss battle feature disabled
  // const [showBossBattle, setShowBossBattle] = useState(false);
  const [showRewardReveal, setShowRewardReveal] = useState(false);
  const [rewardRevealData, setRewardRevealData] = useState<RewardRevealData | null>(null);
  // HIDDEN: Boss battle state disabled
  // const [bossEncounter, setBossEncounter] = useState<AstralEncounter | null>(null);
  // const [bossAdversary, setBossAdversary] = useState<Adversary | null>(null);
  // const [bossBattleContext, setBossBattleContext] = useState<BossBattleContext | null>(null);
  
  const { companion } = useCompanion();
  const { health } = useCompanionHealth();
  const { checkAndGeneratePostcard } = useCompanionPostcards();
  const { milestones } = useMilestones(epic.id);
  const { generateRewardReveal } = useEpicRewards();
  
  const trailMilestones = useMemo(() => {
    if (!milestones || milestones.length === 0) return undefined;
    return milestones.map(m => ({
      id: m.id,
      title: m.title,
      milestone_percent: m.milestone_percent,
      is_postcard_milestone: m.is_postcard_milestone,
      completed_at: m.completed_at,
    }));
  }, [milestones]);
  
  // Initialize to -1 on first render to catch any milestones that may have been
  // crossed before this component mounted. Server handles duplicate prevention.
  const previousProgressRef = useRef<number>(-1);
  const hasInitializedRef = useRef<boolean>(false);
  const encounterCheckRef = useRef<number>(-1);
  
  const daysRemaining = Math.ceil(
    (new Date(epic.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );
  const isCompleted = epic.status === "completed";
  const isActive = epic.status === "active";
  const theme = (epic.theme_color || 'heroic') as EpicTheme;
  const themeGradient = themeGradients[theme];
  const themeBorder = themeBorders[theme];

  // HIDDEN: Boss battle feature disabled
  // buildBossBattleContext, triggerBossBattle, handleBossBattleComplete, handleBossBattleCancel
  // All boss battle logic has been commented out to hide the Astral Encounters feature

  // Check for milestone crossings and trigger postcard generation
  useEffect(() => {
    if (!companion?.id || !isActive) return;
    
    const currentProgress = epic.progress_percentage;
    const previousProgress = previousProgressRef.current;
    
    // On first render, set the baseline for future comparisons
    // This allows catching milestones crossed during initial load
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      // Check from 0 to current progress on first load to catch any missed milestones
      // The server-side duplicate check will prevent regenerating existing postcards
      if (currentProgress > 0) {
        checkAndGeneratePostcard(
          epic.id,
          currentProgress,
          0, // Start from 0 on first render
          companion.id,
          {
            spirit_animal: companion.spirit_animal,
            favorite_color: companion.favorite_color,
            core_element: companion.core_element,
            eye_color: companion.eye_color,
            fur_color: companion.fur_color,
          }
        );
      }
      previousProgressRef.current = currentProgress;
      return;
    }
    
    // Only check if progress increased on subsequent renders
    if (currentProgress > previousProgress) {
      checkAndGeneratePostcard(
        epic.id,
        currentProgress,
        previousProgress,
        companion.id,
        {
          spirit_animal: companion.spirit_animal,
          favorite_color: companion.favorite_color,
          core_element: companion.core_element,
          eye_color: companion.eye_color,
          fur_color: companion.fur_color,
        }
      );
    }
    
    // Update ref for next comparison
    previousProgressRef.current = currentProgress;
    
    // Dispatch event for Astral Encounter trigger on epic milestone crossings
    // Only dispatch if progress INCREASED from a valid previous value (not initial -1)
    if (encounterCheckRef.current >= 0 && currentProgress > encounterCheckRef.current) {
      window.dispatchEvent(
        new CustomEvent('epic-progress-checkpoint', {
          detail: {
            epicId: epic.id,
            previousProgress: encounterCheckRef.current,
            currentProgress,
          },
        })
      );
    }
    // Always update the ref to track current progress
    encounterCheckRef.current = currentProgress;
  }, [epic.progress_percentage, epic.id, companion, isActive, checkAndGeneratePostcard]);

  const handleShareEpic = async () => {
    if (!epic.invite_code) return;
    
    try {
      await navigator.clipboard.writeText(epic.invite_code);
      setCopied(true);
      toast.success("Invite code copied!", {
        description: "Share this code with others to invite them to your guild",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy code");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn(
        "p-6 bg-gradient-to-br border-2 transition-all",
        `from-background to-secondary/20 ${themeBorder}`,
        `bg-gradient-to-br ${themeGradient}`
      )}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {isCompleted ? (
                <Trophy className="w-6 h-6 text-stardust-gold drop-shadow-[0_0_8px_hsl(45,100%,65%)]" />
              ) : (
                <Target className="w-6 h-6 text-celestial-blue" />
              )}
              <h3 className="text-xl font-bold">{epic.title}</h3>
              {epic.invite_code && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-primary hover:text-primary hover:bg-primary/10"
                  onClick={handleShareEpic}
                >
                  {copied ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Share2 className="w-4 h-4" />
                  )}
                </Button>
              )}
            </div>
            {epic.description && (
              <p className="text-sm text-muted-foreground mb-3">
                {epic.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 ml-2">
            <Badge
              variant={isCompleted ? "gold" : isActive ? "celestial" : "secondary"}
            >
              {isCompleted ? "Legendary" : isActive ? "Active" : "Abandoned"}
            </Badge>
            {isActive && (
              <button
                onClick={() => setShowAbandonDialog(true)}
                className="h-11 w-11 -m-3 rounded-full hover:bg-destructive/10 flex items-center justify-center text-muted-foreground/40 hover:text-destructive transition-colors touch-manipulation"
                title="Abandon epic"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Constellation Trail Progress */}
        <ConstellationTrail 
          progress={epic.progress_percentage} 
          targetDays={epic.target_days}
          className="mb-3"
          companionImageUrl={health?.imageUrl || companion?.current_image_url}
          companionMood={health?.moodState}
          showCompanion={true}
          milestones={trailMilestones}
        />

        {/* Compact Stats Bar */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mb-3 py-2 px-3 bg-background/30 rounded-lg">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {epic.target_days}d
          </span>
          <span className="text-muted-foreground/30">•</span>
          <span className="flex items-center gap-1">
            <Flame className="w-3 h-3 text-orange-500" />
            {isCompleted ? "Done" : `${daysRemaining}d left`}
          </span>
          <span className="text-muted-foreground/30">•</span>
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-yellow-500" />
            {epic.xp_reward} XP
          </span>
        </div>

        {/* Rituals Button */}
        {epic.epic_habits && epic.epic_habits.length > 0 && (
          <EpicCheckInDrawer
            epicId={epic.id}
            habits={epic.epic_habits
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
            onAdjustPlan={() => setShowAdjustDialog(true)}
            showAdjustPlan={isActive && epic.progress_percentage < 100}
          />
        )}

        {/* Action Buttons */}
        {isActive && epic.progress_percentage >= 100 && (
          <div className="mt-4 space-y-2">
            {/* HIDDEN: Boss battle button disabled
            {epic.story_seed && (
              <Button
                onClick={triggerBossBattle}
                className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700"
              >
                <Swords className="w-4 h-4 mr-2" />
                Face Final Boss
              </Button>
            )}
            */}
            <Button
              onClick={onComplete}
              className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
            >
              <Trophy className="w-4 h-4 mr-2" />
              Complete Epic
            </Button>
          </div>
        )}
      </Card>

      {/* HIDDEN: Boss Battle Modal disabled
      <AstralEncounterModal
        open={showBossBattle}
        onOpenChange={setShowBossBattle}
        encounter={bossEncounter}
        adversary={bossAdversary}
        onComplete={handleBossBattleComplete}
        isBossBattle={true}
        bossBattleContext={bossBattleContext || undefined}
        onBossBattleCancel={handleBossBattleCancel}
      />
      */}

      <AlertDialog open={showAbandonDialog} onOpenChange={setShowAbandonDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Abandon this epic?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to abandon "{epic.title}"? Your progress will be lost and you won't earn the XP reward.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onAbandon}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Abandon Epic
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reward Reveal Modal */}
      <EpicRewardReveal
        open={showRewardReveal}
        onOpenChange={setShowRewardReveal}
        rewardData={rewardRevealData}
        onClaim={() => {
          toast.success('Boss Defeated!', {
            description: 'Rewards claimed! Check your collection.',
          });
        }}
      />

      {/* Adjust Epic Plan Dialog */}
      <AdjustEpicPlanDialog
        open={showAdjustDialog}
        onOpenChange={setShowAdjustDialog}
        epicId={epic.id}
        epicTitle={epic.title}
      />
    </motion.div>
  );
};
