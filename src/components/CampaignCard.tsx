import { memo, useState, useMemo, useCallback, useEffect, useRef, type CSSProperties } from "react";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trophy, Flame, Target, Calendar, Zap, Share2, Check, X, Flag, Star, Pencil, Loader2 } from "lucide-react";
import type { StorySeed } from "@/types/narrativeTypes";
import { motion } from "framer-motion";
import { toast } from "@/components/ui/sonner";
import { ConstellationTrail } from "./ConstellationTrail";
import { EpicCheckInDrawer } from "./EpicCheckInDrawer";
import { SmartAdjustPlanDrawer } from "./SmartAdjustPlanDrawer";
import { JourneyDetailDrawer } from "./JourneyDetailDrawer";
import { MilestonePostcardPreview } from "./journey/MilestonePostcardPreview";
import { cn } from "@/lib/utils";
import {
  COMPANION_FROSTED_PLANNER_DARK_CLASS,
  COMPANION_FROSTED_THEME_SCOPE_CLASS,
  getCompanionFrostedThemeStyle,
} from "@/lib/companionFrostedTheme";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionHealth } from "@/hooks/useCompanionHealth";
import { useMilestones } from "@/hooks/useMilestones";
import { useSharedCampaignPathMarkers } from "@/hooks/useSharedCampaignPathMarkers";
import { plannerPathfinderTheme } from "@/components/companion/plannerPathfinderTheme";
import { getEpicDaysRemaining, resolveEpicEndDate } from "@/utils/epicDates";
import { safeClipboardWrite, getClipboardErrorMessage } from "@/utils/clipboard";
import { buildEpicInviteLink, buildEpicInviteShareText } from "@/utils/epicInviteShare";
import { getStoredCompanionCustomName } from "@/lib/companionName";

const CAMPAIGN_SHARE_CANCEL_PATTERNS = ["abort", "cancel", "canceled", "cancelled", "dismiss"];

const isCampaignShareCancelled = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && error.name === "AbortError") return true;

  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === "string"
        ? error
        : String(error);

  const normalized = message.toLowerCase();
  return CAMPAIGN_SHARE_CANCEL_PATTERNS.some((pattern) => normalized.includes(pattern));
};

interface Campaign {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  target_days: number;
  start_date: string;
  end_date: string | null;
  status: string;
  xp_reward?: number | null;
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
      custom_month_days?: number[] | null;
    };
  }>;
}

interface CampaignCardProps {
  campaign: Campaign;
  onRename?: (nextTitle: string) => Promise<void> | void;
  onComplete?: () => void;
  onAbandon?: () => void;
  companionFrostedThemeStyle?: CSSProperties;
}

export const CampaignCard = memo(function CampaignCard({
  campaign,
  onRename,
  onComplete,
  onAbandon,
  companionFrostedThemeStyle,
}: CampaignCardProps) {
  const [copied, setCopied] = useState(false);
  const [showAbandonDialog, setShowAbandonDialog] = useState(false);
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameTitle, setRenameTitle] = useState(campaign.title);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isSharingCampaign, setIsSharingCampaign] = useState(false);
  const shareCampaignInFlightRef = useRef(false);
  
  const { companion } = useCompanion();
  const { health } = useCompanionHealth();
  const resolvedCompanionFrostedThemeStyle = useMemo(
    () => companionFrostedThemeStyle ?? getCompanionFrostedThemeStyle(companion?.favorite_color),
    [companionFrostedThemeStyle, companion?.favorite_color],
  );
  const { 
    milestones,
    isLoading: milestonesLoading,
    getProgressToNextPostcard,
    getJourneyHealth,
    backfillLegacyMilestones,
    isBackfilling,
  } = useMilestones(campaign.id);
  const { markers: sharedPathMarkers } = useSharedCampaignPathMarkers(campaign.id);
  
  const resolvedEndDate = useMemo(() => resolveEpicEndDate(campaign), [campaign]);
  const daysRemaining = useMemo(
    () => getEpicDaysRemaining({
      start_date: campaign.start_date,
      target_days: campaign.target_days,
      end_date: resolvedEndDate,
    }),
    [resolvedEndDate, campaign.start_date, campaign.target_days],
  );
  const isCompleted = campaign.status === "completed";
  const isActive = campaign.status === "active";
  
  // Track if we've attempted backfill to prevent duplicate calls
  const backfillAttempted = useRef(false);
  
  // Auto-backfill milestones for legacy epics
  useEffect(() => {
    if (
      isActive && 
      campaign.story_type_slug && 
      milestones?.length === 0 && 
      !milestonesLoading &&
      !isBackfilling &&
      !backfillAttempted.current
    ) {
      backfillAttempted.current = true;
      backfillLegacyMilestones.mutate({
        epicId: campaign.id,
        targetDays: campaign.target_days,
        startDate: campaign.start_date,
      });
    }
  }, [campaign.id, campaign.story_type_slug, campaign.target_days, campaign.start_date, milestones?.length, isActive, milestonesLoading, isBackfilling, backfillLegacyMilestones]);
  
  const postcardProgress = getProgressToNextPostcard();
  const campaignHealth = getJourneyHealth(campaign.start_date, resolvedEndDate ?? undefined);
  const companionDisplayName = useMemo(() => {
    const customName = getStoredCompanionCustomName(companion);
    if (customName) return customName;
    if ((companion?.current_stage ?? 0) <= 0) return undefined;
    const rawName = companion?.cached_creature_name;
    if (typeof rawName !== "string") return undefined;
    const trimmed = rawName.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, [companion]);
  
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
  const trailCompanionMarkers = useMemo(
    () => sharedPathMarkers.length > 0 ? sharedPathMarkers : undefined,
    [sharedPathMarkers],
  );

  const handleShareCampaign = useCallback(async () => {
    if (!campaign.invite_code || !campaign.is_public) return;
    if (shareCampaignInFlightRef.current) return;

    const inviteLink = buildEpicInviteLink(campaign.invite_code);
    const shareText = buildEpicInviteShareText(campaign.title, campaign.invite_code);
    const shareTitle = `Join ${campaign.title}`;
    const clipboardText = `${shareText}\n\n${inviteLink}`;
    let sharedViaSheet = false;

    shareCampaignInFlightRef.current = true;
    setIsSharingCampaign(true);
    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: shareTitle,
          text: shareText,
          url: inviteLink,
          dialogTitle: "Share campaign invite",
        });
        sharedViaSheet = true;
      } else if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: inviteLink,
        });
        sharedViaSheet = true;
      } else {
        const didCopy = await safeClipboardWrite(clipboardText);
        if (!didCopy) {
          throw new Error("Clipboard unavailable");
        }
      }

      setCopied(true);
      toast.success(sharedViaSheet ? "Invite ready to share!" : "Invite link copied!", {
        description: "Friends can open the link directly or use the invite code to join.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      if (isCampaignShareCancelled(error)) {
        return;
      }

      const didCopy = await safeClipboardWrite(clipboardText);
      if (didCopy) {
        setCopied(true);
        toast.info("Couldn't share, but invite link was copied!", {
          description: "Friends can open the link directly or use the invite code to join.",
        });
        setTimeout(() => setCopied(false), 2000);
        return;
      }

      toast.error(
        Capacitor.isNativePlatform()
          ? "Failed to share invite. Please try again."
          : getClipboardErrorMessage(error),
      );
    } finally {
      shareCampaignInFlightRef.current = false;
      setIsSharingCampaign(false);
    }
  }, [campaign.invite_code, campaign.is_public, campaign.title]);

  const openRenameDialog = useCallback(() => {
    setRenameTitle(campaign.title);
    setShowRenameDialog(true);
  }, [campaign.title]);

  const handleRenameSubmit = useCallback(async () => {
    if (!onRename) return;

    const trimmedTitle = renameTitle.trim();
    if (!trimmedTitle || trimmedTitle === campaign.title) return;

    setIsRenaming(true);
    try {
      await onRename(trimmedTitle);
      setShowRenameDialog(false);
    } catch {
      // The mutation hook surfaces the error toast.
    } finally {
      setIsRenaming(false);
    }
  }, [campaign.title, onRename, renameTitle]);

  // Count valid rituals linked to this campaign
  const ritualCount = campaign.epic_habits?.filter(eh => eh.habits)?.length || 0;
  const trimmedRenameTitle = renameTitle.trim();
  const isRenameSaveDisabled = isRenaming || trimmedRenameTitle.length === 0 || trimmedRenameTitle === campaign.title;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        data-testid="campaign-card-shell"
        className={cn(
          COMPANION_FROSTED_THEME_SCOPE_CLASS,
          "bg-card/30 backdrop-blur-sm border border-border/30 rounded-2xl p-4",
        )}
        style={resolvedCompanionFrostedThemeStyle}
      >
        <div className="space-y-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {isCompleted ? (
                  <Trophy className="w-5 h-5 text-yellow-400" />
                ) : (
                  <Target className="w-5 h-5 text-primary" />
                )}
                <h3 className="text-lg font-bold">{campaign.title}</h3>
                {campaign.invite_code && campaign.is_public && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-primary hover:text-primary hover:bg-primary/10"
                    onClick={handleShareCampaign}
                    disabled={isSharingCampaign}
                    aria-label="Share campaign invite"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Share2 className="w-3.5 h-3.5" />
                    )}
                  </Button>
                )}
              </div>
              {campaign.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {campaign.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 ml-2">
              <Badge variant={isCompleted ? "default" : "secondary"} className="text-xs">
                {isCompleted ? "Legendary" : isActive ? "Active" : "Abandoned"}
              </Badge>
              {isActive && onRename && (
                <button
                  type="button"
                  onClick={openRenameDialog}
                  className="h-5 w-5 rounded-full hover:bg-primary/10 flex items-center justify-center text-muted-foreground/50 hover:text-primary transition-colors"
                  title="Rename campaign"
                  aria-label="Rename campaign"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
              {isActive && onAbandon && (
                <button
                  type="button"
                  onClick={() => setShowAbandonDialog(true)}
                  className="h-5 w-5 rounded-full hover:bg-destructive/10 flex items-center justify-center text-muted-foreground/40 hover:text-destructive transition-colors"
                  title="Abandon campaign"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Constellation Trail Progress */}
          <ConstellationTrail 
            progress={campaign.progress_percentage} 
            targetDays={campaign.target_days}
            className="mb-3"
            companionImageUrl={health?.imageUrl || companion?.current_image_url}
            companionImageFocalX={health?.imageFocalX ?? companion?.current_image_focal_x ?? null}
            companionImageFocalY={health?.imageFocalY ?? companion?.current_image_focal_y ?? null}
            companionMood={health?.moodState}
            showCompanion={true}
            companionMarkers={trailCompanionMarkers}
            milestones={trailMilestones}
            epicId={campaign.id}
          />


          {/* Compact Stats Bar */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 px-1">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {campaign.target_days}d total
          </span>
          <span className="text-muted-foreground/30">•</span>
          <span className="flex items-center gap-1">
            <Flame className="w-3 h-3 text-orange-500" />
            {isCompleted ? "Done!" : daysRemaining === null ? "Timeline pending" : `${daysRemaining}d left`}
          </span>
          <span className="text-muted-foreground/30">•</span>
          {campaignHealth ? (
            <span className="flex items-center gap-1">
              <span className={cn(
                "text-xs font-bold",
                campaignHealth.score === 'A' && "text-green-500",
                campaignHealth.score === 'B' && "text-celestial-blue",
                campaignHealth.score === 'C' && "text-amber-500",
                campaignHealth.score === 'D' && "text-orange-500",
                campaignHealth.score === 'F' && "text-red-500",
              )}>
                {campaignHealth.score}
              </span>
              <span>({campaignHealth.progressDelta > 0 ? '+' : ''}{Math.round(campaignHealth.progressDelta)}%)</span>
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-stardust-gold" />
              <span className="text-stardust-gold font-medium">{campaign.xp_reward ?? 0} XP</span>
            </span>
          )}
          </div>

          {/* Action Buttons Grid - 2 column layout with fun kid-friendly styling */}
          <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Chapter/Postcard Tile - Expandable */}
          {postcardProgress && isActive && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="col-span-2"
            >
              <MilestonePostcardPreview
                currentProgress={campaign.progress_percentage}
                targetPercent={postcardProgress.target}
                milestoneTitle={postcardProgress.milestone.title}
                chapterNumber={postcardProgress.milestone.chapter_number || 1}
                storySeed={campaign.story_seed as StorySeed | null}
                totalChapters={campaign.total_chapters}
                companionDisplayName={companionDisplayName}
                isExpanded={true}
              />
            </motion.div>
          )}
          
          {/* Milestones Tile - Cool and adventurous */}
          <JourneyDetailDrawer 
            epicId={campaign.id} 
            epicTitle={campaign.title}
            epicGoal={campaign.description}
            currentDeadline={resolvedEndDate ?? undefined}
            companionFrostedThemeStyle={resolvedCompanionFrostedThemeStyle}
          >
            <motion.button 
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl
                bg-gradient-to-br from-sky-400/25 via-blue-400/20 to-indigo-400/25
                border-2 border-celestial-blue/40
                shadow-[0_4px_20px_rgba(56,189,248,0.15)]
                min-h-[88px] font-fredoka"
              whileHover={{ scale: 1.05, rotate: -1 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <motion.div
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
              >
                <Flag className="w-7 h-7 text-celestial-blue drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]" />
              </motion.div>
              <span className="text-sm font-semibold">Milestones</span>
              <span className="text-xs text-sky-300/80">✨ {milestones?.filter(m => m.completed_at).length || 0}/{milestones?.length || 0}</span>
            </motion.button>
          </JourneyDetailDrawer>
          
          {/* Rituals Tile - Magical and special */}
          {campaign.epic_habits && ritualCount > 0 && (
            <EpicCheckInDrawer
              epicId={campaign.id}
              habits={campaign.epic_habits
                .filter(eh => eh.habits)
                .map(eh => ({
                  id: eh.habit_id,
                  title: eh.habits?.title || 'Untitled',
                  difficulty: eh.habits?.difficulty || 'medium',
                  description: eh.habits?.description,
                  frequency: eh.habits?.frequency,
                  estimated_minutes: eh.habits?.estimated_minutes,
                  custom_days: eh.habits?.custom_days,
                  custom_month_days: eh.habits?.custom_month_days,
                }))}
              isActive={isActive}
              showAdjustPlan={isActive}
              onAdjustPlan={() => setShowAdjustDialog(true)}
              companionFrostedThemeStyle={resolvedCompanionFrostedThemeStyle}
              renderTrigger={(todayCount) => (
                <motion.button 
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl
                    bg-gradient-to-br from-purple-400/25 via-pink-400/20 to-fuchsia-400/25
                    border-2 border-primary/40
                    shadow-[0_4px_20px_rgba(168,85,247,0.15)]
                    min-h-[88px] font-fredoka"
                  whileHover={{ scale: 1.05, rotate: 1 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                  >
                    <Star className="w-7 h-7 text-primary drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                  </motion.div>
                  <span className="text-sm font-semibold">Rituals</span>
                  <span className="text-xs text-purple-300/80">🌟 {todayCount} today</span>
                </motion.button>
              )}
            />
          )}
          </div>

          {/* Complete Button (only at 100%) */}
          {isActive && campaign.progress_percentage >= 100 && onComplete && (
            <Button
              onClick={onComplete}
              className="w-full bg-gradient-to-r from-stardust-gold to-amber-500 hover:from-stardust-gold/90 hover:to-amber-500/90 text-black font-bold"
            >
              <Trophy className="w-4 h-4 mr-2" />
              Complete Campaign
            </Button>
          )}

          {/* Abandon Dialog */}
          <AlertDialog open={showAbandonDialog} onOpenChange={setShowAbandonDialog}>
            <AlertDialogContent
              className={cn(COMPANION_FROSTED_PLANNER_DARK_CLASS, plannerPathfinderTheme.portalSurface)}
              data-testid="campaign-abandon-dialog"
              style={resolvedCompanionFrostedThemeStyle}
            >
              <AlertDialogHeader>
                <AlertDialogTitle>Abandon this campaign?</AlertDialogTitle>
                <AlertDialogDescription>
                  You'll lose progress on "{campaign.title}". This cannot be undone.
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

          {/* Smart Adjust Plan Drawer */}
          <SmartAdjustPlanDrawer
            open={showAdjustDialog}
            onOpenChange={setShowAdjustDialog}
            epicId={campaign.id}
            epicTitle={campaign.title}
            habits={campaign.epic_habits
              ?.filter(eh => eh.habits)
              .map(eh => ({
                id: eh.habit_id,
                title: eh.habits?.title || 'Untitled',
                difficulty: eh.habits?.difficulty,
                frequency: eh.habits?.frequency,
                estimated_minutes: eh.habits?.estimated_minutes,
              })) || []}
            companionFrostedThemeStyle={resolvedCompanionFrostedThemeStyle}
          />
        </div>
      </motion.div>

      <Dialog
        open={showRenameDialog}
        onOpenChange={(open) => {
          if (!isRenaming) {
            setShowRenameDialog(open);
          }
        }}
      >
        <DialogContent
          className={cn(COMPANION_FROSTED_PLANNER_DARK_CLASS, plannerPathfinderTheme.portalSurface, "sm:max-w-md")}
          data-testid="campaign-rename-dialog"
          hideCloseButton={isRenaming}
          style={resolvedCompanionFrostedThemeStyle}
        >
          <DialogHeader>
            <DialogTitle>Rename campaign</DialogTitle>
            <DialogDescription>
              Give this campaign a clearer title. Your progress and rituals will stay the same.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor={`rename-campaign-${campaign.id}`} className="text-sm font-medium">
              Campaign name
            </label>
            <Input
              id={`rename-campaign-${campaign.id}`}
              value={renameTitle}
              onChange={(event) => setRenameTitle(event.target.value)}
              disabled={isRenaming}
              placeholder="Name your campaign"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowRenameDialog(false)}
              disabled={isRenaming}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleRenameSubmit()}
              disabled={isRenameSaveDisabled}
            >
              {isRenaming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});
