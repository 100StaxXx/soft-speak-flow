import { memo, useState, useCallback } from "react";
import { CampaignCard } from "@/components/CampaignCard";
import { Pathfinder } from "@/components/Pathfinder";
import { JoinEpicDialog } from "@/components/JoinEpicDialog";
import { EpicsTutorialModal } from "@/components/EpicsTutorialModal";
import { CampaignEmptyStateModal } from "./CampaignEmptyStateModal";
import { CampaignCreatedAnimation } from "@/components/CampaignCreatedAnimation";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useFirstTimeModal } from "@/hooks/useFirstTimeModal";
import { Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ACTIVE_CAMPAIGN_LIMIT, hasReachedActiveCampaignLimit } from "@/features/epics/constants";
import type { Campaign } from "@/types/domain";

interface CreatedCampaignData {
  title: string;
  habits: Array<{ title: string }>;
}

const toCampaignCardModel = (campaign: Campaign) => ({
  id: campaign.id,
  user_id: campaign.userId,
  title: campaign.title,
  description: campaign.description ?? undefined,
  target_days: campaign.targetDays,
  start_date: campaign.startDate,
  end_date: campaign.endDate,
  status: campaign.status,
  xp_reward: campaign.xpReward ?? 0,
  progress_percentage: campaign.progressPercentage ?? 0,
  is_public: campaign.isPublic ?? undefined,
  invite_code: campaign.inviteCode ?? undefined,
  theme_color: campaign.themeColor ?? undefined,
  story_type_slug: campaign.storyTypeSlug ?? null,
  epic_habits: campaign.rituals.map((ritual) => ({
    habit_id: ritual.habitId,
    habits: ritual.habit ? {
      id: ritual.habit.id,
      title: ritual.habit.title,
      difficulty: ritual.habit.difficulty ?? "medium",
      description: ritual.habit.description ?? undefined,
      frequency: ritual.habit.frequency ?? undefined,
      estimated_minutes: ritual.habit.estimatedMinutes ?? undefined,
      custom_days: ritual.habit.customDays ?? null,
      custom_month_days: ritual.habit.customMonthDays ?? null,
    } : null,
  })),
});

export const EpicsTab = memo(function EpicsTab() {
  const {
    activeCampaigns,
    completedCampaigns,
    isLoading,
    createCampaign,
    isCreating,
    updateCampaignStatus,
  } = useCampaigns();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [showTemplatesFirst, setShowTemplatesFirst] = useState(false);
  const [joinEpicDialogOpen, setJoinEpicDialogOpen] = useState(false);
  const [showCreatedAnimation, setShowCreatedAnimation] = useState(false);
  const [createdCampaignData, setCreatedCampaignData] = useState<CreatedCampaignData | null>(null);
  const { showModal: showTutorial, dismissModal: dismissTutorial } = useFirstTimeModal('epics');

  const hasCampaigns = activeCampaigns.length > 0 || completedCampaigns.length > 0;

  const handleAddCampaign = useCallback(() => {
    setShowTemplatesFirst(false);
    setWizardOpen(true);
  }, []);

  const handleCreateEpic = useCallback(async (data: Parameters<typeof createCampaign>[0]) => {
    try {
      // Wait for mutation to complete
      await createCampaign(data);
      // Close wizard after successful creation
      setWizardOpen(false);
      // Store data for celebration animation
      setCreatedCampaignData({
        title: data.title,
        habits: data.habits.map(h => ({ title: h.title })),
      });
      // Show celebration
      setShowCreatedAnimation(true);
    } catch (error) {
      // Error is already handled by the mutation's onError
      console.error('Failed to create campaign:', error);
    }
  }, [createCampaign]);

  const handleAnimationComplete = useCallback(() => {
    setShowCreatedAnimation(false);
    setCreatedCampaignData(null);
  }, []);

  return (
    <div className="space-y-4">
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="skeleton"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Inline skeleton for tab content */}
            {[1, 2].map((i) => (
              <div key={i} className="rounded-2xl border border-border/50 overflow-hidden animate-pulse">
                <div className="h-32 bg-muted/20" />
                <div className="p-4 space-y-3">
                  <div className="h-6 w-2/3 bg-muted/30 rounded" />
                  <div className="h-4 w-1/2 bg-muted/20 rounded" />
                  <div className="h-2 w-full bg-muted/20 rounded-full" />
                </div>
              </div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Full-screen empty state modal */}
            <CampaignEmptyStateModal
              open={!hasCampaigns}
              onLaunch={handleAddCampaign}
            />

            {/* Active Campaigns */}
            {activeCampaigns.map((campaign, index) => (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <CampaignCard
                  campaign={toCampaignCardModel(campaign)}
                  onComplete={() => updateCampaignStatus({ epicId: campaign.id, status: "completed" })}
                  onAbandon={() => updateCampaignStatus({ epicId: campaign.id, status: "abandoned" })}
                />
              </motion.div>
            ))}

            {/* Completed Campaigns */}
            {completedCampaigns.map((campaign, index) => (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (activeCampaigns.length + index) * 0.05 }}
              >
                <CampaignCard campaign={toCampaignCardModel(campaign)} />
              </motion.div>
            ))}

            {/* Subtle Add Button - Only when has campaigns and under limit */}
            {hasCampaigns && !hasReachedActiveCampaignLimit(activeCampaigns.length) && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleAddCampaign}
                aria-label={`Create campaign (${ACTIVE_CAMPAIGN_LIMIT} max active)`}
                className="mx-auto flex items-center justify-center w-10 h-10 text-muted-foreground/50 hover:text-muted-foreground transition-all"
              >
                <Plus className="w-4 h-4" />
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pathfinder */}
      <Pathfinder
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCreateEpic={handleCreateEpic}
        isCreating={isCreating}
        showTemplatesFirst={showTemplatesFirst}
      />

      {/* Join Epic Dialog */}
      <JoinEpicDialog
        open={joinEpicDialogOpen}
        onOpenChange={setJoinEpicDialogOpen}
      />
      
      {/* First-time Tutorial Modal */}
      <EpicsTutorialModal open={showTutorial} onClose={dismissTutorial} />

      {/* Campaign Created Celebration */}
      <CampaignCreatedAnimation
        isVisible={showCreatedAnimation}
        campaignTitle={createdCampaignData?.title || ''}
        habits={createdCampaignData?.habits || []}
        onComplete={handleAnimationComplete}
      />
    </div>
  );
});
