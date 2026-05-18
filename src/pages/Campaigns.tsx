import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Plus, Sparkles, Target, Trophy } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { CinematicPageBackground } from "@/components/CinematicPageBackground";
import { PageInfoButton } from "@/components/PageInfoButton";
import { PageInfoModal } from "@/components/PageInfoModal";
import { CampaignCard } from "@/components/CampaignCard";
import { Pathfinder } from "@/components/Pathfinder";
import { CampaignCreatedAnimation } from "@/components/CampaignCreatedAnimation";
import { Button } from "@/components/ui/button";
import { clearShellCardClassName } from "@/components/ui/card";
import { ACTIVE_CAMPAIGN_LIMIT_MESSAGE, hasReachedActiveCampaignLimit } from "@/features/epics/constants";
import { useEpics } from "@/hooks/useEpics";
import { useAuth } from "@/hooks/useAuth";
import { useJourneysCompanionVisual } from "@/hooks/useJourneysCompanionVisual";
import { useMainTabVisibility } from "@/contexts/MainTabVisibilityContext";
import { cn } from "@/lib/utils";
import { getCompanionFrostedThemeStyle } from "@/lib/companionFrostedTheme";
import {
  clearCampaignBuilderDraftSnapshot,
  clearCreationPopupMarker,
  readCampaignBuilderDraftSnapshot,
  readCreationPopupMarker,
  type CampaignBuilderDraftSnapshot,
  writeCreationPopupMarker,
} from "@/utils/creationPopupPersistence";
import { CAMPAIGN_CREATED_ANIMATION_COMPLETE_EVENT } from "@/utils/tutorialEvents";

interface CreatedCampaignData {
  title: string;
  habits: Array<{ title: string }>;
}

const CAMPAIGN_CTA_CLASS = "gap-2 border-celestial-blue/32 bg-celestial-blue/14 text-cyan-50 shadow-[0_14px_32px_rgba(16,75,130,0.2)] backdrop-blur-xl hover:bg-celestial-blue/20 hover:border-celestial-blue/42 hover:text-white";
const CAMPAIGN_PANEL_CLASS = cn(
  "rounded-[32px] border border-celestial-blue/18",
  clearShellCardClassName,
);

const Campaigns = () => {
  const prefersReducedMotion = useReducedMotion();
  const { isTabActive } = useMainTabVisibility();
  const {
    activeEpics,
    completedEpics,
    isLoading,
    createEpic,
    isCreating,
    renameEpic,
    updateEpicStatus,
  } = useEpics({ enabled: isTabActive });
  const { user } = useAuth();
  const { favoriteColor: companionFavoriteColor } = useJourneysCompanionVisual();
  const companionFrostedThemeStyle = useMemo(
    () => getCompanionFrostedThemeStyle(companionFavoriteColor),
    [companionFavoriteColor],
  );
  const [showPathfinder, setShowPathfinder] = useState(false);
  const [pathfinderSessionKey, setPathfinderSessionKey] = useState(0);
  const [pathfinderResumeDraft, setPathfinderResumeDraft] = useState<CampaignBuilderDraftSnapshot | null>(null);
  const [pathfinderResumeDraftKey, setPathfinderResumeDraftKey] = useState<string | null>(null);
  const [showPageInfo, setShowPageInfo] = useState(false);
  const [showCreatedAnimation, setShowCreatedAnimation] = useState(false);
  const [createdCampaignData, setCreatedCampaignData] = useState<CreatedCampaignData | null>(null);
  const hasConsumedResumeRef = useRef(false);

  const hasCampaigns = activeEpics.length > 0 || completedEpics.length > 0;
  const hasReachedLimit = hasReachedActiveCampaignLimit(activeEpics.length);

  const openCampaignBuilder = useCallback(() => {
    clearCreationPopupMarker(user?.id, "campaign");
    clearCampaignBuilderDraftSnapshot(user?.id);
    setPathfinderResumeDraft(null);
    setPathfinderResumeDraftKey(null);
    setPathfinderSessionKey((currentKey) => currentKey + 1);
    setShowPathfinder(true);
  }, [user?.id]);

  const clearCampaignCreationPopupState = useCallback(() => {
    clearCreationPopupMarker(user?.id, "campaign");
    clearCampaignBuilderDraftSnapshot(user?.id);
    setPathfinderResumeDraft(null);
    setPathfinderResumeDraftKey(null);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !showPathfinder) return;

    writeCreationPopupMarker(user.id, {
      surface: "campaign",
      route: "/campaigns",
      selectedDate: null,
      updatedAt: new Date().toISOString(),
    });
  }, [showPathfinder, user?.id]);

  useEffect(() => {
    if (hasConsumedResumeRef.current) return;
    if (!isTabActive) return;
    if (!user?.id) return;
    if (showPathfinder) return;

    const marker = readCreationPopupMarker(user.id);
    if (!marker || marker.surface !== "campaign" || marker.route !== "/campaigns") return;

    hasConsumedResumeRef.current = true;

    const draft = readCampaignBuilderDraftSnapshot(user.id);
    setPathfinderResumeDraft(draft);
    setPathfinderResumeDraftKey(`resume-${marker.updatedAt}`);
    setPathfinderSessionKey((currentKey) => currentKey + 1);
    setShowPathfinder(true);
  }, [isTabActive, showPathfinder, user?.id]);

  const handleCreateCampaign = useCallback(async (data: Parameters<typeof createEpic>[0]) => {
    try {
      await createEpic(data);
      clearCampaignCreationPopupState();
      setShowPathfinder(false);
      setCreatedCampaignData({
        title: data.title,
        habits: data.habits.map((habit) => ({ title: habit.title })),
      });
      setShowCreatedAnimation(true);
    } catch (error) {
      console.error("Failed to create campaign:", error);
      throw error;
    }
  }, [clearCampaignCreationPopupState, createEpic]);

  const handleAnimationComplete = useCallback(() => {
    setShowCreatedAnimation(false);
    setCreatedCampaignData(null);
    window.dispatchEvent(new CustomEvent(CAMPAIGN_CREATED_ANIMATION_COMPLETE_EVENT));
  }, []);

  return (
    <PageTransition mode="instant">
      <CinematicPageBackground preset="campaigns" />
      <div
        className="min-h-screen pb-nav-safe pt-safe px-4 relative z-10"
        style={companionFrostedThemeStyle}
        data-testid="campaigns-theme-scope"
      >
        <div className="mx-auto w-full max-w-[1120px]">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.22 }}
            className="relative mb-6 text-center"
          >
            <div className="absolute right-0 top-0">
              <PageInfoButton onClick={() => setShowPageInfo(true)} />
            </div>
            <h1 className="mt-1 bg-gradient-to-r from-celestial-blue via-sky-300 to-cyan-100 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
              Campaigns
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Build long-range momentum with rituals, milestones, and campaign progress in one place.
            </p>
          </motion.div>

          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: prefersReducedMotion ? 0 : 0.08, duration: prefersReducedMotion ? 0 : 0.2 }}
            className="space-y-6"
          >
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2].map((item) => (
                  <div
                    key={item}
                    className="h-36 animate-pulse rounded-[28px] border border-white/10 bg-white/[0.04]"
                  />
                ))}
              </div>
            ) : !hasCampaigns ? (
              <div
                data-testid="campaigns-empty-state-panel"
                className={cn(CAMPAIGN_PANEL_CLASS, "border-dashed px-6 py-12 text-center")}
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-celestial-blue/15 text-celestial-blue">
                  <Target className="h-8 w-8" />
                </div>
                <h2 className="mt-5 text-2xl font-semibold text-foreground">No campaigns yet</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                  Campaigns turn bigger goals into a structure you can actually live with. Start one to generate rituals, milestones, and a long-view progress path.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  data-testid="campaigns-empty-state-button"
                  data-tour="campaign-builder-launcher"
                  className={cn("mt-6", CAMPAIGN_CTA_CLASS)}
                  onClick={openCampaignBuilder}
                >
                  <Sparkles className="h-4 w-4" />
                  Launch campaign builder
                </Button>
              </div>
            ) : (
              <>
                <section data-testid="campaigns-existing-section">
                  <div className="mb-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                      <Target className="h-4 w-4 text-celestial-blue" />
                      Existing campaigns
                    </div>
                    <div className="flex flex-col items-start gap-3">
                      <Button
                        type="button"
                        size="lg"
                        variant="outline"
                        data-testid="campaigns-create-button"
                        data-tour="campaign-builder-launcher"
                        className={CAMPAIGN_CTA_CLASS}
                        disabled={hasReachedLimit}
                        onClick={openCampaignBuilder}
                      >
                        <Plus className="h-4 w-4" />
                        Create campaign
                      </Button>
                      {hasReachedLimit ? (
                        <p className="text-sm text-muted-foreground">
                          {ACTIVE_CAMPAIGN_LIMIT_MESSAGE}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Use campaigns to turn bigger goals into repeatable rituals.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-4">
                    {activeEpics.length > 0 ? (
                      activeEpics.map((epic) => (
                        <CampaignCard
                          key={epic.id}
                          campaign={epic}
                          onRename={async (title) => {
                            await renameEpic({ epicId: epic.id, title });
                          }}
                          onComplete={() => updateEpicStatus({ epicId: epic.id, status: "completed" })}
                          onAbandon={() => updateEpicStatus({ epicId: epic.id, status: "abandoned" })}
                        />
                      ))
                    ) : (
                      <div className="rounded-[24px] border border-celestial-blue/18 bg-celestial-blue/[0.08] px-4 py-6 text-sm text-muted-foreground backdrop-blur-xl">
                        No active campaigns right now. Start one when you want a bigger container than a single quest.
                      </div>
                    )}
                  </div>
                </section>

                <section>
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    <Trophy className="h-4 w-4 text-stardust-gold" />
                    Completed campaigns
                  </div>
                  <div className="space-y-4">
                    {completedEpics.length > 0 ? (
                      completedEpics.map((epic) => (
                        <CampaignCard key={epic.id} campaign={epic} />
                      ))
                    ) : (
                      <div className="rounded-[24px] border border-celestial-blue/18 bg-celestial-blue/[0.08] px-4 py-6 text-sm text-muted-foreground backdrop-blur-xl">
                        Completed campaigns will collect here as your long-form wins stack up.
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}
          </motion.div>

          <Pathfinder
            key={pathfinderSessionKey}
            open={showPathfinder}
            onOpenChange={(open) => {
              setShowPathfinder(open);
              if (!open) {
                clearCampaignCreationPopupState();
              }
            }}
            onCreateEpic={handleCreateCampaign}
            isCreating={isCreating}
            resumeDraft={pathfinderResumeDraft}
            resumeDraftKey={pathfinderResumeDraftKey}
            persistenceRoute="/campaigns"
            userId={user?.id}
            showTemplatesFirst={false}
            companionFrostedThemeStyle={companionFrostedThemeStyle}
          />

          <CampaignCreatedAnimation
            isVisible={showCreatedAnimation}
            campaignTitle={createdCampaignData?.title || ""}
            habits={createdCampaignData?.habits || []}
            onComplete={handleAnimationComplete}
          />

          <PageInfoModal
            open={showPageInfo}
            onClose={() => setShowPageInfo(false)}
            title="About Campaigns"
            icon={Target}
            description="Campaigns help you organize multi-day goals into rituals and milestones."
            features={[
              "Create campaign rituals with Pathfinder",
              "Track active and completed campaigns separately",
              "Use campaigns to guide the quests you schedule each day",
            ]}
            tip="Start a campaign when a goal needs structure, rhythm, and consistency over time."
          />
        </div>
      </div>
    </PageTransition>
  );
};

export default Campaigns;
