import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CompanionCreationLoader } from "./CompanionCreationLoader";
import {
  COMPANION_ELEMENTS,
  COMPANION_PRESETS,
  COMPANION_STORY_TONES,
  getCompanionElementAnchorColor,
  type CompanionElementId,
  type CompanionPresetId,
  type CompanionStoryTone,
} from "@/config/companionCatalog";
import {
  getPresetCompanionAssetUrl,
  getUniversalEggAssetUrl,
} from "@/lib/companionAssetResolver";

type CompanionPersonalizationMode = "onboarding" | "migration" | "hatch";

interface CompanionSelectionData {
  presetId: CompanionPresetId | null;
  favoriteColor: string;
  spiritAnimal: string;
  coreElement: CompanionElementId;
  storyTone: CompanionStoryTone;
}

interface CompanionPersonalizationProps {
  onComplete: (data: CompanionSelectionData) => void;
  isLoading?: boolean;
  mode?: CompanionPersonalizationMode;
  layout?: "fullscreen" | "compact";
  initialElement?: CompanionElementId;
  initialStoryTone?: CompanionStoryTone;
}

const AUTO_SCROLL_RELEASE_MS = 420;
const THEATRICAL_STAGE_LIGHTS = Array.from({ length: 7 }, (_, index) => index);

const getPresetPreviewUrl = (presetId: CompanionPresetId, element: CompanionElementId) =>
  getPresetCompanionAssetUrl({
    presetId,
    stage: 1,
    element,
    state: "normal",
  }) ?? "/placeholder-companion.svg";

const getEggPreviewUrl = (element: CompanionElementId) =>
  getUniversalEggAssetUrl(element);

const withHexAlpha = (hexColor: string, alpha: string) => `${hexColor}${alpha}`;

type SelectionOrigin = "direct" | "scroll";

export const CompanionPersonalization = ({
  onComplete,
  isLoading = false,
  mode = "onboarding",
  layout = "fullscreen",
  initialElement = "fire",
  initialStoryTone = "epic_adventure",
}: CompanionPersonalizationProps) => {
  const [selectedPresetId, setSelectedPresetId] = useState<CompanionPresetId>("dragon");
  const [selectedElement, setSelectedElement] = useState<CompanionElementId>(initialElement);
  const [selectedTone, setSelectedTone] = useState<CompanionStoryTone>(initialStoryTone);
  const [brokenPreviewKeys, setBrokenPreviewKeys] = useState<Record<string, boolean>>({});
  const isFullscreen = layout === "fullscreen";
  const isEggSelectionMode = mode === "onboarding";
  const isHatchMode = mode === "hatch";
  const eggCarouselRef = useRef<HTMLDivElement | null>(null);
  const eggCardRefs = useRef<Partial<Record<CompanionElementId, HTMLButtonElement | null>>>({});
  const hasAutoCenteredInitialEggRef = useRef(false);
  const selectionOriginRef = useRef<SelectionOrigin>("direct");
  const autoScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAutoScrollingRef = useRef(false);

  const selectedPreset = useMemo(
    () => COMPANION_PRESETS.find((preset) => preset.id === selectedPresetId) ?? COMPANION_PRESETS[0],
    [selectedPresetId],
  );
  const selectedElementMeta = useMemo(
    () => COMPANION_ELEMENTS.find((element) => element.id === selectedElement) ?? COMPANION_ELEMENTS[0],
    [selectedElement],
  );
  const selectedToneMeta = useMemo(
    () => COMPANION_STORY_TONES.find((tone) => tone.value === selectedTone) ?? COMPANION_STORY_TONES[0],
    [selectedTone],
  );
  const selectedElementIndex = useMemo(
    () => Math.max(0, COMPANION_ELEMENTS.findIndex((element) => element.id === selectedElement)),
    [selectedElement],
  );

  useEffect(() => {
    return () => {
      if (autoScrollTimeoutRef.current) {
        clearTimeout(autoScrollTimeoutRef.current);
      }
    };
  }, []);

  const finalizeSelection = () => {
    onComplete({
      presetId: isEggSelectionMode ? null : selectedPreset.id,
      favoriteColor: getCompanionElementAnchorColor(selectedElement),
      spiritAnimal: isEggSelectionMode ? "Egg" : selectedPreset.displayName,
      coreElement: selectedElement,
      storyTone: selectedTone,
    });
  };

  const markAutoScroll = (behavior: ScrollBehavior) => {
    if (autoScrollTimeoutRef.current) {
      clearTimeout(autoScrollTimeoutRef.current);
    }

    isAutoScrollingRef.current = behavior === "smooth";
    autoScrollTimeoutRef.current = setTimeout(() => {
      isAutoScrollingRef.current = false;
      autoScrollTimeoutRef.current = null;
    }, behavior === "smooth" ? AUTO_SCROLL_RELEASE_MS : 0);
  };

  const scrollEggIntoView = (elementId: CompanionElementId, behavior: ScrollBehavior) => {
    const target = eggCardRefs.current[elementId];
    markAutoScroll(behavior);
    target?.scrollIntoView?.({
      behavior,
      block: "nearest",
      inline: "center",
    });
  };

  const selectEgg = (elementId: CompanionElementId, origin: SelectionOrigin = "direct") => {
    selectionOriginRef.current = origin;
    setSelectedElement(elementId);
  };

  useEffect(() => {
    if (!isEggSelectionMode || !isFullscreen) return;

    if (selectionOriginRef.current === "scroll") {
      selectionOriginRef.current = "direct";
      return;
    }

    const behavior: ScrollBehavior = hasAutoCenteredInitialEggRef.current ? "smooth" : "auto";
    scrollEggIntoView(selectedElement, behavior);
    hasAutoCenteredInitialEggRef.current = true;
  }, [isEggSelectionMode, isFullscreen, selectedElement]);

  const handleEggCarouselScroll = () => {
    if (!isEggSelectionMode || !isFullscreen || isAutoScrollingRef.current) return;

    const carousel = eggCarouselRef.current;
    if (!carousel) return;

    const carouselRect = carousel.getBoundingClientRect();
    const carouselCenter = carouselRect.left + (carouselRect.width / 2);
    let nearestElementId: CompanionElementId | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    COMPANION_ELEMENTS.forEach((element) => {
      const card = eggCardRefs.current[element.id];
      if (!card) return;

      const cardRect = card.getBoundingClientRect();
      const cardCenter = cardRect.left + (cardRect.width / 2);
      const distance = Math.abs(cardCenter - carouselCenter);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestElementId = element.id;
      }
    });

    if (nearestElementId && nearestElementId !== selectedElement) {
      selectEgg(nearestElementId, "scroll");
    }
  };

  const selectAdjacentEgg = (direction: -1 | 1) => {
    const nextIndex = Math.max(
      0,
      Math.min(COMPANION_ELEMENTS.length - 1, selectedElementIndex + direction),
    );

    if (nextIndex === selectedElementIndex) return;
    selectEgg(COMPANION_ELEMENTS[nextIndex].id);
  };

  if (isLoading) {
    return <CompanionCreationLoader />;
  }

  const heading = isEggSelectionMode
    ? "Choose Your Egg"
    : isHatchMode
      ? "Your Egg Is Hatching"
      : "Choose Your Companion Form";
  const subheading = isEggSelectionMode
    ? "Select the elemental egg your journey begins with. The creature form will be chosen when it hatches."
    : isHatchMode
      ? "Choose the creature form your egg will awaken into. Its element and story tone stay locked from the egg you chose."
      : "Your companion needs a preset form before we can continue. Pick the creature, element skin, and story tone you want to carry forward.";
  const cta = isEggSelectionMode
    ? "Begin Your Journey"
    : isHatchMode
      ? "Hatch Companion"
      : "Save Companion Form";

  if (isEggSelectionMode && isFullscreen) {
    return (
      <div className="relative min-h-screen overflow-hidden px-4 pb-safe pt-safe-top">
        <div className="absolute inset-0 bg-[#05050b]" />
        <div
          className="absolute inset-0"
          style={{
            background: [
              `radial-gradient(circle at 50% 14%, ${withHexAlpha(selectedElementMeta.accentColor, "2a")} 0%, transparent 24%)`,
              `radial-gradient(circle at 50% 58%, ${withHexAlpha(selectedElementMeta.anchorColor, "26")} 0%, transparent 34%)`,
              "linear-gradient(180deg, #28163b 0%, #120b1d 28%, #08070f 62%, #04050a 100%)",
            ].join(", "),
          }}
        />

        <div className="absolute left-1/2 top-3 h-28 w-[min(96vw,72rem)] -translate-x-1/2 rounded-[999px] border border-[#f7d38b]/10 bg-[linear-gradient(180deg,rgba(252,214,120,0.12),rgba(103,56,16,0.04))] blur-sm" />
        <div className="absolute left-1/2 top-8 h-28 w-[min(94vw,70rem)] -translate-x-1/2 rounded-[2.5rem] border border-[#f7d38b]/12 bg-[linear-gradient(180deg,rgba(70,39,21,0.55),rgba(27,14,31,0.82))] shadow-[0_18px_70px_rgba(0,0,0,0.45)]" />
        <div className="absolute inset-x-0 top-20 flex justify-center gap-5 md:gap-10">
          {THEATRICAL_STAGE_LIGHTS.map((light) => (
            <div key={light} className="flex flex-col items-center gap-2 opacity-80">
              <div className="h-6 w-px bg-gradient-to-b from-amber-100/80 to-amber-200/10" />
              <div className="h-3 w-3 rounded-full bg-amber-200/90 shadow-[0_0_22px_rgba(251,191,36,0.8)]" />
            </div>
          ))}
        </div>

        <div className="absolute bottom-0 left-1/2 h-44 w-[130%] -translate-x-1/2 rounded-[100%] bg-[radial-gradient(circle_at_center,rgba(244,183,79,0.12),transparent_60%)] blur-3xl" />
        <div className="absolute -bottom-12 left-0 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-10 right-0 h-44 w-44 rounded-full bg-white/10 blur-3xl" />

        <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col justify-between py-6 md:py-8">
          <div className="space-y-3 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.34em] text-white/70 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-amber-200" />
              Final Onboarding Step
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl font-heading font-black tracking-tight text-white md:text-5xl">
                The Hatchery Awaits
              </h1>
              <p className="mx-auto max-w-2xl text-sm leading-6 text-white/70 md:text-base">
                Move left or right until an egg settles in the center. The one glowing before you
                becomes the first form of your companion.
              </p>
            </div>
          </div>

          <div className="relative mt-6 flex-1">
            <div className="absolute inset-x-0 top-8 h-[26rem] rounded-[2.75rem] border border-[#f7d38b]/10 bg-[linear-gradient(180deg,rgba(53,28,56,0.58),rgba(8,8,17,0.86))] shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-md md:h-[30rem]" />
            <div
              className="absolute inset-x-8 bottom-12 h-24 rounded-full blur-[60px]"
              style={{
                background: `radial-gradient(circle, ${withHexAlpha(selectedElementMeta.anchorColor, "55")} 0%, transparent 68%)`,
              }}
            />
            <div className="absolute inset-x-8 bottom-12 h-7 rounded-full border border-[#f7d38b]/20 bg-[linear-gradient(180deg,rgba(244,200,115,0.25),rgba(109,62,22,0.45))]" />
            <div className="absolute inset-x-16 bottom-6 h-16 rounded-[999px] border border-[#f7d38b]/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]" />

            <button
              type="button"
              onClick={() => selectAdjacentEgg(-1)}
              disabled={selectedElementIndex === 0}
              className="absolute left-0 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-[#f7d38b]/20 bg-black/35 text-white/80 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:bg-black/50 disabled:cursor-not-allowed disabled:opacity-35 md:left-4 md:h-14 md:w-14"
              aria-label="Previous egg"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => selectAdjacentEgg(1)}
              disabled={selectedElementIndex === COMPANION_ELEMENTS.length - 1}
              className="absolute right-0 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-[#f7d38b]/20 bg-black/35 text-white/80 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:bg-black/50 disabled:cursor-not-allowed disabled:opacity-35 md:right-4 md:h-14 md:w-14"
              aria-label="Next egg"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <div
              ref={eggCarouselRef}
              onScroll={handleEggCarouselScroll}
              className="relative z-10 flex h-[26rem] items-end gap-1 overflow-x-auto overscroll-x-contain pb-10 pt-12 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:h-[30rem]"
            >
              <div
                aria-hidden
                className="shrink-0"
                style={{ width: "max(1rem, calc(50% - 7rem))" }}
              />

              {COMPANION_ELEMENTS.map((element, index) => {
                const isSelected = element.id === selectedElement;
                const distance = Math.abs(index - selectedElementIndex);
                const scale = isSelected ? 1 : distance === 1 ? 0.84 : distance === 2 ? 0.7 : 0.58;
                const opacity = isSelected ? 1 : distance === 1 ? 0.72 : distance === 2 ? 0.42 : 0.22;

                return (
                  <motion.button
                    key={element.id}
                    ref={(node) => {
                      eggCardRefs.current[element.id] = node;
                    }}
                    type="button"
                    onClick={() => selectEgg(element.id)}
                    aria-label={`${element.productLabel} egg`}
                    aria-pressed={isSelected}
                    animate={{ opacity, scale }}
                    transition={{ type: "spring", stiffness: 240, damping: 26 }}
                    className="group relative flex w-[14rem] shrink-0 snap-center flex-col items-center justify-end bg-transparent px-2 pb-2 pt-4 text-center outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-0 md:w-[15rem]"
                  >
                    <div className="relative flex h-[17rem] w-full items-end justify-center md:h-[20rem]">
                      <div
                        className="absolute bottom-20 h-24 w-24 rounded-full blur-[52px] transition-opacity duration-300"
                        style={{
                          backgroundColor: element.anchorColor,
                          opacity: isSelected ? 0.78 : 0.22,
                        }}
                      />
                      <div
                        className="absolute bottom-10 h-6 w-40 rounded-full"
                        style={{
                          background: `radial-gradient(circle, ${withHexAlpha(element.anchorColor, isSelected ? "bb" : "44")} 0%, transparent 72%)`,
                        }}
                      />

                      {isSelected && (
                        <motion.div
                          className="absolute bottom-28 h-36 w-36 rounded-full border"
                          style={{
                            borderColor: withHexAlpha(element.accentColor, "55"),
                            boxShadow: `0 0 36px ${withHexAlpha(element.accentColor, "44")}`,
                          }}
                          animate={{
                            scale: [0.96, 1.04, 0.96],
                            opacity: [0.45, 0.85, 0.45],
                          }}
                          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                        />
                      )}

                      <motion.div
                        animate={isSelected ? { y: [0, -10, 0] } : { y: 0 }}
                        transition={isSelected
                          ? { duration: 2.9, repeat: Infinity, ease: "easeInOut" }
                          : { duration: 0.3 }}
                        className="relative z-10 flex items-end justify-center"
                      >
                        <img
                          src={getEggPreviewUrl(element.id)}
                          alt={`${element.productLabel} Egg`}
                          className="h-[13.5rem] w-auto object-contain drop-shadow-[0_22px_30px_rgba(0,0,0,0.55)] md:h-[15.5rem]"
                          loading="lazy"
                        />
                      </motion.div>

                      <div className="absolute bottom-4 h-10 w-32 rounded-[999px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))] backdrop-blur-sm" />
                      <div className="absolute bottom-0 h-14 w-44 rounded-[999px] border border-[#f2c879]/20 bg-[linear-gradient(180deg,rgba(249,212,135,0.28),rgba(76,46,21,0.55))] shadow-[0_12px_40px_rgba(0,0,0,0.45)]" />
                      <div
                        className="absolute bottom-2 h-2.5 w-10 rounded-full transition-all duration-300"
                        style={{
                          backgroundColor: isSelected ? element.anchorColor : "rgba(255,255,255,0.14)",
                          boxShadow: isSelected ? `0 0 18px ${withHexAlpha(element.anchorColor, "bb")}` : "none",
                        }}
                      />
                    </div>

                    <div className="mt-2 space-y-1">
                      <div className="text-base font-semibold text-white md:text-lg">
                        {element.productLabel} Egg
                      </div>
                      <div className="text-[11px] uppercase tracking-[0.28em] text-white/55">
                        {isSelected ? "Centered" : "Move Closer"}
                      </div>
                    </div>
                  </motion.button>
                );
              })}

              <div
                aria-hidden
                className="shrink-0"
                style={{ width: "max(1rem, calc(50% - 7rem))" }}
              />
            </div>
          </div>

          <div className="mx-auto mt-2 w-full max-w-4xl rounded-[2rem] border border-white/10 bg-black/35 p-4 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl md:p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <div
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-white/75"
                  style={{
                    borderColor: withHexAlpha(selectedElementMeta.accentColor, "44"),
                    backgroundColor: withHexAlpha(selectedElementMeta.anchorColor, "1f"),
                  }}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor: selectedElementMeta.anchorColor,
                      boxShadow: `0 0 14px ${withHexAlpha(selectedElementMeta.anchorColor, "cc")}`,
                    }}
                  />
                  Current Selection
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-heading font-black text-white md:text-3xl">
                    {selectedElementMeta.productLabel} Egg
                  </h2>
                  <p className="max-w-2xl text-sm leading-6 text-white/70 md:text-base">
                    {selectedElementMeta.summary} This element becomes the permanent core of your
                    companion, while the story tone below shapes the feeling of the journey ahead.
                  </p>
                </div>
              </div>

              <Button
                onClick={finalizeSelection}
                disabled={isLoading}
                size="lg"
                className="min-w-[220px] border-0 text-white shadow-[0_20px_40px_rgba(0,0,0,0.35)] hover:opacity-95"
                style={{
                  background: `linear-gradient(135deg, ${selectedElementMeta.accentColor}, ${selectedElementMeta.anchorColor})`,
                  boxShadow: `0 20px 50px ${withHexAlpha(selectedElementMeta.anchorColor, "44")}`,
                }}
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {cta}
              </Button>
            </div>

            <div className="mt-5 border-t border-white/10 pt-5">
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-[0.28em] text-white/55">Story Tone</div>
                <p className="text-sm text-white/60">
                  Choose how the bond should feel once your egg begins its story.
                </p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {COMPANION_STORY_TONES.map((tone) => {
                  const isSelected = selectedTone === tone.value;

                  return (
                    <button
                      key={tone.value}
                      type="button"
                      onClick={() => setSelectedTone(tone.value)}
                      className={[
                        "rounded-2xl border p-4 text-left transition-all duration-200",
                        isSelected
                          ? "border-white/30 bg-white/12 shadow-[0_10px_30px_rgba(0,0,0,0.22)]"
                          : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8",
                      ].join(" ")}
                    >
                      <div className="text-sm font-semibold text-white">{tone.label}</div>
                      <p className="mt-2 text-xs leading-5 text-white/58">{tone.summary}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={isFullscreen ? "min-h-screen px-4 pt-safe pb-safe flex items-center justify-center relative z-10" : "w-full"}>
      <div className={`w-full ${isFullscreen ? "max-w-5xl p-8" : "p-2"} space-y-8 animate-scale-in cosmic-glass rounded-3xl border border-white/10`}>
        <div className="text-center space-y-4">
          <h1 className="text-3xl md:text-4xl font-heading font-black bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            {heading}
          </h1>
          <div className="space-y-2 max-w-2xl mx-auto">
            <p className="text-lg font-medium text-foreground">
              {isEggSelectionMode
                ? "Your companion begins as a living elemental egg."
                : isHatchMode
                  ? "The shell is cracking and the reveal is yours to choose."
                  : "This keeps your bond while moving to the new preset system."}
            </p>
            <p className="text-sm text-muted-foreground">
              {subheading}
            </p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-lg font-semibold text-foreground">
                {isEggSelectionMode ? "Elemental Eggs" : isHatchMode ? "Hatch Reveal" : "Reveal Carousel"}
              </Label>
              <p className="text-sm text-muted-foreground">
                {isEggSelectionMode
                  ? "Choose the egg that feels most like the energy you want to carry into your journey."
                  : isHatchMode
                    ? "Pick the creature form your egg will awaken into."
                    : "Scroll through the companion roster and tap a card to lock your companion."}
              </p>
            </div>

            {isEggSelectionMode ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {COMPANION_ELEMENTS.map((element) => {
                  const isSelected = element.id === selectedElement;
                  return (
                    <button
                      key={element.id}
                      type="button"
                      onClick={() => setSelectedElement(element.id)}
                      className={[
                        "rounded-3xl border text-left transition-all duration-300 overflow-hidden",
                        isSelected
                          ? "border-primary/70 bg-primary/10 shadow-[0_0_40px_rgba(168,85,247,0.20)] scale-[1.01]"
                          : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10",
                      ].join(" ")}
                    >
                      <div className="relative h-[220px] bg-gradient-to-br from-slate-950/80 via-slate-900/80 to-slate-950/95">
                        <img
                          src={getEggPreviewUrl(element.id)}
                          alt={`${element.productLabel} Egg`}
                          className="h-full w-full object-contain p-4"
                          loading="lazy"
                        />
                        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-lg font-heading font-bold text-white">
                                {element.productLabel} Egg
                              </div>
                              <div className="text-xs uppercase tracking-[0.2em] text-white/55">
                                Level 0 • Egg
                              </div>
                            </div>
                            {isSelected && (
                              <span className="rounded-full border border-primary/60 bg-primary/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-foreground">
                                Selected
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="p-4 space-y-2">
                        <p className="text-sm text-foreground/90">
                          {element.summary}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          This egg permanently sets your companion&apos;s element.
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory">
                {COMPANION_PRESETS.map((preset) => {
                  const previewUrl = getPresetPreviewUrl(preset.id, selectedElement);
                  const previewKey = `${preset.id}:${selectedElement}`;
                  const isSelected = preset.id === selectedPreset.id;

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedPresetId(preset.id)}
                      className={[
                        "snap-center shrink-0 w-[250px] rounded-3xl border text-left transition-all duration-300 overflow-hidden",
                        isSelected
                          ? "border-primary/70 bg-primary/10 shadow-[0_0_40px_rgba(168,85,247,0.20)] scale-[1.01]"
                          : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10",
                      ].join(" ")}
                    >
                      <div className="relative h-[260px] bg-gradient-to-br from-slate-950/80 via-slate-900/80 to-slate-950/95">
                        {!brokenPreviewKeys[previewKey] ? (
                          <img
                            src={previewUrl}
                            alt={preset.displayName}
                            className="h-full w-full object-contain p-4"
                            loading="lazy"
                            onError={() =>
                              setBrokenPreviewKeys((current) => ({
                                ...current,
                                [previewKey]: true,
                              }))
                            }
                          />
                        ) : (
                          <div className="h-full w-full p-5 flex flex-col justify-between">
                            <div
                              className="h-28 w-28 rounded-full blur-3xl"
                              style={{ backgroundColor: selectedElementMeta.anchorColor }}
                            />
                            <div className="space-y-2">
                              <div className="text-xs uppercase tracking-[0.3em] text-white/50">
                                Companion Preset
                              </div>
                              <div className="text-3xl font-heading font-black text-white">
                                {preset.displayName}
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-lg font-heading font-bold text-white">
                                {preset.displayName}
                              </div>
                              <div className="text-xs uppercase tracking-[0.2em] text-white/55">
                                {preset.role}
                              </div>
                            </div>
                            {isSelected && (
                              <span className="rounded-full border border-primary/60 bg-primary/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-foreground">
                                Selected
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="p-4 space-y-2">
                        <p className="text-sm text-foreground/90">
                          {preset.revealCopy}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {preset.signatureIdentity}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4">
              <div className="space-y-1">
                <Label className="text-lg font-semibold text-foreground">
                  {isEggSelectionMode ? "Selected Egg" : "Selected Companion"}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {isEggSelectionMode
                    ? `${selectedElementMeta.productLabel} energy sealed inside a living cosmic shell.`
                    : `${selectedPreset.displayName} with a ${selectedElementMeta.productLabel.toLowerCase()} skin.`}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                {isEggSelectionMode ? (
                  <div className="space-y-3">
                    <div className="mx-auto h-44 w-44">
                      <img
                        src={getEggPreviewUrl(selectedElement)}
                        alt={`${selectedElementMeta.productLabel} Egg`}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="text-sm font-medium text-foreground">{selectedElementMeta.productLabel} Egg</div>
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Creature form revealed at first hatch</div>
                    <p className="text-sm text-foreground/85">{selectedElementMeta.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      Level 0 is shared across the roster. The egg locks your element now, and you&apos;ll choose the creature form when it hatches.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="text-sm font-medium text-foreground">{selectedPreset.displayName}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">{selectedPreset.role}</div>
                    <p className="mt-3 text-sm text-foreground/85">{selectedPreset.signatureIdentity}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{selectedPreset.anatomyLock}</p>
                  </>
                )}
              </div>
            </div>

            {!isEggSelectionMode && isHatchMode && (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4">
                <div className="space-y-1">
                  <Label className="text-lg font-semibold text-foreground">Locked From Your Egg</Label>
                  <p className="text-sm text-muted-foreground">
                    Hatch selection only sets the creature form. Your element and story tone stay the same.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Element</div>
                    <div className="mt-2 font-semibold text-foreground">{selectedElementMeta.productLabel}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{selectedElementMeta.summary}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Story Tone</div>
                    <div className="mt-2 font-semibold text-foreground">{selectedToneMeta.label}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{selectedToneMeta.summary}</p>
                  </div>
                </div>
              </div>
            )}

            {!isEggSelectionMode && !isHatchMode && (
              <div className="space-y-3">
                <Label className="text-lg font-semibold text-foreground">Element Skin</Label>
                <div className="grid grid-cols-2 gap-3">
                  {COMPANION_ELEMENTS.map((element) => {
                    const isSelected = selectedElement === element.id;
                    return (
                      <button
                        key={element.id}
                        type="button"
                        onClick={() => setSelectedElement(element.id)}
                        className={[
                          "rounded-2xl border-2 p-4 text-left transition-all duration-200",
                          isSelected
                            ? "border-primary bg-primary/15 shadow-lg shadow-primary/15"
                            : "border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/10",
                        ].join(" ")}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="h-4 w-4 rounded-full shadow-[0_0_16px_currentColor]"
                            style={{ backgroundColor: element.anchorColor, color: element.anchorColor }}
                          />
                          <div className="font-semibold text-foreground">{element.productLabel}</div>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{element.summary}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {!isHatchMode && (
              <div className="space-y-3">
                <Label className="text-lg font-semibold text-foreground">Story Tone</Label>
                <div className="grid gap-3">
                  {COMPANION_STORY_TONES.map((tone) => {
                    const isSelected = selectedTone === tone.value;
                    return (
                      <button
                        key={tone.value}
                        type="button"
                        onClick={() => setSelectedTone(tone.value)}
                        className={[
                          "rounded-2xl border-2 p-4 text-left transition-all duration-200",
                          isSelected
                            ? "border-primary bg-primary/15 shadow-lg shadow-primary/10"
                            : "border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/10",
                        ].join(" ")}
                      >
                        <div className="font-semibold text-foreground">{tone.label}</div>
                        <p className="mt-1 text-xs text-muted-foreground">{tone.summary}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {isEggSelectionMode
                  ? `${selectedElementMeta.productLabel} Egg • ${selectedToneMeta.label}`
                  : `${selectedPreset.displayName} • ${selectedElementMeta.productLabel} • ${selectedToneMeta.label}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {isEggSelectionMode
                  ? "Your egg locks the element now. Creature form is chosen when the shell cracks."
                  : isHatchMode
                    ? "Hatching preserves the egg&apos;s element and story tone while locking the creature form."
                    : "Your companion art will resolve from shared preset assets while the tone shapes the story only."}
              </p>
            </div>
            <Button
              onClick={finalizeSelection}
              disabled={isLoading}
              className="min-w-[220px]"
              size="lg"
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {cta}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
