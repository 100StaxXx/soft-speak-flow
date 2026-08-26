import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Brain, Check, ChevronDown, Heart, Loader2, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
  getBundledDailyFormationAssetUrls,
  getCompanionReactionAnimationUrl,
  getDailyFormationAssetDescriptor,
  type CompanionReactionAnimation,
} from "@/config/gracewardMotion";
import { PRODUCT, PRODUCT_COPY } from "@/config/product";
import { getChristianDailyContent } from "@/data/christianDailyContent";
import type { DailyFormationCategory } from "@/data/dailyFormationPractices";
import { useAdaptiveDailyFormation } from "@/hooks/useAdaptiveDailyFormation";
import { useAuth } from "@/hooks/useAuth";
import type { Companion } from "@/hooks/useCompanion";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { safeLocalStorage } from "@/utils/storage";
import { getEffectiveDailyDate } from "@/utils/timezone";

export interface GracewardFormationMedia {
  category: DailyFormationCategory;
  videoUrl: string | null;
  stillUrl: string | null;
  playVideo: boolean;
  phase?: "practice" | "completion";
  reaction?: CompanionReactionAnimation;
  onPlaybackComplete?: () => void;
}

const PILLAR_META = {
  Mind: { icon: Brain, color: "text-sky-600 dark:text-sky-300" },
  Body: { icon: Activity, color: "text-emerald-600 dark:text-emerald-300" },
  Soul: { icon: Heart, color: "text-violet-600 dark:text-violet-300" },
} satisfies Record<DailyFormationCategory, { icon: typeof Brain; color: string }>;

const COMPANION_FORMATION_RESPONSES: Record<DailyFormationCategory, string> = {
  Mind: "Your attention grew steadier. I’m learning to notice with you.",
  Body: "You cared for the life you’ve been given. Let’s carry that gentleness forward.",
  Soul: "You made room for Scripture and prayer. I’ll stay near as you carry the Word with you.",
};

const GracewardRevealMark = () => (
  <svg
    viewBox="0 0 56 104"
    className="h-24 w-14 text-[#f4ecd9] drop-shadow-[0_8px_22px_rgba(0,0,0,0.22)]"
    aria-hidden="true"
  >
    <circle cx="28" cy="25" r="25" fill="currentColor" opacity="0.18" />
    <path d="M28 7v36M10 25h36" fill="none" stroke="#d9bd76" strokeLinecap="round" strokeWidth="10" />
    <path d="M48 48c-2 19-13 26-23 42-4 6-7 10-11 14H2c7-18 15-33 25-47 8-11 13-18 13-9z" fill="currentColor" />
  </svg>
);

const parseCategory = (value: string | null): DailyFormationCategory | null => (
  value === "Mind" || value === "Body" || value === "Soul" ? value : null
);

const resolveFormationMedia = ({
  species,
  element,
  stage,
  category,
  dateKey,
}: {
  species: string | null | undefined;
  element: string | null | undefined;
  stage: number | null | undefined;
  category: DailyFormationCategory;
  dateKey: string;
}) => {
  const asset = getDailyFormationAssetDescriptor({
    species,
    element,
    stage,
    category,
    dateKey,
  });
  if (!asset) {
    return getBundledDailyFormationAssetUrls({
      species,
      element,
      stage,
      category,
      dateKey,
    }) ?? { videoUrl: null, stillUrl: null };
  }
  const videoUrl = supabase.storage
    .from(asset.videoBucket)
    .getPublicUrl(asset.videoStoragePath).data.publicUrl;
  const stillUrl = supabase.storage
    .from(asset.stillBucket)
    .getPublicUrl(asset.stillStoragePath).data.publicUrl;
  return { videoUrl, stillUrl };
};

export const GracewardDailyFormationBoard = ({
  companion,
  onFormationMediaChange,
}: {
  companion: Companion | null;
  onFormationMediaChange?: (media: GracewardFormationMedia | null) => void;
}) => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const dateKey = getEffectiveDailyDate(profile?.timezone ?? undefined);
  const dailyContent = useMemo(
    () => getChristianDailyContent(new Date(`${dateKey}T12:00:00`)),
    [dateKey],
  );
  const species = companion?.spirit_animal ?? companion?.preset_id;
  const element = companion?.core_element;
  const stage = companion?.current_stage;
  const formationSupported = PRODUCT.mode === "christian"
    && Boolean(companion && companion.current_stage > 0);
  const mind = useAdaptiveDailyFormation({ category: "Mind", enabled: formationSupported });
  const body = useAdaptiveDailyFormation({ category: "Body", enabled: formationSupported });
  const soul = useAdaptiveDailyFormation({ category: "Soul", enabled: formationSupported });
  const storageScope = `${user?.id ?? "preview"}:${dateKey}`;
  const activeStorageKey = `graceward:formation-active:v1:${storageScope}`;
  const [activeCategory, setActiveCategory] = useState<DailyFormationCategory | null>(() => (
    parseCategory(safeLocalStorage.getItem(activeStorageKey))
  ));
  const [revealingCategory, setRevealingCategory] = useState<DailyFormationCategory | null>(() => (
    parseCategory(safeLocalStorage.getItem(activeStorageKey))
  ));
  const [celebratedCategory, setCelebratedCategory] = useState<DailyFormationCategory | null>(null);
  const [showCompletionReveal, setShowCompletionReveal] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const restoredStorageKeyRef = useRef<string | null>(null);

  const entries = useMemo(() => ([
    { category: "Mind" as const, state: mind },
    { category: "Body" as const, state: body },
    { category: "Soul" as const, state: soul },
  ]), [body, mind, soul]);
  const activeEntry = activeCategory
    ? entries.find((entry) => entry.category === activeCategory) ?? null
    : null;
  const completedCount = entries.filter((entry) => Boolean(entry.state.assignment?.completedAt)).length;

  useEffect(() => {
    const restoredCategory = parseCategory(safeLocalStorage.getItem(activeStorageKey));
    setActiveCategory(restoredCategory);
    setRevealingCategory(restoredCategory);
    setCelebratedCategory(null);
    restoredStorageKeyRef.current = null;
  }, [activeStorageKey]);

  useEffect(() => {
    if (!showCompletionReveal) return;
    const timer = window.setTimeout(() => setShowCompletionReveal(false), 4_500);
    return () => window.clearTimeout(timer);
  }, [showCompletionReveal]);

  useEffect(() => {
    if (restoredStorageKeyRef.current === activeStorageKey || activeEntry?.state.isLoading) return;
    if (!formationSupported || !activeCategory || activeEntry?.state.assignment?.completedAt) {
      onFormationMediaChange?.(null);
      setRevealingCategory(null);
      restoredStorageKeyRef.current = activeStorageKey;
      return;
    }

    const media = resolveFormationMedia({ species, element, stage, category: activeCategory, dateKey });
    setRevealingCategory(activeCategory);
    onFormationMediaChange?.({
      category: activeCategory,
      ...media,
      playVideo: true,
      phase: "practice",
      onPlaybackComplete: () => setRevealingCategory((current) => (
        current === activeCategory ? null : current
      )),
    });
    restoredStorageKeyRef.current = activeStorageKey;
  }, [
    activeCategory,
    activeEntry?.state.assignment?.completedAt,
    activeEntry?.state.isLoading,
    activeStorageKey,
    dateKey,
    element,
    formationSupported,
    onFormationMediaChange,
    species,
    stage,
  ]);

  if (!formationSupported) return null;

  const selectCategory = (category: DailyFormationCategory) => {
    const entry = entries.find((candidate) => candidate.category === category);
    const media = resolveFormationMedia({ species, element, stage, category, dateKey });

    const shouldStageReveal = !entry?.state.assignment?.completedAt;
    setActiveCategory(category);
    setRevealingCategory(shouldStageReveal ? category : null);
    setCelebratedCategory(null);
    setCollapsed(false);
    safeLocalStorage.setItem(activeStorageKey, category);
    onFormationMediaChange?.(entry?.state.assignment?.completedAt ? null : {
      category,
      ...media,
      playVideo: true,
      phase: "practice",
      onPlaybackComplete: shouldStageReveal
        ? () => setRevealingCategory((current) => current === category ? null : current)
        : undefined,
    });
  };

  const completeActivePractice = async () => {
    if (!activeEntry || activeEntry.state.assignment?.completedAt || activeEntry.state.isCompleting) return;
    try {
      const category = activeEntry.category;
      const nextCompletedCount = Math.min(3, completedCount + 1);
      await activeEntry.state.completePractice();
      setCelebratedCategory(category);
      if (profile?.companion_memory_enabled !== false && user?.id && companion?.id) {
        void supabase
          .from("companion_memories")
          .insert({
            user_id: user.id,
            companion_id: companion.id,
            memory_type: "special_moment",
            memory_date: dateKey,
            referenced_count: 0,
            memory_context: {
              title: `${activeEntry.state.practice.title}`,
              emotion: "gratitude",
              description: `A ${category.toLowerCase()} practice shaped by ${dailyContent.reference}.`,
              details: {
                source: "daily_formation",
                category,
                daily_theme: dailyContent.theme,
                scripture_reference: dailyContent.reference,
              },
            },
          })
          .then(({ error }) => {
            if (error) {
              console.warn("Companion formation memory was not saved:", error);
              return;
            }
            window.dispatchEvent(new CustomEvent("companion-memory-created", {
              detail: { companionId: companion.id, source: "daily_formation" },
            }));
          });
      }
      const reaction: CompanionReactionAnimation = nextCompletedCount === 3 ? "celebrate" : "encourage";
      const reactionVideoUrl = getCompanionReactionAnimationUrl({ species, element, reaction });
      onFormationMediaChange?.({
        category,
        videoUrl: reactionVideoUrl,
        stillUrl: null,
        playVideo: true,
        phase: "completion",
        reaction,
        onPlaybackComplete: () => {
          onFormationMediaChange?.(null);
          if (nextCompletedCount === 3) setShowCompletionReveal(true);
        },
      });
    } catch {
      // The formation hook owns the error toast; keep the finish frame visible so the user can retry.
    }
  };

  return (
    <section
      className="mx-auto w-full max-w-sm"
      aria-label="Mind Body and Soul daily formation"
      data-testid="graceward-formation-controls"
    >
      <div className="mb-3 flex items-end justify-between gap-3 px-0.5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Today’s formation</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {completedCount === 3
              ? "Mind, body, and soul are complete."
              : `${dailyContent.theme} · ${dailyContent.reference}`}
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground" aria-label={`${completedCount} of 3 practices complete`}>
          {completedCount}/3
        </span>
      </div>
      <div className="mb-3 grid grid-cols-3 gap-1" aria-hidden="true">
        {entries.map(({ category, state }) => (
          <span
            key={`progress-${category}`}
            className={cn(
              "h-1.5 rounded-full transition-colors duration-300",
              state.assignment?.completedAt ? "bg-emerald-500" : "bg-border/65",
            )}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {entries.map(({ category, state }) => {
          const meta = PILLAR_META[category];
          const Icon = meta.icon;
          const complete = Boolean(state.assignment?.completedAt);
          const active = category === activeCategory;
          return (
            <button
              type="button"
              key={category}
              onClick={() => selectCategory(category)}
              aria-pressed={active}
              className={cn(
                "flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                active
                  ? "border-primary/45 bg-primary/[0.14] text-foreground shadow-sm"
                  : "border-border/60 bg-background/60 text-muted-foreground hover:bg-background/85",
              )}
            >
              {complete
                ? <Check className="h-3.5 w-3.5 text-emerald-500" />
                : <Icon className={cn("h-3.5 w-3.5", meta.color)} />}
              {category}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
      {activeEntry && revealingCategory !== activeEntry.category ? (
        <motion.div
          key={`${activeEntry.category}-${celebratedCategory === activeEntry.category ? "complete" : "practice"}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }}
          className="mt-3 overflow-hidden rounded-2xl border border-border/60 bg-background/75 text-left shadow-sm backdrop-blur-md"
        >
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5"
            aria-expanded={!collapsed}
          >
            <span className="min-w-0 truncate text-sm font-semibold">{activeEntry.state.practice.title}</span>
            <span className="flex shrink-0 items-center gap-2 text-[11px] font-medium text-muted-foreground">
              {activeEntry.state.practice.minutes} min · +{activeEntry.state.practice.xpReward} {PRODUCT_COPY.growthLabel}
              <ChevronDown className={cn("h-3.5 w-3.5 transition", collapsed && "-rotate-90")} />
            </span>
          </button>
          {!collapsed ? (
            <div className="border-t border-border/50 px-3.5 pb-3 pt-2.5">
              <p className="text-xs leading-5 text-muted-foreground">{activeEntry.state.practice.action}</p>
              <p className="mt-2 text-[11px] leading-5 text-primary/80">
                {activeEntry.state.assignment?.selectionReason ?? `Connected to today’s theme: ${dailyContent.theme}.`}
              </p>
              {celebratedCategory === activeEntry.category ? (
                <p className="mt-2 rounded-xl bg-primary/[0.07] px-3 py-2 text-xs leading-5 text-foreground/80" role="status">
                  {COMPANION_FORMATION_RESPONSES[activeEntry.category]}
                </p>
              ) : null}
              {celebratedCategory === activeEntry.category || activeEntry.state.assignment?.completedAt ? (
                <div className="mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                  <Check className="h-3.5 w-3.5" /> Complete
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="mt-2.5 h-9 w-full rounded-xl"
                  onClick={() => void completeActivePractice()}
                  disabled={activeEntry.state.isCompleting || activeEntry.state.isLoading}
                >
                  {activeEntry.state.isCompleting
                    ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    : <Check className="mr-1.5 h-3.5 w-3.5" />}
                  {activeEntry.state.isCompleting ? "Saving…" : "Mark practice complete"}
                </Button>
              )}
            </div>
          ) : null}
        </motion.div>
      ) : revealingCategory ? (
        <motion.div
          key={`revealing-${revealingCategory}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="mt-3 flex min-h-20 items-center justify-center rounded-2xl border border-primary/15 bg-primary/[0.05] px-4 text-center"
          role="status"
        >
          <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            Your companion is preparing today’s {revealingCategory.toLowerCase()} practice…
          </p>
        </motion.div>
      ) : null}
      </AnimatePresence>

      {completedCount === 3 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] px-4 py-3 text-center text-xs font-semibold text-emerald-700 dark:text-emerald-300"
          role="status"
        >
          <Sparkles className="h-4 w-4" />
          Today’s formation is complete. Carry it gently into the rest of your day.
        </motion.div>
      ) : null}

      <AnimatePresence>
        {showCompletionReveal ? (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
            className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-[#193824]/[0.94] px-8 text-center backdrop-blur-md"
            onClick={() => setShowCompletionReveal(false)}
            aria-label="Today’s formation is complete. Continue."
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.18, duration: 0.7, ease: "easeOut" }}
              className="flex flex-col items-center"
            >
              <GracewardRevealMark />
              <p className="mt-2 font-serif text-4xl tracking-[0.08em] text-[#f4ecd9]">Graceward</p>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.24em] text-[#d9bd76]">
                Mind · Body · Soul
              </p>
              <p className="mt-4 max-w-xs font-serif text-lg leading-7 text-[#f4ecd9]/90">
                Carry today’s formation gently: {dailyContent.theme.toLowerCase()}.
              </p>
              <p className="mt-2 text-sm font-semibold text-[#d9bd76]">{dailyContent.reference}</p>
            </motion.div>
          </motion.button>
        ) : null}
      </AnimatePresence>
    </section>
  );
};
