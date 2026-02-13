import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sparkles, AlertTriangle, Heart, Moon } from "lucide-react";
import { useCompanion } from "@/hooks/useCompanion";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { useReferrals } from "@/hooks/useReferrals";
import { useCompanionHealth } from "@/hooks/useCompanionHealth";
import { useCompanionVisualState } from "@/hooks/useCompanionVisualState";
import { useCompanionRegenerate } from "@/hooks/useCompanionRegenerate";
import { useCompanionWakeUp } from "@/hooks/useCompanionWakeUp";
import { useEpicRewards } from "@/hooks/useEpicRewards";
import { useEvolution } from "@/contexts/EvolutionContext";
import { CompanionSkeleton } from "@/components/CompanionSkeleton";
import { AttributeTooltip } from "@/components/AttributeTooltip";
import { CompanionBadge } from "@/components/CompanionBadge";
import { CompanionBondBadge } from "@/components/companion/CompanionBondBadge";
import { WelcomeBackModal } from "@/components/WelcomeBackModal";
import { CompanionRegenerateDialog } from "@/components/CompanionRegenerateDialog";
import { EvolveButton } from "@/components/companion/EvolveButton";
import { EvolutionPathBadge } from "@/components/companion/EvolutionPathBadge";
import { DormancyWarning, DormantOverlay } from "@/components/companion/DormancyWarning";
import { CompanionDialogue } from "@/components/companion/CompanionDialogue";
import { WakeUpCelebration } from "@/components/companion/WakeUpCelebration";
import { NursingMode } from "@/components/companion/NursingMode";
import { CompanionAttributes } from "@/components/CompanionAttributes";
import { AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
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
} from "react";
import { getStageName } from "@/config/companionStages";

const LONG_PRESS_DURATION_MS = 800;
const MOVE_CANCEL_THRESHOLD_PX = 12;
const COMPANION_PLACEHOLDER = "/placeholder-companion.svg";

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

export const CompanionDisplay = memo(() => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { companion, nextEvolutionXP, progressToNext, evolveCompanion, isLoading, error, canEvolve, triggerManualEvolution } = useCompanion();
  const { unlockedSkins } = useReferrals();
  const { health, needsWelcomeBack } = useCompanionHealth();
  const { regenerate, isRegenerating, maxRegenerations, generationPhase, retryCount } = useCompanionRegenerate();
  const { equippedRewards } = useEpicRewards();
  const { isEvolvingLoading } = useEvolution();
  
  // Wake-up celebration detection
  const {
    showCelebration: showWakeUpCelebration,
    dismissCelebration: dismissWakeUpCelebration,
    companionName: wakeUpCompanionName,
    companionImageUrl: wakeUpCompanionImageUrl,
    dormantImageUrl: wakeUpDormantImageUrl,
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
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageKey, setImageKey] = useState(0); // Force image reload
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [welcomeBackDismissed, setWelcomeBackDismissed] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [creatureName, setCreatureName] = useState<string | null>(null);
  
  // Long press detection refs
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPressing = useRef(false);
  const touchStartPoint = useRef<{ x: number; y: number } | null>(null);
  const previousImageUrl = useRef<string | null>(null);
  const regenerationsUsed = companion?.image_regenerations_used ?? 0;
  const regenerationsRemaining = Math.max(0, maxRegenerations - regenerationsUsed);
  
  // Long press handlers for hidden regenerate feature
  const handlePressStart = useCallback((
    event: ReactMouseEvent<HTMLDivElement> | ReactTouchEvent<HTMLDivElement>
  ) => {
    if (!companion || isRegenerating || regenerationsRemaining <= 0) return;
    
    if ("touches" in event && event.touches[0]) {
      const touch = event.touches[0];
      touchStartPoint.current = { x: touch.clientX, y: touch.clientY };
    } else {
      touchStartPoint.current = null;
    }
    
    isLongPressing.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPressing.current = true;
      setShowRegenerateDialog(true);
    }, LONG_PRESS_DURATION_MS);
  }, [companion, isRegenerating, regenerationsRemaining]);
  
  const handlePressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchStartPoint.current = null;
  }, []);

  const handlePressMove = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    if (!touchStartPoint.current || !longPressTimer.current) return;
    const touch = event.touches[0];
    if (!touch) return;

    const deltaX = Math.abs(touch.clientX - touchStartPoint.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartPoint.current.y);

    if (deltaX > MOVE_CANCEL_THRESHOLD_PX || deltaY > MOVE_CANCEL_THRESHOLD_PX) {
      handlePressEnd();
    }
  }, [handlePressEnd]);

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (!companion || isRegenerating || regenerationsRemaining <= 0) return;
    setShowRegenerateDialog(true);
  }, [companion, isRegenerating, regenerationsRemaining]);
  
  const handleRegenerateConfirm = useCallback(() => {
    if (!companion) return;
    regenerate({
      id: companion.id,
      spirit_animal: companion.spirit_animal,
      core_element: companion.core_element,
      favorite_color: companion.favorite_color,
      current_stage: companion.current_stage,
      eye_color: companion.eye_color,
      fur_color: companion.fur_color,
    });
    setShowRegenerateDialog(false);
  }, [companion, regenerate]);

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
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Show welcome back modal if user has been inactive
  useEffect(() => {
    if (needsWelcomeBack && !welcomeBackDismissed && companion) {
      setShowWelcomeBack(true);
    }
  }, [needsWelcomeBack, welcomeBackDismissed, companion]);

  // Calculate effective image URL (must be before the useEffect that depends on it)
  // Priority: dormant image > neglected image > current image
  const displayImageUrl = useMemo(() => {
    if (isDormant && companion?.dormant_image_url) {
      return companion.dormant_image_url;
    }
    if (health.isNeglected && health.neglectedImageUrl) {
      return health.neglectedImageUrl;
    }
    return companion?.current_image_url;
  }, [isDormant, companion?.dormant_image_url, health.isNeglected, health.neglectedImageUrl, companion?.current_image_url]);
  
  const effectiveImageUrl = displayImageUrl || COMPANION_PLACEHOLDER;

  // Track image URL changes to reset loading state
  useEffect(() => {
    if (previousImageUrl.current === effectiveImageUrl) return;
    previousImageUrl.current = effectiveImageUrl;
    setImageLoaded(false);
    setImageError(false);
  }, [effectiveImageUrl]);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  // Fetch creature name from evolution cards if not cached
  useEffect(() => {
    const fetchCreatureName = async () => {
      if (!companion) return;
      
      // Use cached name if available
      if (companion.cached_creature_name) {
        setCreatureName(companion.cached_creature_name);
        return;
      }
      
      // Fetch from evolution cards
      const { data } = await supabase
        .from('companion_evolution_cards')
        .select('creature_name')
        .eq('companion_id', companion.id)
        .eq('evolution_stage', companion.current_stage)
        .maybeSingle();
      
      if (data?.creature_name) {
        setCreatureName(data.creature_name);
        // Cache it for next time (fire and forget)
        supabase
          .from('user_companion')
          .update({ cached_creature_name: data.creature_name })
          .eq('id', companion.id);
      } else {
        // Final fallback to capitalized spirit animal
        setCreatureName(
          companion.spirit_animal.charAt(0).toUpperCase() + 
          companion.spirit_animal.slice(1)
        );
      }
    };
    
    fetchCreatureName();
  }, [companion?.id, companion?.current_stage, companion?.cached_creature_name]);

  if (isLoading) return <CompanionSkeleton />;
  if (!companion) return null;

  const stageName = getStageName(companion.current_stage);
  const colorName = getColorName(companion.favorite_color);
  const safeNextEvolutionXP = nextEvolutionXP ?? companion.current_xp;
  const isMaxStage = companion.current_stage >= 20;

  return (
    <>
      <Card className="relative overflow-hidden bg-card/25 backdrop-blur-2xl border-celestial-blue/20 hover:border-nebula-pink/40 transition-all duration-500 animate-scale-in">
        {/* Equipped background or default nebula gradients */}
        {equippedBackgroundStyle ? (
          <div 
            className="absolute inset-0 opacity-70 transition-opacity duration-500" 
            style={{ background: equippedBackgroundStyle }}
          />
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-nebula-pink/10 via-celestial-blue/10 to-cosmiq-glow/10 opacity-60 animate-nebula-shift" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--celestial-blue)/0.2),transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,hsl(var(--nebula-pink)/0.2),transparent_50%)]" />
          </>
        )}
        
        <div className="relative p-6 space-y-6">
          {/* Stage Badge */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center">
                <h2 className={`text-3xl font-heading font-black bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent ${!prefersReducedMotion ? 'animate-gradient' : ''}`}>
                  {stageName}
                </h2>
                <AttributeTooltip title="Stage" description="Your companion's evolution stage" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">
                Stage {companion.current_stage}
              </p>
            </div>
            <div className={`h-14 w-14 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center shadow-glow ${!prefersReducedMotion ? 'animate-pulse' : ''}`} aria-hidden="true">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
          </div>

          {/* Companion Name - Centered */}
          <p className="text-center text-2xl font-semibold text-primary/90 tracking-wide -mt-1">
            {creatureName || 'Companion'}
          </p>

          {/* Companion Image */}
          <div className="flex justify-center py-2 relative group" role="img" aria-label={`Your companion at stage ${companion.current_stage}: ${stageName}`}>
            {/* Cosmiq orbital glow effect */}
            <div 
              className={`absolute inset-0 blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-500 ${prefersReducedMotion ? 'animate-none' : 'animate-orbit'}`}
              style={{
                background: `radial-gradient(circle, hsl(var(--celestial-blue) / ${(companion.vitality ?? 300) / 600}), hsl(var(--nebula-pink) / ${(companion.vitality ?? 300) / 600}), transparent)`,
              }}
              aria-hidden="true" 
            />
            <div className={`absolute inset-0 bg-gradient-to-r from-celestial-blue/20 via-nebula-pink/20 to-cosmiq-glow/20 blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-500 ${prefersReducedMotion ? 'animate-none' : ''}`} aria-hidden="true" />
            <div 
              className="relative select-none focus-visible:ring-2 focus-visible:ring-primary/70 rounded-2xl outline-none"
              role="button"
              tabIndex={0}
              aria-label={`Press and hold to refresh your companion's look. ${regenerationsRemaining} look refresh${regenerationsRemaining === 1 ? '' : 'es'} remaining.`}
              onMouseDown={handlePressStart}
              onMouseUp={handlePressEnd}
              onMouseLeave={handlePressEnd}
              onTouchStart={handlePressStart}
              onTouchMove={handlePressMove}
              onTouchEnd={handlePressEnd}
              onTouchCancel={handlePressEnd}
              onKeyDown={handleKeyDown}
            >
              {/* Twinkling star particles around companion */}
              <div className={`absolute inset-0 rounded-2xl ${!prefersReducedMotion ? 'star-shimmer' : ''}`} aria-hidden="true" />
              <div className={`absolute inset-0 bg-gradient-to-br from-nebula-pink/30 to-celestial-blue/30 rounded-2xl blur-xl ${!prefersReducedMotion ? 'animate-pulse' : ''}`} aria-hidden="true" />
              {!imageLoaded && !imageError && (
                <div className="relative w-64 h-64 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 animate-pulse flex items-center justify-center" role="status" aria-live="polite" aria-label="Loading companion image">
                  <Sparkles className="h-12 w-12 text-primary/50 animate-spin" aria-hidden="true" />
                  <span className="sr-only">Loading companion image</span>
                </div>
              )}
              {imageError && (
                <div className="relative w-64 h-64 rounded-2xl bg-gradient-to-br from-destructive/20 to-destructive/10 flex items-center justify-center border-2 border-destructive/30" role="alert" aria-live="assertive">
                  <div className="text-center p-4">
                    <p className="text-sm text-muted-foreground mb-2" id="image-error-message">Image unavailable</p>
                    <button 
                      onClick={() => {
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
              <img
                key={imageKey}
                src={effectiveImageUrl}
                alt={`${stageName} companion at stage ${companion.current_stage}`}
                className={`relative w-64 h-64 object-cover rounded-2xl shadow-2xl ring-4 transition-all duration-500 group-hover:scale-105 ${imageLoaded ? 'opacity-100' : 'opacity-0 absolute'} ${health.isNeglected ? 'ring-destructive/50' : 'ring-primary/30'} ${isRegenerating ? 'animate-pulse' : ''} ${animationClass}`}
                style={{ ...skinStyles, ...careStyles, ...equippedCosmeticStyles }}
                onLoad={() => {
                  setImageLoaded(true);
                  setImageError(false);
                }}
                onError={() => {
                  setImageError(true);
                  setImageLoaded(false);
                }}
                loading="lazy"
                decoding="async"
                draggable={false}
              />
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
          </div>

          <div className="space-y-3">
            <div className="flex justify-center items-center gap-3 mb-3 flex-wrap">
              <CompanionBadge 
                element={companion.core_element} 
                stage={companion.current_stage}
                showStage={true}
              />
              <CompanionBondBadge />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground mb-2" id="xp-progress-label">
                {isMaxStage
                  ? `Stage ${companion.current_stage} maxed`
                  : `${companion.current_xp} / ${safeNextEvolutionXP} XP to next evolution`}
              </p>
              <Progress 
                value={progressToNext} 
                className="h-3 rounded-full shadow-inner" 
                aria-labelledby="xp-progress-label"
                aria-valuenow={companion.current_xp}
                aria-valuemin={0}
                aria-valuemax={safeNextEvolutionXP}
              />
            </div>
            
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="text-center p-3 rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/10 hover:border-primary/30 transition-all">
                <p className="text-xs text-muted-foreground mb-1">Color</p>
                <p className="font-medium text-sm">{colorName}</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-gradient-to-br from-accent/5 to-primary/5 border border-accent/10 hover:border-accent/30 transition-all">
                <p className="text-xs text-muted-foreground mb-1">Spirit</p>
                <p className="font-medium text-sm capitalize">{companion.spirit_animal}</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/10 hover:border-primary/30 transition-all">
                <p className="text-xs text-muted-foreground mb-1">Element</p>
                <p className="font-medium text-sm capitalize">{companion.core_element}</p>
              </div>
            </div>

            {/* 7-Stat Companion Attributes Grid */}
            <CompanionAttributes companion={companion} />
          </div>

          {/* Evolution Path Badge - visible indicator of care patterns */}
          <div className="flex items-center justify-center gap-3">
            {evolutionPath.path && (
              <EvolutionPathBadge 
                path={evolutionPath.path} 
                isLocked={evolutionPath.isLocked}
              />
            )}
          </div>

          {/* Companion Dialogue - emotional responses based on care signals */}
          <CompanionDialogue showBondInfo className="mt-2" />

          {/* Evolve Button - shows when ready */}
          <AnimatePresence>
            {canEvolve && (
              <EvolveButton 
                onEvolve={triggerManualEvolution}
                isEvolving={evolveCompanion.isPending}
              />
            )}
          </AnimatePresence>
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
        dormantImageUrl={wakeUpDormantImageUrl}
        bondLevel={wakeUpBondLevel}
      />

      {/* Hidden Regenerate Dialog */}
      <CompanionRegenerateDialog
        isOpen={showRegenerateDialog}
        onClose={() => setShowRegenerateDialog(false)}
        onConfirm={handleRegenerateConfirm}
        isRegenerating={isRegenerating}
        regenerationsRemaining={regenerationsRemaining}
        generationPhase={generationPhase}
        retryCount={retryCount}
      />
    </>
  );
});

CompanionDisplay.displayName = 'CompanionDisplay';
