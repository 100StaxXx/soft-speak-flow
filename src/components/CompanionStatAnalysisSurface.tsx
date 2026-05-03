import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  BarChart3,
  Brain,
  Compass,
  Flame,
  HeartPulse,
  ImageIcon,
  Palette,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
import type { CompanionLayoutMode } from "@/hooks/useCompanionLayoutMode";
import {
  type CompanionStatAnalysis,
  type CompanionStatAttribute,
  type CompanionStatBand,
  type CompanionStatBreakdown,
  useCompanionStatAnalysis,
} from "@/hooks/useCompanionStatAnalysis";
import { cn } from "@/lib/utils";
import {
  COMPANION_STAT_ANALYSIS_PRELUDE_CARDS,
  type CompanionStatAnalysisPreludeCard,
} from "@/shared/companionStatAnalysisPreludeCards";

interface CompanionStatAnalysisSurfaceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layoutMode: CompanionLayoutMode;
}

const ATTRIBUTE_META: Record<
  CompanionStatAttribute,
  { label: string; icon: typeof HeartPulse; accentClassName: string; gradientClassName: string }
> = {
  vitality: {
    label: "Vitality",
    icon: HeartPulse,
    accentClassName: "text-rose-300",
    gradientClassName: "from-rose-500/20 to-red-500/10",
  },
  wisdom: {
    label: "Wisdom",
    icon: Brain,
    accentClassName: "text-sky-300",
    gradientClassName: "from-sky-500/20 to-cyan-500/10",
  },
  discipline: {
    label: "Discipline",
    icon: ShieldCheck,
    accentClassName: "text-amber-300",
    gradientClassName: "from-amber-500/20 to-yellow-500/10",
  },
  resolve: {
    label: "Resolve",
    icon: Flame,
    accentClassName: "text-orange-300",
    gradientClassName: "from-orange-500/20 to-red-500/10",
  },
  creativity: {
    label: "Creativity",
    icon: Palette,
    accentClassName: "text-fuchsia-300",
    gradientClassName: "from-fuchsia-500/20 to-pink-500/10",
  },
  alignment: {
    label: "Alignment",
    icon: Compass,
    accentClassName: "text-emerald-300",
    gradientClassName: "from-emerald-500/20 to-teal-500/10",
  },
};

const ATTRIBUTE_ORDER: CompanionStatAttribute[] = [
  "vitality",
  "wisdom",
  "discipline",
  "resolve",
  "creativity",
  "alignment",
];

const STAT_MIN = 100;
const STAT_MAX = 1000;
const EMPTY_IMAGE_URLS: string[] = [];
const TITLE_ART_SLIDE_INTERVAL_MS = 1_800;
const TITLE_ART_SLIDES_BEFORE_REVEAL = 2;
const TITLE_ART_REVEAL_SETTLE_MS = 900;

const RANK_BY_BAND: Record<CompanionStatBand, string> = {
  Emerging: "C",
  Building: "B",
  Strong: "A",
  Exceptional: "S",
};

const rankClassName = (rank: string) =>
  ({
    S: "border-yellow-300/50 bg-yellow-300/12 text-yellow-200",
    A: "border-sky-300/45 bg-sky-300/12 text-sky-200",
    B: "border-emerald-300/45 bg-emerald-300/12 text-emerald-200",
    C: "border-muted-foreground/30 bg-muted/30 text-muted-foreground",
  })[rank] ?? "border-border bg-background text-foreground";

const revealContainerVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.28,
      ease: "easeOut",
      staggerChildren: 0.045,
    },
  },
};

const revealItemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: "easeOut" },
  },
};

const ACTIVITY_FIELDS: Array<{
  key: keyof CompanionStatAnalysis["activitySnapshot"];
  label: string;
}> = [
  { key: "morningCheckIns", label: "Morning check-ins" },
  { key: "eveningReflections", label: "Evening reflections" },
  { key: "habitCompletions", label: "Habit completions" },
  { key: "onTimeTasks", label: "On-time tasks" },
  { key: "trackedAttributeEvents", label: "Tracked boosts" },
  { key: "streakMilestones", label: "Streak milestones" },
  { key: "hardTaskWins", label: "Hard task wins" },
  { key: "recoveryActions", label: "Recovery actions" },
  { key: "healthActions", label: "Health actions" },
  { key: "creativeActions", label: "Creative actions" },
  { key: "relationshipActions", label: "Relationship actions" },
  { key: "bounceBackDays", label: "Bounce-back days" },
];

const formatRange = (startDate: string, endDate: string) => {
  if (startDate === endDate) return startDate;
  return `${startDate} to ${endDate}`;
};

const formatSnakeLabel = (value: string) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getScorePercent = (score: number) =>
  Math.max(0, Math.min(100, Math.round(((score - STAT_MIN) / (STAT_MAX - STAT_MIN)) * 100)));

interface CompanionStatCardViewModel {
  attribute: CompanionStatAttribute;
  label: string;
  score: number;
  percent: number;
  band: CompanionStatBand;
  rank: string;
  status: string;
  reasons: string[];
  drivers: CompanionStatBreakdown["recentDrivers"];
}

export const buildCompanionStatAnalysisViewModel = (analysis: CompanionStatAnalysis) => {
  const breakdownByAttribute = new Map(
    analysis.statBreakdowns.map((breakdown) => [breakdown.attribute, breakdown]),
  );
  const statCards = ATTRIBUTE_ORDER.map((attribute) => {
    const breakdown = breakdownByAttribute.get(attribute);
    if (!breakdown) {
      throw new Error(`Missing stat breakdown for ${attribute}`);
    }

    return {
      attribute,
      label: ATTRIBUTE_META[attribute].label,
      score: breakdown.score,
      percent: getScorePercent(breakdown.score),
      band: breakdown.band,
      rank: RANK_BY_BAND[breakdown.band],
      status: breakdown.status,
      reasons: breakdown.primaryReasons,
      drivers: breakdown.recentDrivers,
    } satisfies CompanionStatCardViewModel;
  });
  const rankedStats = [...statCards].sort((left, right) => {
    const scoreDiff = right.score - left.score;
    if (scoreDiff !== 0) return scoreDiff;
    return ATTRIBUTE_ORDER.indexOf(left.attribute) - ATTRIBUTE_ORDER.indexOf(right.attribute);
  });
  const weakestStat = [...statCards].sort((left, right) => {
    const scoreDiff = left.score - right.score;
    if (scoreDiff !== 0) return scoreDiff;
    return ATTRIBUTE_ORDER.indexOf(left.attribute) - ATTRIBUTE_ORDER.indexOf(right.attribute);
  })[0];
  const dominantLabel = ATTRIBUTE_META[analysis.statProfile.dominantStat].label;
  const secondaryLabel = ATTRIBUTE_META[analysis.statProfile.secondaryStat].label;
  const radarData = ATTRIBUTE_ORDER.map((attribute) => {
    const card = statCards.find((stat) => stat.attribute === attribute);
    if (!card) throw new Error(`Missing radar stat for ${attribute}`);
    return {
      attribute: ATTRIBUTE_META[attribute].label,
      score: card.score,
      percent: card.percent,
    };
  });

  return {
    statCards,
    rankedStats,
    weakestStat,
    dominantLabel,
    secondaryLabel,
    radarData,
    currentBuild: `${dominantLabel} / ${secondaryLabel}`,
  };
};

const mentorAccentStyle = (analysis: CompanionStatAnalysis): CSSProperties | undefined => {
  const color = analysis.mentor.primaryColor;
  if (!color) return undefined;

  return {
    borderColor: `${color}55`,
    boxShadow: `0 16px 32px ${color}22`,
  };
};

const getTitleCardImageUrls = (
  card: CompanionStatAnalysis["cosmiqTitleCard"] | null | undefined,
): string[] => {
  const urls = [
    ...(Array.isArray(card?.imageUrls) ? card.imageUrls : []),
    card?.imageUrl ?? null,
  ].filter((imageUrl): imageUrl is string => typeof imageUrl === "string" && imageUrl.length > 0);

  return Array.from(new Set(urls));
};

const getTitleArtPreviewDwellMs = (imageCount: number): number => {
  if (imageCount <= 1) return 0;
  return (Math.min(TITLE_ART_SLIDES_BEFORE_REVEAL, imageCount - 1) * TITLE_ART_SLIDE_INTERVAL_MS)
    + TITLE_ART_REVEAL_SETTLE_MS;
};

const getTitleArtDiagnosticMessage = ({
  card,
  isTitleArtFallback,
  isRegeneratingTitleCard,
}: {
  card: CompanionStatAnalysis["cosmiqTitleCard"] | null | undefined;
  isTitleArtFallback: boolean;
  isRegeneratingTitleCard: boolean;
}) => {
  if (isRegeneratingTitleCard) return "Regenerating title art.";
  if (card?.failureMessage) return card.failureMessage;
  if (isTitleArtFallback) return "Title art could not load. Tap regenerate to try again.";
  return null;
};

type TitleCardImageGateState = "idle" | "loading" | "loaded" | "failed";

type LoadingStatePhase = "analysis" | "title-card";

interface LoadingStateProps {
  phase?: LoadingStatePhase;
  imageUrl?: string | null;
  imageUrls?: string[];
  titleCardStatus?: NonNullable<CompanionStatAnalysis["cosmiqTitleCard"]>["status"];
  imageState?: TitleCardImageGateState;
  onVerifiedPreviewCountChange?: (verifiedCount: number) => void;
  prefersReducedMotion: boolean;
}

function PreludeCardCarousel({
  activeCard,
  activeIndex,
}: {
  activeCard: CompanionStatAnalysisPreludeCard;
  activeIndex: number;
}) {
  return (
    <div
      data-card-id={activeCard.id}
      data-testid="companion-stat-analysis-prelude-card"
      className="mx-auto w-full max-w-md rounded-lg border border-white/15 bg-background/72 p-4 text-left shadow-2xl backdrop-blur-md"
    >
      <div className="flex items-center justify-between gap-3">
        <Badge className="bg-primary text-primary-foreground">Analyze My Stats</Badge>
        <Badge variant="outline" className="border-white/25 bg-background/50 text-foreground">
          {activeIndex + 1}/{COMPANION_STAT_ANALYSIS_PRELUDE_CARDS.length}
        </Badge>
      </div>
      <div className="mt-5 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Prelude Card</p>
        <h3
          data-testid="companion-stat-analysis-prelude-title"
          className="text-2xl font-semibold leading-tight sm:text-3xl"
        >
          {activeCard.title}
        </h3>
        <p
          data-testid="companion-stat-analysis-prelude-description"
          className="text-sm leading-6 text-muted-foreground"
        >
          {activeCard.description}
        </p>
      </div>
      <div
        aria-label="Analyze My Stats prelude cards"
        className="mt-5 flex gap-1.5"
      >
        {COMPANION_STAT_ANALYSIS_PRELUDE_CARDS.map((card, index) => (
          <span
            key={card.id}
            className={cn(
              "h-1.5 flex-1 rounded-full bg-primary/20 transition-colors",
              index === activeIndex && "bg-primary",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function LoadingState({
  phase = "analysis",
  imageUrl,
  imageUrls = EMPTY_IMAGE_URLS,
  titleCardStatus = "generating",
  imageState = "loading",
  onVerifiedPreviewCountChange,
  prefersReducedMotion,
}: LoadingStateProps) {
  const slideshowUrls = useMemo(() => {
    const urls = [...imageUrls, imageUrl ?? null]
      .filter((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0);
    return Array.from(new Set(urls));
  }, [imageUrl, imageUrls]);
  const slideshowKey = useMemo(() => slideshowUrls.join("|"), [slideshowUrls]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [activePreludeCardIndex, setActivePreludeCardIndex] = useState(0);
  const [loadedPreviewUrls, setLoadedPreviewUrls] = useState<Set<string>>(() => new Set());
  const activeSafePreludeCardIndex =
    activePreludeCardIndex % COMPANION_STAT_ANALYSIS_PRELUDE_CARDS.length;
  const activePreludeCard =
    COMPANION_STAT_ANALYSIS_PRELUDE_CARDS[activeSafePreludeCardIndex]
    ?? COMPANION_STAT_ANALYSIS_PRELUDE_CARDS[0];
  const verifiedSlideshowUrls = useMemo(
    () =>
      slideshowUrls.filter((slideUrl, index) =>
        loadedPreviewUrls.has(slideUrl) || (index === 0 && imageState === "loaded")
      ),
    [imageState, loadedPreviewUrls, slideshowUrls],
  );
  const previewSlideshowUrls = verifiedSlideshowUrls.length > 0
    ? verifiedSlideshowUrls
    : slideshowUrls.slice(0, 1);
  const previewSlideshowKey = useMemo(() => previewSlideshowUrls.join("|"), [previewSlideshowUrls]);
  const verifiedPreviewCount = imageState === "loaded" ? verifiedSlideshowUrls.length : 0;
  const markPreviewUrlLoaded = useCallback((slideUrl: string) => {
    setLoadedPreviewUrls((current) => {
      if (current.has(slideUrl)) return current;
      const next = new Set(current);
      next.add(slideUrl);
      return next;
    });
  }, []);

  useEffect(() => {
    setActiveSlideIndex(0);
    setLoadedPreviewUrls(new Set());
  }, [slideshowKey]);

  useEffect(() => {
    setActivePreludeCardIndex(0);
  }, [phase]);

  useEffect(() => {
    onVerifiedPreviewCountChange?.(verifiedPreviewCount);
  }, [onVerifiedPreviewCountChange, verifiedPreviewCount]);

  useEffect(() => {
    if (prefersReducedMotion || COMPANION_STAT_ANALYSIS_PRELUDE_CARDS.length <= 1) return;

    const intervalId = window.setInterval(() => {
      setActivePreludeCardIndex((current) => (current + 1) % COMPANION_STAT_ANALYSIS_PRELUDE_CARDS.length);
    }, TITLE_ART_SLIDE_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [phase, prefersReducedMotion]);

  useEffect(() => {
    if (phase === "title-card" && imageState === "loaded" && slideshowUrls[0]) {
      markPreviewUrlLoaded(slideshowUrls[0]);
      setActiveSlideIndex(0);
    }
  }, [phase, imageState, markPreviewUrlLoaded, slideshowKey, slideshowUrls]);

  useEffect(() => {
    if (
      phase !== "title-card"
      || imageState !== "loaded"
      || prefersReducedMotion
      || previewSlideshowUrls.length <= 1
    ) return;

    const intervalId = window.setInterval(() => {
      setActiveSlideIndex((current) => (current + 1) % previewSlideshowUrls.length);
    }, TITLE_ART_SLIDE_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [phase, imageState, prefersReducedMotion, previewSlideshowKey, previewSlideshowUrls.length]);

  if (phase === "title-card") {
    const hasImagePreview = slideshowUrls.length > 0;
    const loadingStatus = hasImagePreview
      ? "Art preview received"
      : titleCardStatus === "ready"
        ? "Polishing title art"
        : "Generating title art";
    const loadingCopy = hasImagePreview
      ? "Generated art is here. Polishing the reveal before it lands."
      : "Preparing the personal title card reveal.";
    const hasVerifiedPreview = previewSlideshowUrls.length > 0;
    const hasSlideshow = previewSlideshowUrls.length > 1;
    const activeSafeSlideIndex = hasVerifiedPreview
      ? activeSlideIndex % previewSlideshowUrls.length
      : 0;
    const activeSlideUrl = previewSlideshowUrls[activeSafeSlideIndex] ?? null;
    const previewBadgeLabel = imageState === "loaded" && hasVerifiedPreview
      ? `Preview ${activeSafeSlideIndex + 1}/${previewSlideshowUrls.length}`
      : imageState === "idle"
        ? "Preparing preview"
        : hasImagePreview
          ? "Preview warming"
          : "Render in progress";

    return (
      <Card
        data-testid="companion-title-art-loading"
        className="relative min-h-[min(72vh,760px)] overflow-hidden border-primary/25 bg-background"
      >
        {hasImagePreview ? (
          <div className="absolute inset-0" data-testid="companion-title-art-loading-preview">
            {slideshowUrls.map((slideUrl, index) => (
              <img
                key={slideUrl}
                alt=""
                aria-hidden="true"
                className={cn(
                  "absolute inset-0 h-full w-full scale-105 object-cover opacity-0 blur-md transition-opacity duration-700",
                  slideUrl === activeSlideUrl && "opacity-55",
                )}
                onLoad={() => markPreviewUrlLoaded(slideUrl)}
                src={slideUrl}
              />
            ))}
          </div>
        ) : (
          <div
            data-testid="companion-title-art-placeholder"
            className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,hsl(var(--primary)/0.34),transparent_30%),radial-gradient(circle_at_18%_74%,hsl(var(--accent)/0.20),transparent_30%),linear-gradient(145deg,hsl(var(--background)),hsl(var(--card)),hsl(var(--background)))]"
          />
        )}

        <motion.div
          aria-hidden="true"
          className="absolute inset-y-0 left-[-35%] w-1/2 rotate-12 bg-[linear-gradient(90deg,transparent,hsl(var(--primary)/0.24),transparent)] blur-xl"
          animate={prefersReducedMotion ? undefined : { x: ["0%", "220%", "0%"], opacity: [0.12, 0.32, 0.12] }}
          transition={prefersReducedMotion ? undefined : { duration: 5.8, ease: "easeInOut", repeat: Infinity }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)/0.16),hsl(var(--background)/0.42)_44%,hsl(var(--background)/0.90))]" />

        <CardContent className="relative z-10 flex min-h-[min(72vh,760px)] flex-col justify-between gap-6 p-4 text-center sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 text-left">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-primary text-primary-foreground">{loadingStatus}</Badge>
              <Badge variant="outline" className="border-white/30 bg-background/55 text-foreground backdrop-blur">
                {previewBadgeLabel}
              </Badge>
            </div>
            <Badge variant="outline" className="border-white/30 bg-background/55 text-foreground backdrop-blur">
              Preparing reveal
            </Badge>
          </div>

          <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6">
            <div className="relative flex h-36 w-36 items-center justify-center">
              <motion.div
                aria-hidden="true"
                className="absolute inset-0 rounded-full border border-primary/30 bg-primary/10"
                animate={prefersReducedMotion ? undefined : { rotate: 360 }}
                transition={prefersReducedMotion ? undefined : { duration: 16, ease: "linear", repeat: Infinity }}
              />
              <motion.div
                aria-hidden="true"
                className="absolute inset-5 rounded-full border border-primary/25"
                animate={prefersReducedMotion ? undefined : { rotate: -360 }}
                transition={prefersReducedMotion ? undefined : { duration: 12, ease: "linear", repeat: Infinity }}
              />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-white/15 bg-background/70 shadow-2xl backdrop-blur">
                <Sparkles className={cn("h-9 w-9 text-primary", !prefersReducedMotion && "animate-pulse")} />
              </div>
            </div>

            <div className="space-y-3">
              <PreludeCardCarousel
                activeCard={activePreludeCard}
                activeIndex={activeSafePreludeCardIndex}
              />
              <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">{loadingCopy}</p>
              {hasSlideshow ? (
                <div
                  aria-label="Generated title art preview slides"
                  className="flex justify-center gap-1.5"
                >
                  {previewSlideshowUrls.map((slideUrl, index) => (
                    <span
                      key={slideUrl}
                      className={cn(
                        "h-1.5 w-5 rounded-full bg-primary/25 transition-colors",
                        index === activeSafeSlideIndex && "bg-primary",
                      )}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="rounded-lg border border-white/10 bg-background/60 px-3 py-2 text-left backdrop-blur"
                aria-hidden="true"
              >
                <div className="h-2 w-16 rounded-full bg-primary/20" />
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div className="h-5 w-10 rounded-full bg-white/10" />
                  <div className="h-2 w-12 rounded-full bg-primary/15" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      data-testid="companion-stat-analysis-loading"
      className="min-h-[62vh] overflow-hidden border-primary/20 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.20),transparent_34%),linear-gradient(180deg,hsl(var(--background)/0.92),hsl(var(--card)/0.98))]"
    >
      <CardContent className="flex min-h-[62vh] flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-primary/25 bg-primary/10">
          <div className="absolute inset-2 rounded-full border border-primary/20" />
          <Sparkles className={cn("h-10 w-10 text-primary", !prefersReducedMotion && "animate-pulse")} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Cosmiq reading</p>
          <h3 className="text-2xl font-semibold">Revealing your title</h3>
          <p className="mx-auto max-w-sm text-sm leading-6 text-muted-foreground">
            Reading your stat shape, momentum, and next evolution path.
          </p>
        </div>
        <PreludeCardCarousel
          activeCard={activePreludeCard}
          activeIndex={activeSafePreludeCardIndex}
        />
      </CardContent>
    </Card>
  );
}

const getTitleCardImageKey = (profileKey: string | null | undefined, imageUrl: string | null | undefined) =>
  profileKey && imageUrl ? `${profileKey}:${imageUrl}` : null;

function useTitleCardImageGate({
  analysis,
  onRegenerateTitleCard,
}: {
  analysis: CompanionStatAnalysis;
  onRegenerateTitleCard: (analysis: CompanionStatAnalysis) => Promise<unknown>;
}) {
  const card = analysis.cosmiqTitleCard;
  const profileKey = card?.profileKey ?? null;
  const imageUrl = getTitleCardImageUrls(card)[0] ?? null;
  const imageKey = getTitleCardImageKey(profileKey, imageUrl);
  const forcedRetryProfileKeysRef = useRef<Set<string>>(new Set());
  const [loadedImageKey, setLoadedImageKey] = useState<string | null>(null);
  const [failedImageKey, setFailedImageKey] = useState<string | null>(null);
  const [imageState, setImageState] = useState<TitleCardImageGateState>("idle");

  useEffect(() => {
    if (card?.status === "unavailable") {
      setImageState("failed");
      setLoadedImageKey(null);
      return;
    }

    if (card?.status !== "ready" || !profileKey || !imageUrl || !imageKey) {
      setImageState("loading");
      setLoadedImageKey(null);
      return;
    }

    if (loadedImageKey === imageKey) {
      setImageState("loaded");
      return;
    }

    let cancelled = false;
    let settled = false;
    setImageState("loading");
    setFailedImageKey(null);

    const preloadImage = new Image();
    const markLoaded = () => {
      if (cancelled || settled) return;
      settled = true;
      setLoadedImageKey(imageKey);
      setImageState("loaded");
    };
    const markFailed = () => {
      if (cancelled || settled) return;
      settled = true;
      setLoadedImageKey(null);

      if (!forcedRetryProfileKeysRef.current.has(profileKey)) {
        forcedRetryProfileKeysRef.current.add(profileKey);
        setImageState("loading");
        void onRegenerateTitleCard(analysis).catch(() => {
          if (cancelled) return;
          setFailedImageKey(imageKey);
          setImageState("failed");
        });
        return;
      }

      setFailedImageKey(imageKey);
      setImageState("failed");
    };

    preloadImage.onload = () => {
      if (typeof preloadImage.decode === "function") {
        void preloadImage.decode().then(markLoaded, markFailed);
        return;
      }
      markLoaded();
    };
    preloadImage.onerror = markFailed;
    preloadImage.src = imageUrl;

    if (preloadImage.complete) {
      if (preloadImage.naturalWidth > 0) {
        markLoaded();
      } else {
        markFailed();
      }
    }

    return () => {
      cancelled = true;
      preloadImage.onload = null;
      preloadImage.onerror = null;
    };
  }, [analysis, card?.status, imageKey, imageUrl, loadedImageKey, onRegenerateTitleCard, profileKey]);

  const retry = () => {
    if (!profileKey) return;
    forcedRetryProfileKeysRef.current.delete(profileKey);
    setFailedImageKey(null);
    setImageState("loading");
    void onRegenerateTitleCard(analysis).catch(() => {
      setFailedImageKey(imageKey);
      setImageState("failed");
    });
  };

  return {
    failedImageKey,
    imageState,
    isLoaded: card?.status === "ready" && loadedImageKey === imageKey,
    retry,
  };
}

function StatSheetCard({ stat, index }: { stat: CompanionStatCardViewModel; index: number }) {
  const meta = ATTRIBUTE_META[stat.attribute];
  const Icon = meta.icon;

  return (
    <motion.div variants={revealItemVariants}>
      <div
        data-testid={`companion-rpg-stat-card-${stat.attribute}`}
        className={cn(
          "h-full overflow-hidden border-border/60 bg-gradient-to-br bg-background/60",
          "rounded-lg border",
          meta.gradientClassName,
        )}
      >
        <div className="space-y-4 p-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                <Icon className={cn("h-4 w-4", meta.accentClassName)} />
              </div>
              <div>
                <CardTitle className="text-base">{stat.label}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Loadout slot #{index + 1}</p>
              </div>
            </div>
            <Badge variant="outline" className={cn("border", rankClassName(stat.rank))}>
              Rank {stat.rank}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-end justify-between gap-3">
              <span className="text-xs font-medium text-muted-foreground">{stat.band}</span>
              <span className="text-2xl font-semibold">{stat.score}</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-lg border border-white/5 bg-background/55"
              aria-label={`${stat.label} score meter`}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={stat.percent}
              aria-valuetext={`${stat.score} out of ${STAT_MAX}`}
              role="progressbar"
            >
              <div
                className="h-full rounded-lg bg-primary/80 transition-all duration-500"
                style={{ width: `${stat.percent}%` }}
              />
            </div>
          </div>
        </div>
        <div className="px-4 pb-4">
          <p className="text-sm leading-6 text-foreground/85">{stat.status}</p>
        </div>
      </div>
    </motion.div>
  );
}

function StatIntelCard({ stat }: { stat: CompanionStatCardViewModel }) {
  const meta = ATTRIBUTE_META[stat.attribute];
  const Icon = meta.icon;

  return (
    <div className="rounded-lg border border-border/50 bg-background/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="rounded-lg border border-white/10 bg-white/5 p-2">
            <Icon className={cn("h-4 w-4", meta.accentClassName)} />
          </div>
          <div className="flex items-center gap-2">
            <div>
              <p className="text-sm font-semibold">{stat.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.band} | {stat.score}</p>
            </div>
          </div>
        </div>
        <Badge variant="outline" className={cn("shrink-0 border", rankClassName(stat.rank))}>
          Rank {stat.rank}
        </Badge>
      </div>

      <div className="mt-3 space-y-3">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">Why it looks this way</p>
          <div className="space-y-2">
            {stat.reasons.map((reason) => (
              <p key={reason} className="text-sm leading-6 text-foreground/90">
                {reason}
              </p>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">Recent drivers</p>
          {stat.drivers.length > 0 ? (
            <div className="space-y-2">
              {stat.drivers.map((driver) => (
                <div
                  key={driver.key}
                  className="rounded-lg border border-white/5 bg-background/40 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{driver.label}</span>
                    <Badge variant="secondary" className="bg-white/10 text-[10px]">
                      {driver.window}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{driver.detail}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              No recent tracked boosts yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function AnalysisUnavailableCard({
  message,
  isRefreshing,
  onRetry,
}: {
  message: string;
  isRefreshing: boolean;
  onRetry: () => void;
}) {
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="space-y-4 pt-6">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Stats analysis is unavailable right now.</p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onRetry}
          disabled={isRefreshing}
          className="w-full sm:w-auto"
        >
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          Retry analysis
        </Button>
      </CardContent>
    </Card>
  );
}

const formatRarityLabel = (value: CompanionStatAnalysis["cosmiqTitle"]["rarity"]) =>
  value.charAt(0).toUpperCase() + value.slice(1);

const STABILITY_LABELS: Record<CompanionStatAnalysis["cosmiqTitle"]["titleStability"], string> = {
  new: "New Title Unlocked",
  stable: "Title Held",
  at_risk: "Title At Risk",
  evolving: "Evolution Near",
};

function CosmiqTitleBackContent({
  analysis,
  viewModel,
  isRefreshing,
  onRefresh,
}: {
  analysis: CompanionStatAnalysis;
  viewModel: ReturnType<typeof buildCompanionStatAnalysisViewModel>;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div data-testid="companion-cosmiq-title-card-back" className="space-y-4">
      <section className="rounded-lg border border-white/10 bg-background/45 p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Current Build</p>
              <h3 className="mt-1 text-3xl font-semibold leading-tight md:text-5xl">
                {viewModel.currentBuild}
              </h3>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{analysis.summary}</p>
            <p className="max-w-2xl text-sm leading-6 text-foreground/90">{analysis.narrativeBrief}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-white/10 bg-background/45 p-3">
              <p className="text-xs text-muted-foreground">Title</p>
              <p className="mt-2 text-sm font-semibold">{analysis.cosmiqTitle.title}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-background/45 p-3">
              <p className="text-xs text-muted-foreground">Rarity</p>
              <p className="mt-2 text-sm font-semibold">{formatRarityLabel(analysis.cosmiqTitle.rarity)}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-background/45 p-3">
              <p className="text-xs text-muted-foreground">Momentum</p>
              <p className="mt-2 text-sm font-semibold">{formatSnakeLabel(analysis.momentumState)}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-background/45 p-3">
              <p className="text-xs text-muted-foreground">Needs Support</p>
              <p className="mt-2 text-sm font-semibold">{viewModel.weakestStat.label}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <motion.div variants={revealItemVariants}>
          <section className="h-full rounded-lg border border-border/60 bg-background/60">
            <div className="p-4 pb-2">
              <h3 className="text-lg font-semibold">Character Sheet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Stat shape based on normalized 0-100 power from your 100-1000 scores.
              </p>
            </div>
            <div className="p-4 pt-2">
              <div
                data-testid="companion-stat-radar"
                className="h-[260px] min-h-[260px] w-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={viewModel.radarData} outerRadius="72%">
                    <PolarGrid stroke="hsl(var(--border) / 0.45)" />
                    <PolarAngleAxis
                      dataKey="attribute"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      axisLine={false}
                      domain={[0, 100]}
                      tick={false}
                    />
                    <Radar
                      dataKey="percent"
                      name="Score"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.28}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        </motion.div>

        <motion.div variants={revealItemVariants}>
          <section className="h-full rounded-lg border border-primary/20 bg-primary/5">
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  Recommended Quest
                </Badge>
                <Badge variant="outline" className={cn("border", rankClassName(viewModel.weakestStat.rank))}>
                  Rebalance {viewModel.weakestStat.label}
                </Badge>
              </div>
              <h3 className="text-xl font-semibold">Best next move</h3>
              <p className="text-sm leading-6 text-foreground/90">{analysis.suggestedAction}</p>
            </div>
            <div className="space-y-3 px-4 pb-4">
              <div className="rounded-lg border border-white/10 bg-background/40 p-3">
                <p className="text-xs font-medium text-muted-foreground">Today reads as</p>
                <p className="mt-2 text-sm font-semibold">{analysis.dailyNarrative}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{analysis.weeklyNarrative}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-background/40 p-3">
                <p className="text-xs font-medium text-muted-foreground">Miss read</p>
                <p className="mt-2 text-sm font-semibold">{formatSnakeLabel(analysis.recentMissInterpretation)}</p>
              </div>
            </div>
          </section>
        </motion.div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {viewModel.rankedStats.map((stat, index) => (
          <StatSheetCard key={stat.attribute} stat={stat} index={index} />
        ))}
      </div>

      <motion.details
        variants={revealItemVariants}
        className="rounded-lg border border-border/60 bg-background/45 p-4"
      >
        <summary className="cursor-pointer text-sm font-semibold">
          Battle Log & Stat Intel
        </summary>

        <div className="mt-4 space-y-4">
          <section className="space-y-3">
            <div>
              <h3 className="text-base font-semibold">Activity snapshot</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Recent activity:{" "}
                {formatRange(analysis.activitySnapshot.activityStartDate, analysis.activitySnapshot.activityEndDate)}
                {"  "} | {"  "}
                Provenance window:{" "}
                {formatRange(
                  analysis.activitySnapshot.provenanceStartDate,
                  analysis.activitySnapshot.provenanceEndDate,
                )}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {ACTIVITY_FIELDS.map((field) => (
                <div
                  key={field.key}
                  className="rounded-lg border border-white/5 bg-background/45 px-3 py-3"
                >
                  <p className="text-xs text-muted-foreground">{field.label}</p>
                  <p className="mt-2 text-xl font-semibold">
                    {analysis.activitySnapshot[field.key]}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {analysis.strongestRecentDrivers.length > 0 ? (
            <section className="space-y-3">
              <h3 className="text-base font-semibold">Strongest recent drivers</h3>
              <div className="grid gap-2 md:grid-cols-2">
                {analysis.strongestRecentDrivers.map((driver) => (
                  <div key={driver.key} className="rounded-lg border border-white/5 bg-background/40 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">{driver.label}</span>
                      <Badge variant="outline" className="bg-background/60">
                        {driver.window}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{driver.detail}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <h3 className="text-base font-semibold">Per-stat intel</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {viewModel.statCards.map((stat) => (
                <StatIntelCard key={stat.attribute} stat={stat} />
              ))}
            </div>
          </section>
        </div>
      </motion.details>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          {isRefreshing ? "Refreshing..." : "Refresh analysis"}
        </Button>
      </div>
    </div>
  );
}

function CosmiqTitleRevealCard({
  analysis,
  viewModel,
  cached,
  isFlipped,
  onFlip,
  isRefreshing,
  onRefresh,
  isTitleArtFallback,
  isRegeneratingTitleCard,
  onRegenerateTitleCard,
  prefersReducedMotion,
}: {
  analysis: CompanionStatAnalysis;
  viewModel: ReturnType<typeof buildCompanionStatAnalysisViewModel>;
  cached: boolean;
  isFlipped: boolean;
  onFlip: () => void;
  isRefreshing: boolean;
  onRefresh: () => void;
  isTitleArtFallback: boolean;
  isRegeneratingTitleCard: boolean;
  onRegenerateTitleCard: (analysis: CompanionStatAnalysis) => Promise<unknown>;
  prefersReducedMotion: boolean;
}) {
  const imageUrl = isTitleArtFallback ? null : getTitleCardImageUrls(analysis.cosmiqTitleCard)[0] ?? null;
  const cardStatus = analysis.cosmiqTitleCard?.status ?? "unavailable";
  const showTitleArtUnavailableBadge = isTitleArtFallback || cardStatus === "unavailable";
  const titleArtDiagnosticMessage = getTitleArtDiagnosticMessage({
    card: analysis.cosmiqTitleCard,
    isTitleArtFallback,
    isRegeneratingTitleCard,
  });
  const handleRegenerateTitleArt = () => {
    void onRegenerateTitleCard(analysis).catch(() => undefined);
  };

  if (isFlipped) {
    return (
      <Card
        data-testid="companion-cosmiq-title-card"
        className="flex h-[min(72vh,760px)] flex-col overflow-hidden border-primary/25 bg-[linear-gradient(135deg,hsl(var(--primary)/0.12),hsl(var(--background)/0.82)_44%,hsl(var(--accent)/0.08))]"
        style={mentorAccentStyle(analysis)}
      >
        <CardHeader className="shrink-0 border-b border-white/10 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  <Sparkles className="mr-1 h-3.5 w-3.5" />
                  Stat Reading
                </Badge>
                <Badge variant="outline" className="bg-background/60">
                  {analysis.mentor.name}
                </Badge>
                {cached ? (
                  <Badge variant="outline" className="bg-background/60">
                    Cached for today
                  </Badge>
                ) : null}
                <Badge variant="outline" className="bg-background/60">
                  {analysis.analysisDate}
                </Badge>
              </div>
              {showTitleArtUnavailableBadge && titleArtDiagnosticMessage ? (
                <p className="max-w-lg text-xs leading-5 text-muted-foreground">
                  {titleArtDiagnosticMessage}
                </p>
              ) : null}
              <CardTitle className="text-2xl leading-tight sm:text-3xl">
                {analysis.cosmiqTitle.title}
              </CardTitle>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {showTitleArtUnavailableBadge ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  aria-label="Regenerate title art"
                  className="border border-white/20 bg-background/70 backdrop-blur hover:bg-background/85"
                  onClick={handleRegenerateTitleArt}
                  disabled={isRegeneratingTitleCard}
                >
                  <RefreshCw className={cn("h-4 w-4", isRegeneratingTitleCard && "animate-spin")} />
                </Button>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label="Show Cosmiq title card"
                className="border border-white/20 bg-background/70 backdrop-blur hover:bg-background/85"
                onClick={onFlip}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <CosmiqTitleBackContent
            analysis={analysis}
            viewModel={viewModel}
            isRefreshing={isRefreshing}
            onRefresh={onRefresh}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      data-testid="companion-cosmiq-title-card"
      className="relative min-h-[min(72vh,760px)] overflow-hidden border-primary/25 bg-background"
      style={mentorAccentStyle(analysis)}
    >
      {imageUrl ? (
        <motion.div
          className="absolute inset-0"
          initial={prefersReducedMotion ? false : { opacity: 0, scale: 1.04, filter: "blur(14px)" }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={prefersReducedMotion ? undefined : { duration: 0.5, ease: "easeOut" }}
        >
          <img
            alt={`${analysis.cosmiqTitle.title} archetype illustration`}
            className="h-full w-full object-cover"
            src={imageUrl}
          />
        </motion.div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.30),transparent_38%),linear-gradient(145deg,hsl(var(--background)),hsl(var(--accent)/0.18),hsl(var(--card)))]">
          <ImageIcon className="h-20 w-20 text-primary/45" aria-hidden="true" />
        </div>
      )}

      <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)/0.12),hsl(var(--background)/0.28)_42%,hsl(var(--background)/0.88))]" />

      <div className="relative z-10 flex min-h-[min(72vh,760px)] flex-col justify-between p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-primary text-primary-foreground">
                {formatRarityLabel(analysis.cosmiqTitle.rarity)}
              </Badge>
              <Badge variant="outline" className="border-white/30 bg-background/55 text-foreground backdrop-blur">
                {STABILITY_LABELS[analysis.cosmiqTitle.titleStability]}
              </Badge>
              {cardStatus === "generating" ? (
                <Badge variant="outline" className="border-white/30 bg-background/55 text-foreground backdrop-blur">
                  Art warming up
                </Badge>
              ) : null}
              {showTitleArtUnavailableBadge ? (
                <Badge variant="outline" className="border-white/30 bg-background/55 text-foreground backdrop-blur">
                  Art unavailable
                </Badge>
              ) : null}
            </div>
            {showTitleArtUnavailableBadge && titleArtDiagnosticMessage ? (
              <p className="max-w-md rounded-lg border border-white/10 bg-background/55 px-3 py-2 text-xs leading-5 text-muted-foreground backdrop-blur">
                {titleArtDiagnosticMessage}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {showTitleArtUnavailableBadge ? (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label="Regenerate title art"
                className="border border-white/20 bg-background/70 backdrop-blur hover:bg-background/85"
                onClick={handleRegenerateTitleArt}
                disabled={isRegeneratingTitleCard}
              >
                <RefreshCw className={cn("h-4 w-4", isRegeneratingTitleCard && "animate-spin")} />
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label={isFlipped ? "Show Cosmiq title card" : "Show stat analysis"}
              className="border border-white/20 bg-background/70 backdrop-blur hover:bg-background/85"
              onClick={onFlip}
            >
              {isFlipped ? <RotateCcw className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <motion.div
          className="space-y-4 rounded-lg border border-white/15 bg-background/72 p-4 shadow-2xl backdrop-blur-md"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? undefined : { duration: 0.32, delay: 0.12, ease: "easeOut" }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Cosmiq Title</p>
            <h3 className="mt-2 text-3xl font-semibold leading-tight md:text-5xl">
              {analysis.cosmiqTitle.title}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">{analysis.cosmiqTitle.rebalancePath}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {viewModel.statCards.map((stat) => (
              <div
                key={stat.attribute}
                className="rounded-lg border border-white/10 bg-background/55 px-3 py-2"
              >
                <p className="text-[11px] font-medium text-muted-foreground">{stat.label}</p>
                <div className="mt-1 flex items-end justify-between gap-2">
                  <span className="text-lg font-semibold leading-none">{stat.score}</span>
                  <span className="text-[10px] font-semibold uppercase text-primary">{stat.band}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </Card>
  );
}

function CompanionStatAnalysisView({
  analysis,
  cached,
  isRefreshing,
  isRegeneratingTitleCard,
  onRefresh,
  onRegenerateTitleCard,
}: {
  analysis: CompanionStatAnalysis;
  cached: boolean;
  isRefreshing: boolean;
  isRegeneratingTitleCard: boolean;
  onRefresh: () => void;
  onRegenerateTitleCard: (analysis: CompanionStatAnalysis) => Promise<unknown>;
}) {
  const prefersReducedMotion = useReducedMotion();
  const viewModel = useMemo(() => buildCompanionStatAnalysisViewModel(analysis), [analysis]);
  const [isFlipped, setIsFlipped] = useState(false);
  const {
    imageState,
    isLoaded: isTitleCardImageLoaded,
  } = useTitleCardImageGate({
    analysis,
    onRegenerateTitleCard,
  });
  const titleCardStatus = analysis.cosmiqTitleCard?.status ?? "generating";
  const isTitleArtFallback = titleCardStatus === "unavailable" || imageState === "failed";
  const titleCardImageUrls = useMemo(
    () => getTitleCardImageUrls(analysis.cosmiqTitleCard),
    [analysis.cosmiqTitleCard],
  );
  const primaryTitleCardImageUrl = titleCardImageUrls[0] ?? null;
  const titleCardPreviewKey = titleCardImageUrls.join("|");
  const titleCardPreviewDwellMs = prefersReducedMotion
    ? 0
    : getTitleArtPreviewDwellMs(titleCardImageUrls.length);
  const [isTitleCardPreviewDwellComplete, setIsTitleCardPreviewDwellComplete] = useState(false);
  const [verifiedTitleCardPreviewCount, setVerifiedTitleCardPreviewCount] = useState(0);
  const handleVerifiedPreviewCountChange = useCallback((verifiedCount: number) => {
    setVerifiedTitleCardPreviewCount(verifiedCount);
  }, []);

  // The verified count dependency intentionally restarts dwell when another preview image becomes slideshow-safe.
  useEffect(() => {
    if (titleCardPreviewDwellMs <= 0 || titleCardPreviewKey.length === 0) {
      setIsTitleCardPreviewDwellComplete(true);
      setVerifiedTitleCardPreviewCount(0);
      return;
    }

    if (!isTitleCardImageLoaded) {
      setIsTitleCardPreviewDwellComplete(false);
      setVerifiedTitleCardPreviewCount(0);
      return;
    }

    setIsTitleCardPreviewDwellComplete(false);
    const timeoutId = window.setTimeout(() => {
      setIsTitleCardPreviewDwellComplete(true);
    }, titleCardPreviewDwellMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isTitleCardImageLoaded, titleCardPreviewDwellMs, titleCardPreviewKey, verifiedTitleCardPreviewCount]);
  const isTitleCardPreviewDwellSatisfied = titleCardPreviewDwellMs <= 0 || isTitleCardPreviewDwellComplete;

  if (
    !isTitleArtFallback
    && (
      titleCardStatus !== "ready"
      || !primaryTitleCardImageUrl
      || !isTitleCardImageLoaded
      || !isTitleCardPreviewDwellSatisfied
      || isRegeneratingTitleCard
    )
  ) {
    return (
      <LoadingState
        phase="title-card"
        imageUrl={primaryTitleCardImageUrl}
        imageUrls={titleCardImageUrls}
        titleCardStatus={titleCardStatus}
        imageState={imageState}
        onVerifiedPreviewCountChange={handleVerifiedPreviewCountChange}
        prefersReducedMotion={prefersReducedMotion}
      />
    );
  }

  return (
    <motion.div
      className="space-y-4"
      initial={prefersReducedMotion ? false : "hidden"}
      animate="visible"
      variants={revealContainerVariants}
    >
      <motion.div variants={revealItemVariants}>
        <CosmiqTitleRevealCard
          analysis={analysis}
          viewModel={viewModel}
          cached={cached}
          isFlipped={isFlipped}
          onFlip={() => setIsFlipped((current) => !current)}
          isRefreshing={isRefreshing}
          onRefresh={onRefresh}
          isTitleArtFallback={isTitleArtFallback}
          isRegeneratingTitleCard={isRegeneratingTitleCard}
          onRegenerateTitleCard={onRegenerateTitleCard}
          prefersReducedMotion={prefersReducedMotion}
        />
      </motion.div>
    </motion.div>
  );
}

function AnalysisContent() {
  const {
    analysis,
    cached,
    error,
    isLoading,
    isRefreshing,
    isRegeneratingTitleCard,
    refreshAnalysis,
    regenerateTitleCard,
  } = useCompanionStatAnalysis({ enabled: true });
  const prefersReducedMotion = useReducedMotion();
  const [renderBoundaryKey, setRenderBoundaryKey] = useState(0);

  const handleRefresh = () => {
    void refreshAnalysis().catch(() => undefined);
  };

  const handleRenderRecovery = () => {
    void refreshAnalysis()
      .catch(() => undefined)
      .finally(() => {
        setRenderBoundaryKey((current) => current + 1);
      });
  };

  if (isLoading && !analysis) {
    return <LoadingState prefersReducedMotion={prefersReducedMotion} />;
  }

  if (!analysis) {
    return (
      <AnalysisUnavailableCard
        message={error ?? "Try again in a moment."}
        isRefreshing={isRefreshing}
        onRetry={handleRefresh}
      />
    );
  }

  return (
    <SectionErrorBoundary
      key={renderBoundaryKey}
      section="companion-stat-analysis"
      fallback={
        <AnalysisUnavailableCard
          message="We couldn't render this analysis right now. Try refreshing it."
          isRefreshing={isRefreshing}
          onRetry={handleRenderRecovery}
        />
      }
    >
      <CompanionStatAnalysisView
        analysis={analysis}
        cached={cached}
        isRefreshing={isRefreshing}
        isRegeneratingTitleCard={isRegeneratingTitleCard}
        onRefresh={handleRefresh}
        onRegenerateTitleCard={regenerateTitleCard}
      />
    </SectionErrorBoundary>
  );
}

export function CompanionStatAnalysisSurface({
  open,
  onOpenChange,
  layoutMode,
}: CompanionStatAnalysisSurfaceProps) {
  const sharedBody = (
    <div className="max-h-[75vh] overflow-y-auto px-4 pb-4 sm:px-1">
      <AnalysisContent />
    </div>
  );

  if (layoutMode === "desktop") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          data-testid="companion-stats-analysis-dialog"
          className="max-h-[88vh] max-w-4xl gap-0 overflow-hidden"
        >
          <DialogHeader className="px-6 pb-4 pt-6">
            <DialogTitle>Analyze My Stats</DialogTitle>
            <DialogDescription>
              A mentor-guided read on what your companion stats are saying and what has been shaping them lately.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6">{sharedBody}</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        data-testid="companion-stats-analysis-drawer"
        className="max-h-[88dvh] border-border/70 bg-card/96"
      >
        <DrawerHeader className="px-4 pb-3 pt-1 text-left">
          <DrawerTitle>Analyze My Stats</DrawerTitle>
          <DrawerDescription>
            A mentor-guided read on what your companion stats are saying and what has been shaping them lately.
          </DrawerDescription>
        </DrawerHeader>
        {sharedBody}
      </DrawerContent>
    </Drawer>
  );
}
