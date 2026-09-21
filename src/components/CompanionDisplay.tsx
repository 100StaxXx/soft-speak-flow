import { Card, outerShellCardClassName } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PawPrint, RotateCcw, Sparkles } from "lucide-react";
import { useCompanion } from "@/hooks/useCompanion";
import { useReferrals } from "@/hooks/useReferrals";
import { useCompanionHealth } from "@/hooks/useCompanionHealth";
import { useCompanionExpressionState } from "@/hooks/useCompanionExpressionState";
import { useCompanionVisualState } from "@/hooks/useCompanionVisualState";
import { useCompanionWakeUp } from "@/hooks/useCompanionWakeUp";
import { useCompanionCurrentEvolutionReplay } from "@/hooks/useCompanionCurrentEvolutionReplay";
import { useEpicRewards } from "@/hooks/useEpicRewards";
import { usePostOnboardingMentorGuidance } from "@/hooks/usePostOnboardingMentorGuidance";
import { useEvolution } from "@/contexts/EvolutionContext";
import { CompanionSkeleton } from "@/components/CompanionSkeleton";
import { AttributeTooltip } from "@/components/AttributeTooltip";
import { CompanionBadge } from "@/components/CompanionBadge";
import { CompanionBondBadge } from "@/components/companion/CompanionBondBadge";
import { WelcomeBackModal } from "@/components/WelcomeBackModal";
import { EvolveButton } from "@/components/companion/EvolveButton";
import { EvolutionPathBadge } from "@/components/companion/EvolutionPathBadge";
import { DormancyWarning, DormantOverlay } from "@/components/companion/DormancyWarning";
import { CompanionDialogue } from "@/components/companion/CompanionDialogue";
import { CompanionMotionSurface } from "@/components/companion/motion/CompanionMotionSurface";
import { WakeUpCelebration } from "@/components/companion/WakeUpCelebration";
import {
  LivingCompanionCreatureMotion,
  LivingCompanionInteractionAura,
  LivingCompanionPresenceBubble,
  LivingCompanionWorldPulse,
} from "@/components/companion/LivingCompanionPresence";
import { CompanionAttributes } from "@/components/CompanionAttributes";
import { CompanionStatAnalysisSurface } from "@/components/CompanionStatAnalysisSurface";
import { CompanionPersonalization } from "@/components/CompanionPersonalization";
import { CompanionImage } from "@/components/CompanionImage";
import {
  GracewardDailyFormationBoard,
  type GracewardFormationMedia,
} from "@/components/GracewardDailyFormationBoard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { AnimatePresence } from "framer-motion";
import { cn, formatDisplayLabel } from "@/lib/utils";
import { deriveCompanionPalette } from "@/lib/companionPalette";
import { deriveCompanionDisplayState } from "@/lib/companionDisplayState";
import { getStoredCompanionCustomName, resolveCompanionName } from "@/lib/companionName";
import {
  resolveCompanionExpressiveAssetUrl,
  resolveCompanionVisualAssetUrl,
} from "@/lib/companionAssetResolver";
import { getCompanionEggLabel } from "@/config/companionCatalog";
import { PRODUCT, PRODUCT_COPY } from "@/config/product";
import { isPremadeCompanionBoundaryLevelForProduct } from "@/config/premadeCompanionAssets";
import { buildPremadeCompanionPublicStorageUrl } from "@/config/premadeCompanionAssets";
import { getCosmiqAgendaMotionAssetDescriptor } from "@/config/cosmiqAgendaMotion";
import {
  getCompanionEggImageAssetKey,
  isCompanionEggImageSource,
  isCompanionPresetImageSource,
  shouldContainCompanionSceneImage,
} from "@/lib/companionImageFocal";
import {
  hasCompanionStoredVisual,
  isAiGeneratedCompanion,
  isPresetEggCompanion,
} from "@/lib/companionPredicates";
import {
  COMPANION_EVOLUTION_REVEAL_REQUESTED_EVENT,
  type CompanionEvolutionRevealRequestedDetail,
} from "@/lib/companionEvolutionEvents";
import { useMotionProfile } from "@/hooks/useMotionProfile";
import { useLivingCompanionPresence } from "@/hooks/useLivingCompanionPresence";
import { useCompanionMotionSafe } from "@/contexts/CompanionMotionContext";
import {
  clearPendingCompanionAgendaEvent,
  getPendingCompanionAgendaEvent,
  listenForCompanionAgendaEvents,
  type CompanionAgendaEventDetail,
} from "@/lib/companionAgendaEvents";
import {
  useState,
  useEffect,
  useMemo,
  memo,
  useRef,
  useCallback,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type SyntheticEvent as ReactSyntheticEvent,
  type CSSProperties,
} from "react";
import {
  MAX_COMPANION_STAGE,
  type CompanionElementId,
  type CompanionStoryTone,
} from "@/config/companionCatalog";
import { getCompanionInteractionZone } from "@/config/companionLife";
import type { CompanionLayoutMode } from "@/hooks/useCompanionLayoutMode";
import {
  getNextProgressionLevelXp,
  getNextUnclaimedVisualStageBoundaryLevel,
  getNextVisualStageBoundaryLevel,
  getProgressPercentToNextLevel,
  getProgressionLevelLabel,
  getVisualStageDisplay,
  getVisualStageLabelForLevel,
  resolveProgressionLevelFromXp,
} from "@/config/progression";

interface CompanionDisplayProps {
  layoutMode?: CompanionLayoutMode;
  isVisible?: boolean;
  experienceMode?: "full" | "formation";
}

const LONG_PRESS_DURATION_MS = 800;
const MOVE_CANCEL_THRESHOLD_PX = 12;
const COMPANION_PLACEHOLDER = "/placeholder-companion.svg";
const DEFAULT_GENERATED_SCENE_ASPECT_RATIO = 3 / 2;

interface InlineEvolutionReplayState {
  videoUrl: string;
  posterUrl: string;
  stage: number;
}

interface CosmiqAgendaPlaybackState {
  eventId: string;
  videoUrl: string;
  label: string;
}

const FORMATION_FALLBACK_PROPS = {
  Mind: { primary: "📖", secondary: "👓", label: "reading with a book and glasses" },
  Body: { primary: "🏋️", secondary: "💪", label: "working out with weights" },
  Soul: { primary: "🙏", secondary: "✨", label: "pausing for prayer and reflection" },
} as const;

// Convert hex color to color name (moved outside component for performance)
const getColorName = (hexColor: string): string => {
  const colorMap: Record<string, string> = {
    '#FF0000': 'Red', '#FF4500': 'Orange Red', '#FF6347': 'Tomato',
    '#FFA500': 'Orange', '#FFD700': 'Gold', '#FFFF00': 'Yellow',
    '#00FF00': 'Lime', '#00FA9A': 'Spring Green', '#008000': 'Green',
    '#00FFFF': 'Cyan', '#00CED1': 'Turquoise', '#4169E1': 'Royal Blue',
    '#0000FF': 'Blue', '#000080': 'Navy', '#4B0082': 'Indigo',
    '#9370DB': 'Purple', '#8B008B': 'Dark Magenta', '#FF00FF': 'Magenta',
    '#FF1493': 'Deep Pink', '#FF69B4': 'Hot Pink', '#FFC0CB': 'Pink',
    '#FFFFFF': 'White', '#C0C0C0': 'Silver', '#808080': 'Gray',
    '#000000': 'Black', '#A52A2A': 'Brown', '#D2691E': 'Chocolate',
  };

  // Direct match
  const upperHex = hexColor.toUpperCase();
  if (colorMap[upperHex]) return colorMap[upperHex];

  // Convert hex to RGB for color detection
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Determine dominant color channel
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  
  // Grayscale
  if (max - min < 30) {
    if (max > 200) return 'White';
    if (max > 150) return 'Light Gray';
    if (max > 100) return 'Gray';
    if (max > 50) return 'Dark Gray';
    return 'Black';
  }

  // Color detection
  if (r === max) {
    if (g > b) return g > 150 ? 'Yellow' : 'Orange';
    return r > 150 ? 'Red' : 'Dark Red';
  } else if (g === max) {
    if (r > b) return 'Yellow Green';
    return g > 150 ? 'Green' : 'Dark Green';
  } else {
    if (r > g) return b > 150 ? 'Purple' : 'Dark Purple';
    return b > 150 ? 'Blue' : 'Dark Blue';
  }
};

export const CompanionDisplay = memo(({
  layoutMode = "mobile",
  isVisible = true,
  experienceMode = "full",
}: CompanionDisplayProps) => {
  const {
    companion,
    nextEvolutionXP,
    progressToNext,
    isLoading,
    canEvolve,
    triggerManualEvolution,
    isEvolutionBusy,
    hatchCompanion,
  } = useCompanion();
  const { unlockedSkins } = useReferrals();
  const { health, needsWelcomeBack } = useCompanionHealth();
  const { equippedRewards } = useEpicRewards();
  const { isPreHatchCompanionStep } = usePostOnboardingMentorGuidance();
  const { pendingEvolutionReveal } = useEvolution();
  
  // Wake-up celebration detection
  const {
    showCelebration: showWakeUpCelebration,
    dismissCelebration: dismissWakeUpCelebration,
    companionName: wakeUpCompanionName,
    companionImageUrl: wakeUpCompanionImageUrl,
    companionImageFocalX: wakeUpCompanionImageFocalX,
    companionImageFocalY: wakeUpCompanionImageFocalY,
    dormantImageUrl: wakeUpDormantImageUrl,
    dormantImageFocalX: wakeUpDormantImageFocalX,
    dormantImageFocalY: wakeUpDormantImageFocalY,
    bondLevel: wakeUpBondLevel,
  } = useCompanionWakeUp();
  
  // Use care-based visual state (includes care signals to avoid duplicate hook calls)
  const { 
    cssStyles: careStyles, 
    animationClass, 
    care,
    evolutionPath, 
    isDormant,
    hasDormancyWarning,
  } = useCompanionVisualState(
    health.moodState,
    health.hunger,
    health.happiness,
    health.isAlive,
    health.recoveryProgress
  );
  const expressionState = useCompanionExpressionState();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [portraitSourceAspectRatio, setPortraitSourceAspectRatio] = useState<number | null>(null);
  const [imageKey, setImageKey] = useState(0); // Force image reload
  const [fallbackToDefaultPortrait, setFallbackToDefaultPortrait] = useState(false);
  const [failedFormationStillUrl, setFailedFormationStillUrl] = useState<string | null>(null);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [welcomeBackDismissed, setWelcomeBackDismissed] = useState(false);
  const [showStatsAnalysis, setShowStatsAnalysis] = useState(false);
  const [creatureName, setCreatureName] = useState<string | null>(null);
  const [hatchDialogOpen, setHatchDialogOpen] = useState(false);
  const [isManualEvolutionStarting, setIsManualEvolutionStarting] = useState(false);
  const [inlineEvolutionReplay, setInlineEvolutionReplay] = useState<InlineEvolutionReplayState | null>(null);
  const [cosmiqAgendaPlayback, setCosmiqAgendaPlayback] = useState<CosmiqAgendaPlaybackState | null>(null);
  const [formationMedia, setFormationMedia] = useState<GracewardFormationMedia | null>(null);
  const [formationVideoPlaying, setFormationVideoPlaying] = useState(false);
  const isDesktop = layoutMode === "desktop";
  const { profile, signals } = useMotionProfile();
  const { activeEvent } = useCompanionMotionSafe();
  const prefersReducedMotion = profile === "reduced" || signals.prefersReducedMotion;
  
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressConsumed = useRef(false);
  const touchStartPoint = useRef<{ x: number; y: number } | null>(null);
  const latestTouchPoint = useRef<{ x: number; y: number } | null>(null);
  const previousImageUrl = useRef<string | null>(null);
  const manualEvolutionStartingRef = useRef(false);
  const inlineReplayPosterUrlRef = useRef(COMPANION_PLACEHOLDER);
  const wasVisible = useRef(isVisible);
  const matchingPendingEvolutionReveal = useMemo(
    () => (
      companion &&
      pendingEvolutionReveal?.companionId === companion.id &&
      pendingEvolutionReveal.newStage === companion.current_stage
        ? pendingEvolutionReveal
        : null
    ),
    [companion, pendingEvolutionReveal],
  );
  const {
    displayCompanion,
    displayNextEvolutionXP,
    displayProgressToNext,
    displayCanEvolve,
    isPreHatchDisplay,
    isPendingRevealDisplay,
  } = useMemo(
    () =>
      deriveCompanionDisplayState({
        companion,
        nextEvolutionXP,
        progressToNext,
        canEvolve,
        forcePreHatchDisplay: isPreHatchCompanionStep,
        pendingEvolutionReveal: matchingPendingEvolutionReveal,
      }),
    [
      canEvolve,
      companion,
      isPreHatchCompanionStep,
      matchingPendingEvolutionReveal,
      nextEvolutionXP,
      progressToNext,
    ],
  );
  const displayRequiresHatchSelection = Boolean(
    displayCompanion
    && displayCompanion.current_stage === 0
    && !isPresetEggCompanion(displayCompanion)
    && !isAiGeneratedCompanion(displayCompanion)
    && !hasCompanionStoredVisual(displayCompanion),
  );
  const {
    data: currentEvolutionReplay,
    refetch: refetchCurrentEvolutionReplay,
  } = useCompanionCurrentEvolutionReplay({
    companion: displayCompanion,
    enabled: Boolean(displayCompanion),
  });

  const finishInlineEvolutionReplay = useCallback(() => {
    setInlineEvolutionReplay(null);
  }, []);

  const finishCosmiqAgendaPlayback = useCallback(() => {
    setCosmiqAgendaPlayback((current) => {
      if (current) clearPendingCompanionAgendaEvent(current.eventId);
      return null;
    });
  }, []);

  useEffect(() => {
    if (
      PRODUCT.mode !== "cosmiq"
      || !displayCompanion
      || displayCompanion.current_stage < 1
      || prefersReducedMotion
    ) {
      return;
    }

    const preparePlayback = (detail: CompanionAgendaEventDetail) => {
      const descriptor = getCosmiqAgendaMotionAssetDescriptor({
        species: displayCompanion.preset_id ?? displayCompanion.spirit_animal,
        element: displayCompanion.core_element,
        stage: displayCompanion.current_stage,
        eventType: detail.eventType,
        category: detail.category,
        seed: detail.seed,
      });
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
      if (!descriptor || !supabaseUrl) return;

      setInlineEvolutionReplay(null);
      setFormationVideoPlaying(false);
      setCosmiqAgendaPlayback({
        eventId: detail.id,
        videoUrl: buildPremadeCompanionPublicStorageUrl({
          supabaseUrl,
          bucket: descriptor.videoBucket,
          storagePath: descriptor.videoStoragePath,
        }),
        label: `${detail.category ? `${detail.category} ` : ""}${detail.eventType.replace("-", " ")}`,
      });
    };

    const pending = getPendingCompanionAgendaEvent();
    if (pending) preparePlayback(pending);
    return listenForCompanionAgendaEvents(preparePlayback);
  }, [
    displayCompanion,
    displayCompanion?.core_element,
    displayCompanion?.current_stage,
    displayCompanion?.preset_id,
    displayCompanion?.spirit_animal,
    prefersReducedMotion,
  ]);

  const handleEvolutionReplay = useCallback(async () => {
    if (!displayCompanion || inlineEvolutionReplay) return;

    const replay =
      currentEvolutionReplay ??
      (await refetchCurrentEvolutionReplay()).data ??
      null;

    if (replay?.videoUrl) {
      setInlineEvolutionReplay({
        videoUrl: replay.videoUrl,
        posterUrl: replay.imageUrl ?? inlineReplayPosterUrlRef.current,
        stage: replay.stage,
      });
      return;
    }

    toast.info("No evolution replay yet.");
  }, [
    currentEvolutionReplay,
    displayCompanion,
    inlineEvolutionReplay,
    refetchCurrentEvolutionReplay,
  ]);

  // Get equipped skin and calculate styles
  const equippedSkin = useMemo(() => {
    return unlockedSkins?.find(us => us.is_equipped)?.companion_skins;
  }, [unlockedSkins]);

  // Parse skin CSS effects
  const skinStyles = useMemo(() => {
    if (!equippedSkin?.css_effect) return {};
    
    try {
      const effects = equippedSkin.css_effect as Record<string, any>;

      // Apply different effects based on skin type with validation
      if (equippedSkin.skin_type === 'aura' && 
          effects.glowColor && 
          typeof effects.glowColor === 'string') {
        return {
          boxShadow: `0 0 30px ${effects.glowColor}, 0 0 60px ${effects.glowColor}`,
          filter: `drop-shadow(0 0 20px ${effects.glowColor})`
        };
      } else if (equippedSkin.skin_type === 'frame' && 
                 effects.borderColor && 
                 typeof effects.borderColor === 'string') {
        return {
          border: `${effects.borderWidth || '3px'} solid ${effects.borderColor}`,
          boxShadow: effects.shimmer ? `0 0 20px ${effects.borderColor}` : undefined
        };
      }
    } catch (error) {
      console.error("Failed to parse skin effects:", error);
      return {};
    }

    return {};
  }, [equippedSkin]);

  // Parse equipped epic reward cosmetics
  const equippedCosmeticStyles = useMemo(() => {
    const styles: React.CSSProperties = {};
    
    // Apply equipped frame
    if (equippedRewards.frame?.epic_rewards?.css_effect) {
      const frameEffect = equippedRewards.frame.epic_rewards.css_effect as Record<string, any>;
      if (frameEffect.borderColor) {
        styles.borderColor = frameEffect.borderColor;
        styles.borderWidth = frameEffect.borderWidth || '4px';
        styles.borderStyle = 'solid';
      }
    }
    
    // Apply equipped effect (glow)
    if (equippedRewards.effect?.epic_rewards?.css_effect) {
      const effectData = equippedRewards.effect.epic_rewards.css_effect as Record<string, any>;
      if (effectData.glowColor) {
        styles.boxShadow = `0 0 30px ${effectData.glowColor}, 0 0 60px ${effectData.glowColor}`;
      }
    }
    
    return styles;
  }, [equippedRewards]);

  // Get equipped background gradient
  const equippedBackgroundStyle = useMemo(() => {
    if (equippedRewards.background?.epic_rewards?.css_effect) {
      const bgEffect = equippedRewards.background.epic_rewards.css_effect as Record<string, any>;
      return bgEffect.gradient || null;
    }
    return null;
  }, [equippedRewards]);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  // Show welcome back modal if user has been inactive
  useEffect(() => {
    if (needsWelcomeBack && !welcomeBackDismissed && companion) {
      setShowWelcomeBack(true);
    }
  }, [needsWelcomeBack, welcomeBackDismissed, companion]);

  const normalDisplayImageUrl = useMemo(() => {
    if (!displayCompanion) return null;

    if (isDormant) {
      return resolveCompanionVisualAssetUrl(displayCompanion, "dormant");
    }
    if (
      health.isNeglected
      && health.neglectedImageUrl
      && (typeof displayCompanion.current_stage !== "number" || displayCompanion.current_stage > 0)
    ) {
      return health.neglectedImageUrl;
    }
    if (health.isNeglected) {
      return resolveCompanionVisualAssetUrl(displayCompanion, "neglected");
    }
    return resolveCompanionVisualAssetUrl(displayCompanion, "normal");
  }, [
    displayCompanion,
    health.isNeglected,
    health.neglectedImageUrl,
    isDormant,
  ]);

  const expressiveImageUrl = useMemo(() => {
    if (!displayCompanion || isDormant || health.isNeglected) {
      return null;
    }

    return resolveCompanionExpressiveAssetUrl(displayCompanion, {
      mood: expressionState.mood,
      variant: expressionState.variant,
    });
  }, [
    displayCompanion,
    expressionState.mood,
    expressionState.variant,
    health.isNeglected,
    isDormant,
  ]);

  const displayImageUrl = fallbackToDefaultPortrait || !expressiveImageUrl
    ? normalDisplayImageUrl
    : expressiveImageUrl;

  const formationStillUrl = formationMedia?.stillUrl ?? null;
  const activeFormationStillUrl = formationStillUrl && formationStillUrl !== failedFormationStillUrl
    ? formationStillUrl
    : null;
  const effectiveImageUrl = activeFormationStillUrl || displayImageUrl || COMPANION_PLACEHOLDER;
  const usesPresetPortraitShell = isCompanionPresetImageSource(effectiveImageUrl);
  const usesEggPortraitShell = isCompanionEggImageSource(effectiveImageUrl);
  const usesSceneEggPortraitShell =
    getCompanionEggImageAssetKey(effectiveImageUrl)?.startsWith("companion-eggs/v2/") ?? false;
  const usesGeneratedSceneShell = shouldContainCompanionSceneImage(effectiveImageUrl);
  const portraitImageFit = usesGeneratedSceneShell
    ? "contain"
    : (usesPresetPortraitShell || (usesEggPortraitShell && !usesSceneEggPortraitShell))
      ? "portrait"
      : "cover";
  const portraitFrameAspectRatio = usesGeneratedSceneShell
    ? portraitSourceAspectRatio ?? DEFAULT_GENERATED_SCENE_ASPECT_RATIO
    : 1;
  const portraitFrameStyle: CSSProperties | undefined = usesGeneratedSceneShell
    ? { aspectRatio: `${portraitFrameAspectRatio}` }
    : undefined;
  const portraitFrameSizeClass = isDesktop
    ? (usesGeneratedSceneShell ? "w-72 max-w-full" : "h-72 w-72")
    : (usesGeneratedSceneShell ? "w-64 max-w-full" : "h-64 w-64");
  const portraitSceneContentClassName = cn(
    "flex items-center justify-center",
    usesEggPortraitShell && !usesSceneEggPortraitShell && "p-2.5 sm:p-3",
  );
  const effectiveImageFocal = useMemo(() => {
    if (activeFormationStillUrl) return { x: null, y: null };
    if (!displayCompanion) return { x: null, y: null };

    if (isDormant) {
      return {
        x: displayCompanion.dormant_image_focal_x ?? displayCompanion.current_image_focal_x ?? null,
        y: displayCompanion.dormant_image_focal_y ?? displayCompanion.current_image_focal_y ?? null,
      };
    }

    if (health.isNeglected) {
      return {
        x:
          health.neglectedImageFocalX ??
          displayCompanion.neglected_image_focal_x ??
          displayCompanion.current_image_focal_x ??
          null,
        y:
          health.neglectedImageFocalY ??
          displayCompanion.neglected_image_focal_y ??
          displayCompanion.current_image_focal_y ??
          null,
      };
    }

    return {
      x: health.imageFocalX ?? displayCompanion.current_image_focal_x ?? null,
      y: health.imageFocalY ?? displayCompanion.current_image_focal_y ?? null,
    };
  }, [
    displayCompanion,
    activeFormationStillUrl,
    health.imageFocalX,
    health.imageFocalY,
    health.isNeglected,
    health.neglectedImageFocalX,
    health.neglectedImageFocalY,
    isDormant,
  ]);

  // Track image URL changes to reset loading state
  useEffect(() => {
    if (previousImageUrl.current === effectiveImageUrl) return;
    previousImageUrl.current = effectiveImageUrl;
    setImageLoaded(false);
    setImageError(false);
    setPortraitSourceAspectRatio(null);
  }, [effectiveImageUrl]);

  useEffect(() => {
    if (failedFormationStillUrl !== formationStillUrl) {
      setFailedFormationStillUrl(null);
    }
  }, [failedFormationStillUrl, formationStillUrl]);

  const handleFormationMediaChange = useCallback((media: GracewardFormationMedia | null) => {
    if (media) {
      setInlineEvolutionReplay(null);
    }
    setFormationMedia(media);
    const shouldPlay = Boolean(media?.playVideo && !prefersReducedMotion);
    setFormationVideoPlaying(shouldPlay);
    if (media?.playVideo && !shouldPlay && media.onPlaybackComplete) {
      window.setTimeout(media.onPlaybackComplete, 0);
    }
  }, [prefersReducedMotion]);

  const finishFormationPlayback = useCallback(() => {
    setFormationVideoPlaying(false);
    formationMedia?.onPlaybackComplete?.();
  }, [formationMedia]);

  useEffect(() => {
    if (!isVisible) {
      setFormationVideoPlaying(false);
    }
  }, [isVisible]);

  useEffect(() => {
    if (!formationVideoPlaying || formationMedia?.videoUrl) return;
    const settleTimer = window.setTimeout(finishFormationPlayback, 1_800);
    return () => window.clearTimeout(settleTimer);
  }, [finishFormationPlayback, formationMedia?.videoUrl, formationVideoPlaying]);

  useEffect(() => {
    inlineReplayPosterUrlRef.current = effectiveImageUrl;
  }, [effectiveImageUrl]);

  useEffect(() => {
    const becameVisible = isVisible && !wasVisible.current;
    wasVisible.current = isVisible;

    if (!becameVisible) return;

    setImageLoaded(false);
    setImageError(false);
    setImageKey((prev) => prev + 1);
    if (
      formationMedia?.phase === "practice"
      && formationMedia.playVideo
      && !prefersReducedMotion
    ) {
      setFormationVideoPlaying(true);
    }
  }, [formationMedia, isVisible, prefersReducedMotion]);

  const handlePortraitImageLoad = useCallback((event: ReactSyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    setPortraitSourceAspectRatio(
      naturalWidth > 0 && naturalHeight > 0 ? naturalWidth / naturalHeight : null,
    );
    setImageLoaded(true);
    setImageError(false);
  }, []);

  useEffect(() => {
    setFallbackToDefaultPortrait(false);
  }, [expressiveImageUrl, isDormant, health.isNeglected]);

  const companionPalette = useMemo(
    () =>
      deriveCompanionPalette({
        coreElement: displayCompanion?.core_element,
        favoriteColor: displayCompanion?.favorite_color,
        stage: displayCompanion?.current_stage,
        companionId: displayCompanion?.id,
      }),
    [
      displayCompanion?.core_element,
      displayCompanion?.favorite_color,
      displayCompanion?.current_stage,
      displayCompanion?.id,
    ],
  );

  const companionMotionEvent = useMemo(() => {
    if (!activeEvent) return null;
    if (activeEvent.type === "evolution_start" || activeEvent.type === "evolution_reveal") {
      return null;
    }
    return activeEvent;
  }, [activeEvent]);

  // Resolve a consistent display name through shared name resolver
  useEffect(() => {
    let cancelled = false;
    const fetchCreatureName = async () => {
      if (!displayCompanion) return;

      if (isPendingRevealDisplay) {
        setCreatureName(
          getStoredCompanionCustomName(displayCompanion)
          ?? (displayCompanion.current_stage === 0
            ? getCompanionEggLabel(displayCompanion.core_element)
            : "Companion"),
        );
        return;
      }

      if (displayCompanion.current_stage === 0) {
        setCreatureName(
          getStoredCompanionCustomName(displayCompanion)
          ?? getCompanionEggLabel(displayCompanion.core_element),
        );
        return;
      }

      const resolvedName = await resolveCompanionName({
        companion: displayCompanion,
        fallback: "companion",
      });

      if (!cancelled) {
        setCreatureName(resolvedName);
      }
    };

    void fetchCreatureName();

    return () => {
      cancelled = true;
    };
  }, [
    displayCompanion?.id,
    displayCompanion?.companion_name,
    displayCompanion?.current_stage,
    displayCompanion?.cached_creature_name,
    displayCompanion?.spirit_animal,
    displayCompanion?.core_element,
    isPendingRevealDisplay,
  ]);

  const livingPresence = useLivingCompanionPresence({
    companionId: displayCompanion?.id,
    companionName: creatureName ?? "Companion",
    expressionMood: expressionState.mood,
    isVisible,
    canInteract: Boolean(displayCompanion),
    canSpeak: Boolean(displayCompanion && displayCompanion.current_stage > 0),
    isDormant,
    hasDormancyWarning,
    inactiveDays:
      care.dormancy?.inactiveDays
      ?? displayCompanion?.inactive_days
      ?? 0,
    progressToNext: displayProgressToNext,
    canEvolve: displayCanEvolve,
    currentStage: displayCompanion?.current_stage ?? 1,
    presetId: displayCompanion?.preset_id,
    spiritAnimal: displayCompanion?.spirit_animal,
    enableDailyQuestion: PRODUCT.mode === "cosmiq",
  });

  const getRelativeInteractionPoint = useCallback((
    clientX: number,
    clientY: number,
    target: HTMLDivElement,
  ) => {
    const bounds = target.getBoundingClientRect();
    const x = bounds.width > 0 ? Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width)) : 0.5;
    const y = bounds.height > 0 ? Math.max(0, Math.min(1, (clientY - bounds.top) / bounds.height)) : 0.5;
    return {
      normalized: { x, y },
      percent: { x: x * 100, y: y * 100 },
    };
  }, []);

  const handlePressStart = useCallback((
    event: ReactMouseEvent<HTMLDivElement> | ReactTouchEvent<HTMLDivElement>,
  ) => {
    if (!displayCompanion || inlineEvolutionReplay) return;

    longPressConsumed.current = false;
    if ("touches" in event && event.touches[0]) {
      const touch = event.touches[0];
      touchStartPoint.current = { x: touch.clientX, y: touch.clientY };
      latestTouchPoint.current = { x: touch.clientX, y: touch.clientY };
    } else {
      touchStartPoint.current = null;
      latestTouchPoint.current = null;
    }

    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      longPressConsumed.current = true;
      livingPresence.comfort();
    }, LONG_PRESS_DURATION_MS);
  }, [displayCompanion, inlineEvolutionReplay, livingPresence]);

  const handlePressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchStartPoint.current = null;
    latestTouchPoint.current = null;
  }, []);

  const handlePressMove = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    if (!touchStartPoint.current) return;

    const touch = event.touches[0];
    if (!touch) return;
    latestTouchPoint.current = { x: touch.clientX, y: touch.clientY };
    const relativePoint = getRelativeInteractionPoint(touch.clientX, touch.clientY, event.currentTarget);
    livingPresence.updateGaze({
      x: relativePoint.normalized.x * 2 - 1,
      y: relativePoint.normalized.y * 2 - 1,
      active: true,
    });

    const deltaX = Math.abs(touch.clientX - touchStartPoint.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartPoint.current.y);
    if (deltaX > MOVE_CANCEL_THRESHOLD_PX || deltaY > MOVE_CANCEL_THRESHOLD_PX) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  }, [getRelativeInteractionPoint, livingPresence]);

  const handleTouchEnd = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    const start = touchStartPoint.current;
    const end = latestTouchPoint.current;
    if (start && end) {
      const distance = Math.hypot(end.x - start.x, end.y - start.y);
      if (distance >= 34 && !longPressConsumed.current) {
        const relativePoint = getRelativeInteractionPoint(end.x, end.y, event.currentTarget);
        longPressConsumed.current = true;
        livingPresence.pet(relativePoint.percent);
      }
    }
    livingPresence.updateGaze({ x: 0, y: 0, active: false });
    handlePressEnd();
  }, [getRelativeInteractionPoint, handlePressEnd, livingPresence]);

  const handleCompanionImageClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (longPressConsumed.current) {
      longPressConsumed.current = false;
      return;
    }
    const relativePoint = getRelativeInteractionPoint(event.clientX, event.clientY, event.currentTarget);
    livingPresence.interact(
      getCompanionInteractionZone(relativePoint.normalized),
      relativePoint.percent,
    );
  }, [getRelativeInteractionPoint, livingPresence]);

  const handleCompanionMouseMove = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    const relativePoint = getRelativeInteractionPoint(event.clientX, event.clientY, event.currentTarget);
    livingPresence.updateGaze({
      x: relativePoint.normalized.x * 2 - 1,
      y: relativePoint.normalized.y * 2 - 1,
      active: true,
    });
  }, [getRelativeInteractionPoint, livingPresence]);

  const handleCompanionMouseLeave = useCallback(() => {
    livingPresence.updateGaze({ x: 0, y: 0, active: false });
    handlePressEnd();
  }, [handlePressEnd, livingPresence]);

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    livingPresence.interact("heart", { x: 50, y: 55 });
  }, [livingPresence]);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  if (isLoading) return <CompanionSkeleton />;
  if (!companion || !displayCompanion) return null;

  const visualStageLabel = getVisualStageLabelForLevel(displayCompanion.current_stage);
  const visualStageDisplay = getVisualStageDisplay(displayCompanion.current_stage);
  const formationStageDisplay = visualStageDisplay.replace(/^Stage\s+\d+\s*•\s*/i, "");
  const earnedLevel = isPreHatchDisplay
    ? displayCompanion.current_stage
    : resolveProgressionLevelFromXp(displayCompanion.current_xp);
  const evolutionReadinessLevel = isPreHatchDisplay
    ? resolveProgressionLevelFromXp(displayCompanion.current_xp)
    : earnedLevel;
  const currentLevelLabel = getProgressionLevelLabel(earnedLevel);
  const colorName = getColorName(displayCompanion.favorite_color);
  const nextProgressLevel = Math.min(earnedLevel + 1, MAX_COMPANION_STAGE);
  const nextLevelLabel = getProgressionLevelLabel(nextProgressLevel);
  const safeNextEvolutionXP =
    displayNextEvolutionXP
    ?? getNextProgressionLevelXp(earnedLevel)
    ?? displayCompanion.current_xp;
  const levelProgressToNext = getProgressPercentToNextLevel(earnedLevel, displayCompanion.current_xp);
  const displayedProgressValue = displayCanEvolve ? 100 : levelProgressToNext;
  const isMaxStage = earnedLevel >= MAX_COMPANION_STAGE;
  const isStageZeroEgg = displayCompanion.current_stage === 0;
  const hasEmbeddedCompanionControl = imageError
    || Boolean(inlineEvolutionReplay)
    || Boolean(cosmiqAgendaPlayback)
    || formationVideoPlaying;
  const companionPortraitIsInteractive = !hasEmbeddedCompanionControl;
  const unscopedReadyVisualBoundaryLevel = getNextUnclaimedVisualStageBoundaryLevel(
    displayCompanion.current_stage,
    evolutionReadinessLevel,
  );
  const readyVisualBoundaryLevel = unscopedReadyVisualBoundaryLevel !== null &&
      isPremadeCompanionBoundaryLevelForProduct({
        productMode: displayCompanion.product_mode,
        boundaryLevel: unscopedReadyVisualBoundaryLevel,
      })
    ? unscopedReadyVisualBoundaryLevel
    : null;
  const readyVisualStageDisplay = readyVisualBoundaryLevel === null
    ? null
    : getVisualStageDisplay(readyVisualBoundaryLevel);
  const readyEvolutionCopy = readyVisualBoundaryLevel === null
    ? null
    : readyVisualBoundaryLevel === 1
      ? "Ready to hatch"
      : `New form ready: ${readyVisualStageDisplay}`;
  const unscopedNextVisualStageBoundaryLevel = getNextVisualStageBoundaryLevel(
    displayCompanion.current_stage,
  );
  const nextVisualStageBoundaryLevel = unscopedNextVisualStageBoundaryLevel !== null &&
      isPremadeCompanionBoundaryLevelForProduct({
        productMode: displayCompanion.product_mode,
        boundaryLevel: unscopedNextVisualStageBoundaryLevel,
      })
    ? unscopedNextVisualStageBoundaryLevel
    : null;
  const isGracewardVisualReleaseCeiling = displayCompanion.product_mode === "graceward" &&
    displayCompanion.current_stage >= 5;
  const nextVisualStageLabel = nextVisualStageBoundaryLevel === null
    ? null
    : getVisualStageLabelForLevel(nextVisualStageBoundaryLevel);
  const expressionAnimationClass = prefersReducedMotion
    ? ""
    : ({
      excited: "animate-companion-bounce",
      happy: "animate-companion-pulse",
      calm: "",
      concerned: "animate-companion-droop",
      sleepy: "animate-companion-slow-breathe",
      curious: "animate-companion-curious",
    } as const)[livingPresence.bodyLanguage];
  const activePortraitAnimationClass = isDormant || health.isNeglected
    ? animationClass
    : formationVideoPlaying && formationMedia && !formationMedia.videoUrl
      ? formationMedia.category === "Body"
        ? "animate-companion-bounce"
        : formationMedia.category === "Mind"
          ? "animate-companion-curious"
          : "animate-companion-slow-breathe"
      : expressionAnimationClass;
  const shouldAnimateIdleDrift = !prefersReducedMotion
    && imageLoaded
    && !imageError
    && !inlineEvolutionReplay
    && !cosmiqAgendaPlayback
    && !formationVideoPlaying
    && !isDormant
    && !health.isNeglected
    && livingPresence.bodyLanguage === "calm";
  const customDisplayName = getStoredCompanionCustomName(displayCompanion);
  const displayedCreatureName = creatureName
    || customDisplayName
    || (isStageZeroEgg ? getCompanionEggLabel(displayCompanion.core_element) : "Companion");
  const isPendingRevealReady = matchingPendingEvolutionReveal?.status === "ready";
  const isPendingRevealPreparing = isPendingRevealDisplay && !isPendingRevealReady;

  const handleEvolvePress = async () => {
    if (matchingPendingEvolutionReveal?.status === "ready") {
      window.dispatchEvent(
        new CustomEvent<CompanionEvolutionRevealRequestedDetail>(
          COMPANION_EVOLUTION_REVEAL_REQUESTED_EVENT,
          {
            detail: {
              companionId: matchingPendingEvolutionReveal.companionId,
              stage: matchingPendingEvolutionReveal.newStage,
            },
          },
        ),
      );
      return;
    }

    if (isPendingRevealDisplay) {
      return;
    }

    if (displayRequiresHatchSelection) {
      setHatchDialogOpen(true);
      return;
    }

    if (manualEvolutionStartingRef.current) return;

    manualEvolutionStartingRef.current = true;
    setIsManualEvolutionStarting(true);
    try {
      await triggerManualEvolution(
        isStageZeroEgg
          ? {
            hatchAnimationSnapshot: {
              previousImageUrl: effectiveImageUrl,
              element: displayCompanion.core_element ?? null,
            },
          }
          : undefined,
      );
    } finally {
      manualEvolutionStartingRef.current = false;
      setIsManualEvolutionStarting(false);
    }
  };

  const handleHatchSelection = async (data: {
    presetId: string | null;
    favoriteColor: string;
    spiritAnimal: string;
    coreElement: string;
    storyTone: string;
    companionName?: string | null;
  }) => {
    if (!data.presetId) return;
    setHatchDialogOpen(false);
    await hatchCompanion.mutateAsync({ presetId: data.presetId, companionName: data.companionName });
  };

  return (
    <>
      <Card
        data-testid="companion-outer-shell"
        className={cn(
          "relative overflow-hidden border transition-all duration-500 animate-scale-in",
          outerShellCardClassName,
        )}
        style={{ borderColor: companionPalette.chipBorder }}
      >
        {/* Equipped background or default nebula gradients */}
        {equippedBackgroundStyle ? (
          <div 
            className="absolute inset-0 opacity-[0.08] transition-opacity duration-500" 
            style={{ background: equippedBackgroundStyle }}
          />
        ) : (
          <>
            <div
              data-testid="companion-shell-gradient-overlay"
              className={`absolute inset-0 opacity-[0.08] ${!prefersReducedMotion ? "animate-nebula-shift" : ""}`}
              style={{
                background: `linear-gradient(135deg, ${companionPalette.cardGradientA}, ${companionPalette.cardGradientB})`,
              }}
            />
            <div
              data-testid="companion-shell-radial-top"
              className="absolute inset-0 opacity-[0.04]"
              style={{
                background: `radial-gradient(circle at top right, ${companionPalette.glow}, transparent 52%)`,
              }}
            />
            <div
              data-testid="companion-shell-radial-bottom"
              className="absolute inset-0 opacity-[0.04]"
              style={{
                background: `radial-gradient(circle at bottom left, ${companionPalette.badgeBorder}, transparent 56%)`,
              }}
            />
          </>
        )}
        
        <div className={cn("relative space-y-6", isDesktop ? "p-7" : "p-6")}>
          {/* Stage badge */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center">
                <h2
                  data-testid="companion-visual-stage"
                  className={`text-3xl font-heading font-black bg-clip-text text-transparent ${!prefersReducedMotion ? 'animate-gradient' : ''}`}
                  style={{
                    backgroundImage: `linear-gradient(90deg, ${companionPalette.accentText}, ${companionPalette.badgeText}, ${companionPalette.accentText})`,
                  }}
                >
                  {experienceMode === "formation" ? formationStageDisplay : visualStageDisplay}
                </h2>
                <AttributeTooltip title="Progression" description="Your companion's current visual stage." />
              </div>
              <p className="text-sm text-muted-foreground font-medium">
                {isMaxStage
                  ? experienceMode === "formation" ? "Fully grown" : "Maximum level reached"
                  : displayCanEvolve && readyEvolutionCopy
                    ? readyEvolutionCopy
                    : isGracewardVisualReleaseCeiling
                      ? "More companion forms coming soon"
                    : nextVisualStageBoundaryLevel === null || !nextVisualStageLabel
                      ? experienceMode === "formation" ? `Mature form · ${visualStageLabel}` : `Final stage • ${visualStageLabel}`
                      : experienceMode === "formation"
                        ? `Growing toward ${nextVisualStageLabel}`
                        : `Next stage at Level ${nextVisualStageBoundaryLevel} • ${nextVisualStageLabel}`}
              </p>
            </div>
            <div
              className={`h-14 w-14 rounded-full flex items-center justify-center ${!prefersReducedMotion ? 'animate-pulse' : ''}`}
              style={{
                background: companionPalette.badgeBg,
                boxShadow: `0 0 26px ${companionPalette.glow}`,
                border: `1px solid ${companionPalette.badgeBorder}`,
              }}
              aria-hidden="true"
            >
              <PawPrint fill="currentColor" className="h-7 w-7 -rotate-45" style={{ color: companionPalette.accentText }} />
            </div>
          </div>

          {/* Companion Name - Centered */}
          <p
            className={cn(
              "text-center font-semibold tracking-wide -mt-1",
              isDesktop ? "text-3xl" : "text-2xl",
            )}
            style={{ color: companionPalette.accentText }}
          >
            {displayedCreatureName}
          </p>

          {/* Companion Image */}
          <div
            className="flex justify-center py-2 relative group"
            role="group"
            aria-label={experienceMode === "formation"
              ? `Your companion in its ${formationStageDisplay} form`
              : `Your companion at ${visualStageDisplay}, ${currentLevelLabel}`}
          >
            {/* Companion presence glow */}
            <div 
              className={`absolute inset-0 blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-500 ${prefersReducedMotion || experienceMode === "formation" ? 'animate-none' : 'animate-orbit'}`}
              style={{
                background: experienceMode === "formation"
                  ? "radial-gradient(circle, hsl(var(--primary) / 0.28), hsl(92 28% 58% / 0.16), transparent 70%)"
                  : `radial-gradient(circle, hsl(var(--celestial-blue) / ${(displayCompanion.vitality ?? 300) / 600}), hsl(var(--nebula-pink) / ${(displayCompanion.vitality ?? 300) / 600}), transparent)`,
              }}
              aria-hidden="true" 
            />
            <div className={`absolute inset-0 bg-gradient-to-r from-primary/20 via-amber-200/20 to-primary/20 blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-500 ${prefersReducedMotion ? 'animate-none' : ''}`} aria-hidden="true" />
            <div
              className="relative touch-manipulation select-none focus-visible:ring-2 focus-visible:ring-primary/70 rounded-2xl outline-none"
              role={hasEmbeddedCompanionControl ? "group" : "button"}
              tabIndex={companionPortraitIsInteractive ? 0 : -1}
              aria-label={
                imageError
                  ? `${displayedCreatureName} image is unavailable. Retry the image below.`
                  : inlineEvolutionReplay
                    ? `${displayedCreatureName} evolution replay.`
                    : isStageZeroEgg
                  ? `${displayedCreatureName} is waiting to hatch. Tap, double tap, swipe, or press and hold to feel it respond.`
                  : `Interact with ${displayedCreatureName}. Tap different areas, double tap to greet, swipe to pet, or press and hold for comfort.`
              }
              data-testid="living-companion-interaction-target"
              onMouseDown={companionPortraitIsInteractive ? handlePressStart : undefined}
              onMouseUp={companionPortraitIsInteractive ? handlePressEnd : undefined}
              onMouseMove={companionPortraitIsInteractive ? handleCompanionMouseMove : undefined}
              onMouseLeave={companionPortraitIsInteractive ? handleCompanionMouseLeave : undefined}
              onTouchStart={companionPortraitIsInteractive ? handlePressStart : undefined}
              onTouchMove={companionPortraitIsInteractive ? handlePressMove : undefined}
              onTouchEnd={companionPortraitIsInteractive ? handleTouchEnd : undefined}
              onTouchCancel={companionPortraitIsInteractive ? handlePressEnd : undefined}
              onClick={companionPortraitIsInteractive ? handleCompanionImageClick : undefined}
              onDoubleClick={companionPortraitIsInteractive ? livingPresence.greet : undefined}
              onKeyDown={companionPortraitIsInteractive ? handleKeyDown : undefined}
            >
              {experienceMode === "full" ? (
                <>
                  <div className={`absolute inset-0 rounded-2xl ${!prefersReducedMotion ? 'star-shimmer' : ''}`} aria-hidden="true" />
                  <div className={`absolute inset-0 bg-gradient-to-br from-nebula-pink/30 to-celestial-blue/30 rounded-2xl blur-xl ${!prefersReducedMotion ? 'animate-pulse' : ''}`} aria-hidden="true" />
                </>
              ) : (
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 via-transparent to-emerald-700/10 blur-xl" aria-hidden="true" />
              )}
              <div
                className={cn(
                  "relative overflow-hidden rounded-2xl",
                  portraitFrameSizeClass,
                  shouldAnimateIdleDrift && "animate-companion-idle-drift",
                )}
                style={portraitFrameStyle}
                data-testid="companion-image-shell"
                data-companion-idle-motion={shouldAnimateIdleDrift ? "active" : "inactive"}
                data-companion-frame-mode={usesGeneratedSceneShell ? "generated-scene" : "square"}
                data-companion-expression-mood={expressionState.mood}
                data-companion-expression-variant={expressionState.variant}
                data-companion-expression-reason={expressionState.reason}
                data-living-body-language={livingPresence.bodyLanguage}
              >
                <CompanionMotionSurface
                  variant="companion"
                  stage={displayCompanion.current_stage}
                  element={displayCompanion.core_element}
                  event={companionMotionEvent}
                  primaryColor={companionPalette.accentText}
                  secondaryColor={companionPalette.badgeText}
                  className="h-full w-full rounded-2xl"
                  contentClassName="flex items-center justify-center"
                >
                  <>
                    {!imageLoaded && !imageError && (
                      <div
                        className="relative h-full w-full rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 animate-pulse flex items-center justify-center"
                        role="status"
                        aria-live="polite"
                        aria-label="Loading companion image"
                      >
                        <Sparkles className="h-12 w-12 text-primary/50 animate-spin" aria-hidden="true" />
                        <span className="sr-only">Loading companion image</span>
                      </div>
                    )}
                    {imageError && (
                      <div
                        className="relative h-full w-full rounded-2xl bg-gradient-to-br from-destructive/20 to-destructive/10 flex items-center justify-center border-2 border-destructive/30"
                        role="alert"
                        aria-live="assertive"
                      >
                        <div className="text-center p-4">
                          <p className="text-sm text-muted-foreground mb-2" id="image-error-message">Image unavailable</p>
                          <button
                            data-companion-subcontrol="true"
                            onMouseDown={(event) => event.stopPropagation()}
                            onTouchStart={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              setImageError(false);
                              setImageLoaded(false);
                              setImageKey(prev => prev + 1); // Force image reload with new key
                            }}
                            className="text-xs text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded px-2 py-1"
                            aria-label="Retry loading companion image"
                            aria-describedby="image-error-message"
                          >
                            Try again
                          </button>
                        </div>
                      </div>
                    )}
                    <div
                      data-testid="companion-primary-image-frame"
                      className={cn(
                        "relative h-full w-full overflow-hidden rounded-2xl ring-4 shadow-2xl transition-all duration-500 group-hover:scale-105",
                        imageLoaded ? "opacity-100" : "opacity-0 absolute inset-0",
                        usesGeneratedSceneShell && "bg-black",
                        health.isNeglected ? "ring-destructive/50" : "ring-primary/30",
                        activePortraitAnimationClass,
                      )}
                    >
                      <div className={cn("h-full w-full", portraitSceneContentClassName)}>
                        <LivingCompanionCreatureMotion
                          activeAction={livingPresence.activeAction}
                          gaze={livingPresence.gaze}
                          lifeStage={livingPresence.lifeStage}
                          speciesMotion={livingPresence.speciesMotion}
                          prefersReducedMotion={prefersReducedMotion}
                        >
                          <CompanionImage
                            key={imageKey}
                            src={effectiveImageUrl}
                            alt={experienceMode === "formation"
                              ? `${visualStageLabel} companion`
                              : `${visualStageLabel} companion at level ${earnedLevel}`}
                            fit={portraitImageFit}
                            element={displayCompanion.core_element}
                            focalX={effectiveImageFocal.x}
                            focalY={effectiveImageFocal.y}
                            sourceAspectRatio={portraitSourceAspectRatio}
                            className="relative h-full w-full rounded-2xl"
                            style={{ ...skinStyles, ...careStyles, ...equippedCosmeticStyles }}
                            onLoad={handlePortraitImageLoad}
                            onError={() => {
                              setPortraitSourceAspectRatio(null);
                              if (activeFormationStillUrl) {
                                setFailedFormationStillUrl(activeFormationStillUrl);
                                setImageKey((prev) => prev + 1);
                                return;
                              }
                              if (!fallbackToDefaultPortrait && expressiveImageUrl) {
                                setFallbackToDefaultPortrait(true);
                                setImageKey((prev) => prev + 1);
                                return;
                              }
                              setImageError(true);
                              setImageLoaded(false);
                            }}
                            loading="lazy"
                            decoding="async"
                            draggable={false}
                          />
                        </LivingCompanionCreatureMotion>
                      </div>
                    </div>
                  </>
                </CompanionMotionSurface>
                {!inlineEvolutionReplay && !cosmiqAgendaPlayback ? (
                  <LivingCompanionInteractionAura
                    bodyLanguage={livingPresence.bodyLanguage}
                    interactionNonce={livingPresence.interactionNonce}
                    prefersReducedMotion={prefersReducedMotion}
                    gaze={livingPresence.gaze}
                    interactionPoint={livingPresence.interactionPoint}
                    activeAction={livingPresence.activeAction}
                    stage={livingPresence.lifeStage.visualStage}
                  />
                ) : null}
                {inlineEvolutionReplay ? (
                  <div
                    className="absolute inset-0 z-30 overflow-hidden rounded-2xl bg-black shadow-2xl ring-4 ring-primary/30"
                    data-testid="companion-inline-evolution-replay"
                  >
                    <video
                      src={inlineEvolutionReplay.videoUrl}
                      poster={inlineEvolutionReplay.posterUrl}
                      className="h-full w-full rounded-2xl bg-black object-contain"
                      autoPlay
                      muted
                      playsInline
                      data-testid="companion-inline-evolution-video"
                      aria-label={`Stage ${inlineEvolutionReplay.stage} evolution replay`}
                      onEnded={finishInlineEvolutionReplay}
                      onError={finishInlineEvolutionReplay}
                    />
                    <Button
                      data-companion-subcontrol="true"
                      type="button"
                      size="sm"
                      variant="outline"
                      className="absolute right-3 top-3 h-8 rounded-full border-white/20 bg-black/45 px-3 text-xs text-white backdrop-blur-md hover:bg-black/60"
                      onMouseDown={(event) => event.stopPropagation()}
                      onTouchStart={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        finishInlineEvolutionReplay();
                      }}
                    >
                      Skip
                    </Button>
                  </div>
                ) : null}
                {cosmiqAgendaPlayback && isVisible ? (
                  <div
                    className="absolute inset-0 z-30 overflow-hidden rounded-2xl bg-black/90 shadow-2xl ring-4 ring-primary/25"
                    data-testid="cosmiq-agenda-animation"
                  >
                    <video
                      key={cosmiqAgendaPlayback.videoUrl}
                      src={cosmiqAgendaPlayback.videoUrl}
                      poster={effectiveImageUrl}
                      className="h-full w-full rounded-2xl bg-black object-contain"
                      autoPlay
                      muted
                      playsInline
                      aria-label={`${cosmiqAgendaPlayback.label} companion animation`}
                      onEnded={finishCosmiqAgendaPlayback}
                      onError={finishCosmiqAgendaPlayback}
                    />
                    <Button
                      data-companion-subcontrol="true"
                      type="button"
                      size="sm"
                      variant="outline"
                      className="absolute right-3 top-3 h-8 rounded-full border-white/20 bg-black/45 px-3 text-xs text-white backdrop-blur-md hover:bg-black/60"
                      onClick={finishCosmiqAgendaPlayback}
                    >
                      Skip
                    </Button>
                  </div>
                ) : null}
                {formationVideoPlaying && formationMedia ? (
                  formationMedia.videoUrl ? (
                    <div
                      className="absolute inset-0 z-30 overflow-hidden rounded-2xl bg-black/90 shadow-2xl ring-4 ring-primary/25"
                      data-testid="graceward-formation-animation"
                    >
                      <video
                        key={formationMedia.videoUrl}
                        src={formationMedia.videoUrl}
                        poster={effectiveImageUrl}
                        className="h-full w-full rounded-2xl bg-black object-contain"
                        autoPlay
                        muted
                        playsInline
                        aria-label={`${formationMedia.category} companion formation animation`}
                        onLoadedMetadata={(event) => {
                          event.currentTarget.playbackRate = formationMedia.phase === "practice" ? 1.25 : 1.15;
                        }}
                        onEnded={finishFormationPlayback}
                        onError={finishFormationPlayback}
                      />
                      <Button
                        data-companion-subcontrol="true"
                        type="button"
                        size="sm"
                        variant="outline"
                        className="absolute right-3 top-3 h-8 rounded-full border-white/20 bg-black/45 px-3 text-xs text-white backdrop-blur-md hover:bg-black/60"
                        onClick={finishFormationPlayback}
                      >
                        Skip
                      </Button>
                    </div>
                  ) : null
                ) : null}
                {formationMedia && !formationMedia.videoUrl ? (
                  <div
                    className="pointer-events-none absolute inset-0 z-20 flex items-end justify-center rounded-2xl bg-gradient-to-t from-black/35 via-transparent to-transparent pb-3"
                    data-testid="graceward-formation-fallback"
                    role="img"
                    aria-label={`${formationMedia.category} companion ${FORMATION_FALLBACK_PROPS[formationMedia.category].label}`}
                  >
                    <div
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border border-white/20 bg-black/45 px-3 py-1.5 text-2xl shadow-lg backdrop-blur-md",
                        formationVideoPlaying && "animate-bounce",
                      )}
                    >
                      <span aria-hidden="true">{FORMATION_FALLBACK_PROPS[formationMedia.category].primary}</span>
                      <span className="text-lg" aria-hidden="true">
                        {FORMATION_FALLBACK_PROPS[formationMedia.category].secondary}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
              {/* Dormancy warning component */}
              <DormancyWarning 
                show={hasDormancyWarning && !isDormant}
                daysUntilDormancy={care.dormancy.daysUntilDormancy ?? undefined}
              />
              {/* Dormant overlay component */}
              <DormantOverlay 
                isDormant={care.dormancy.isDormant}
                recoveryDays={care.dormancy.recoveryDays}
                daysUntilWake={care.dormancy.daysUntilWake}
              />
            </div>
            {!inlineEvolutionReplay && !cosmiqAgendaPlayback ? (
              <LivingCompanionPresenceBubble
                prompt={livingPresence.prompt}
                companionName={displayedCreatureName}
                prefersReducedMotion={prefersReducedMotion}
                onDismiss={livingPresence.dismissPrompt}
                onAnswer={livingPresence.answerQuestion}
              />
            ) : null}
          </div>

          {PRODUCT.mode === "christian" && !isStageZeroEgg ? (
            <GracewardDailyFormationBoard
              companion={displayCompanion}
              onFormationMediaChange={handleFormationMediaChange}
            />
          ) : null}

          {!isStageZeroEgg && experienceMode === "full" ? (
            <div className="space-y-3 text-center">
              <p
                className="text-[11px] font-medium text-muted-foreground/85"
                data-testid="living-companion-state-label"
              >
                {livingPresence.stateLabel}
              </p>
              <div className="flex justify-center" data-testid="living-companion-secondary-actions">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-9 rounded-full px-3 text-xs text-muted-foreground hover:bg-primary/[0.08] hover:text-foreground"
                  onClick={() => void handleEvolutionReplay()}
                  disabled={Boolean(inlineEvolutionReplay)}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Replay evolution
                </Button>
              </div>
            </div>
          ) : null}

          {experienceMode === "full" ? (
            <LivingCompanionWorldPulse
              lifeStage={livingPresence.lifeStage}
              speciesMotion={livingPresence.speciesMotion}
              stateLabel={livingPresence.stateLabel}
              activeActionLabel={livingPresence.activeActionLabel}
            />
          ) : null}

          <div className="space-y-3">
            <div className="flex justify-center items-center gap-3 mb-3 flex-wrap">
              <CompanionBadge 
                element={displayCompanion.core_element} 
                stage={displayCompanion.current_stage}
                showStage={true}
                favoriteColor={displayCompanion.favorite_color}
                companionId={displayCompanion.id}
              />
              <Badge
                data-testid="companion-level-chip"
                variant="outline"
                className="px-3 py-1 text-xs font-medium"
                style={{
                  background: companionPalette.badgeBg,
                  borderColor: companionPalette.badgeBorder,
                  color: companionPalette.badgeText,
                  boxShadow: `0 0 16px ${companionPalette.glow}`,
                }}
              >
                {experienceMode === "formation" ? formationStageDisplay : currentLevelLabel}
              </Badge>
              {experienceMode === "full" ? <CompanionBondBadge /> : null}
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground mb-2" id="xp-progress-label">
                {isMaxStage
                  ? experienceMode === "formation" ? "Fully grown" : `${currentLevelLabel} maxed`
                  : displayCanEvolve && readyEvolutionCopy
                    ? readyEvolutionCopy
                    : experienceMode === "formation"
                      ? `${displayCompanion.current_xp} / ${safeNextEvolutionXP} ${PRODUCT_COPY.growthLabel} toward ${nextVisualStageLabel ?? "the next form"}`
                      : `${displayCompanion.current_xp} / ${safeNextEvolutionXP} ${PRODUCT_COPY.growthLabel} to ${nextLevelLabel}`}
              </p>
              <Progress 
                value={displayedProgressValue}
                className="h-3 rounded-full shadow-inner" 
                aria-labelledby="xp-progress-label"
                aria-valuenow={displayedProgressValue}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            
            {experienceMode === "full" ? <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="text-center p-3 rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/10 hover:border-primary/30 transition-all">
                <p className="text-xs text-muted-foreground mb-1">Color</p>
                <p className="font-medium text-sm">{colorName}</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-gradient-to-br from-accent/5 to-primary/5 border border-accent/10 hover:border-accent/30 transition-all">
                <p className="text-xs text-muted-foreground mb-1">Spirit</p>
                <p className="font-medium text-sm">{formatDisplayLabel(displayCompanion.spirit_animal)}</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/10 hover:border-primary/30 transition-all">
                <p className="text-xs text-muted-foreground mb-1">Element</p>
                <p className="font-medium text-sm">{formatDisplayLabel(displayCompanion.core_element)}</p>
              </div>
            </div> : null}

            {/* Detailed attributes are a Cosmiq analysis surface, not part of Graceward's daily ritual. */}
            {experienceMode === "full" && PRODUCT.mode === "cosmiq" ? (
              <CompanionAttributes companion={displayCompanion} />
            ) : null}

            {experienceMode === "full" && PRODUCT.mode === "cosmiq" ? <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="companion-stats-analysis-trigger"
              className="mt-3 w-full border-primary/20 bg-primary/5 text-foreground hover:bg-primary/10"
              onClick={() => setShowStatsAnalysis(true)}
            >
              <Sparkles className="h-4 w-4 text-primary" />
              Analyze My Stats
            </Button> : null}
          </div>

          {/* Evolution Path Badge - visible indicator of care patterns */}
          {experienceMode === "full" ? <div className="flex items-center justify-center gap-3">
            {evolutionPath.path && (
              <EvolutionPathBadge 
                path={evolutionPath.path} 
                isLocked={evolutionPath.isLocked}
              />
            )}
          </div> : null}

          {experienceMode === "full" ? <CompanionDialogue
            className="mt-2"
            companionName={displayedCreatureName}
            companionOverride={displayCompanion}
            progressToNextOverride={displayProgressToNext}
            canEvolveOverride={displayCanEvolve}
          /> : null}

          {/* Evolve Button - shows when ready */}
          <div data-tutorial-avoid="true">
            <AnimatePresence>
              {displayCanEvolve && (
                <EvolveButton
                  onEvolve={handleEvolvePress}
                  isEvolving={isManualEvolutionStarting || isEvolutionBusy || isPendingRevealPreparing}
                  actionLabel={isPendingRevealReady ? "REVEAL" : isStageZeroEgg ? "HATCH" : "EVOLVE"}
                  loadingLabel={isPendingRevealDisplay ? "PREPARING..." : isStageZeroEgg ? "HATCHING..." : "EVOLVING..."}
                  durationLabel={isPendingRevealDisplay ? "Rendering the reveal video. This can take a few minutes." : undefined}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </Card>

      {/* Welcome Back Modal */}
      <WelcomeBackModal 
        isOpen={showWelcomeBack} 
        onClose={() => {
          setShowWelcomeBack(false);
          setWelcomeBackDismissed(true);
        }} 
      />

      {/* Wake-Up Celebration Modal */}
      <WakeUpCelebration
        isOpen={showWakeUpCelebration}
        onClose={dismissWakeUpCelebration}
        companionName={wakeUpCompanionName}
        companionImageUrl={wakeUpCompanionImageUrl}
        companionImageFocalX={wakeUpCompanionImageFocalX}
        companionImageFocalY={wakeUpCompanionImageFocalY}
        dormantImageUrl={wakeUpDormantImageUrl}
        dormantImageFocalX={wakeUpDormantImageFocalX}
        dormantImageFocalY={wakeUpDormantImageFocalY}
        bondLevel={wakeUpBondLevel}
      />

      {showStatsAnalysis ? (
        <CompanionStatAnalysisSurface
          open={showStatsAnalysis}
          onOpenChange={setShowStatsAnalysis}
          layoutMode={layoutMode}
        />
      ) : null}

      <Dialog open={hatchDialogOpen} onOpenChange={setHatchDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-heading font-black">
              Choose The Hatch
            </DialogTitle>
          </DialogHeader>
          {companion ? (
            <CompanionPersonalization
              onComplete={handleHatchSelection}
              mode="hatch"
              layout="compact"
              initialElement={companion.core_element as CompanionElementId}
              initialStoryTone={(companion.story_tone ?? "epic_adventure") as CompanionStoryTone}
              initialCompanionName={companion.companion_name ?? null}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
});

CompanionDisplay.displayName = 'CompanionDisplay';
