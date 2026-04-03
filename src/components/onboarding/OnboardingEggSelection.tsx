import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CompanionCreationLoader } from "@/components/CompanionCreationLoader";
import { OnboardingStageShell } from "./OnboardingStageShell";
import {
  COMPANION_ELEMENTS,
  COMPANION_STORY_TONES,
  getCompanionElement,
  getCompanionPreset,
  type CompanionElementId,
  type CompanionPresetId,
  type CompanionStoryTone,
} from "@/config/companionCatalog";
import { getPresetCompanionAssetUrl, getUniversalEggAssetUrl } from "@/lib/companionAssetResolver";

const SPECIES_PREVIEW_ELEMENT = "light";
const EGG_CHAMBER_PEDESTAL_SRC = "/onboarding/egg-chamber/all_pedestals.png";

type EggChamberSlotConfig = {
  column: 1 | 2 | 3;
  row: 1 | 2;
  eggSrc: string | null;
  eggScale: number;
  bounceDelay: string;
  glowColor: string;
};

const EGG_CHAMBER_SLOT_CONFIG: Record<CompanionElementId, EggChamberSlotConfig> = {
  fire: {
    column: 1,
    row: 1,
    eggSrc: "/onboarding/egg-chamber/ember_egg.png",
    eggScale: 1,
    bounceDelay: "0s",
    glowColor: "#F97316",
  },
  ice: {
    column: 2,
    row: 1,
    eggSrc: "/onboarding/egg-chamber/frost_egg.png",
    eggScale: 1.06,
    bounceDelay: "-0.55s",
    glowColor: "#60A5FA",
  },
  storm: {
    column: 2,
    row: 2,
    eggSrc: "/onboarding/egg-chamber/storm_egg.png",
    eggScale: 1.01,
    bounceDelay: "-1.1s",
    glowColor: "#38BDF8",
  },
  nature: {
    column: 3,
    row: 1,
    eggSrc: null,
    eggScale: 1.02,
    bounceDelay: "-1.65s",
    glowColor: "#34D399",
  },
  void: {
    column: 1,
    row: 2,
    eggSrc: "/onboarding/egg-chamber/void_egg.png",
    eggScale: 0.98,
    bounceDelay: "-2.2s",
    glowColor: "#7C3AED",
  },
  light: {
    column: 3,
    row: 2,
    eggSrc: "/onboarding/egg-chamber/light_egg.png",
    eggScale: 1,
    bounceDelay: "-2.75s",
    glowColor: "#FACC15",
  },
};

const getSpeciesPreviewUrl = (presetId: CompanionPresetId) =>
  getPresetCompanionAssetUrl({
    presetId,
    stage: 1,
    element: SPECIES_PREVIEW_ELEMENT,
    state: "normal",
  }) ?? "/placeholder-companion.svg";

const getEggChamberEggSrc = (elementId: CompanionElementId) =>
  EGG_CHAMBER_SLOT_CONFIG[elementId].eggSrc ?? getUniversalEggAssetUrl(elementId);

interface OnboardingEggSelectionProps {
  presetId: CompanionPresetId;
  storyTone: CompanionStoryTone;
  selectedElement: CompanionElementId | null;
  onSelectElement: (element: CompanionElementId) => void;
  onBack: () => void;
  onContinue: () => void;
  isLoading?: boolean;
  mode?: "standard" | "reset";
}

export const OnboardingEggSelection = ({
  presetId,
  storyTone,
  selectedElement,
  onSelectElement,
  onBack,
  onContinue,
  isLoading = false,
  mode = "standard",
}: OnboardingEggSelectionProps) => {
  const prefersReducedMotion = useReducedMotion();

  if (isLoading) {
    return <CompanionCreationLoader />;
  }

  const preset = getCompanionPreset(presetId);
  const selectedTone = COMPANION_STORY_TONES.find((tone) => tone.value === storyTone) ?? COMPANION_STORY_TONES[0];
  const selectedElementMeta = selectedElement ? getCompanionElement(selectedElement) : null;
  const activeGlow = selectedElementMeta?.anchorColor ?? "#F4D39B";
  const eyebrow = mode === "reset" ? "Egg Rebinding" : "Element Chamber";
  const title = mode === "reset" ? "Choose A New Elemental Egg" : "Choose The Egg That Will Carry Your Companion";
  const description = preset
    ? `The hatchery already knows your ${preset.displayName}. Now choose the element that will seal its first shell and color its legend.`
    : "Choose the element that will seal your companion's first shell.";

  return (
    <OnboardingStageShell
      width="full"
      align="top"
      accent="34 94% 70%"
      eyebrow={eyebrow}
      title={title}
      description={description}
      hero={
        <div className="onb-stage-emblem">
          <Shield className="h-9 w-9 text-[#ffe2a3]" />
        </div>
      }
      bodyClassName="mx-auto w-full max-w-5xl"
    >
      <div className="space-y-5">
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.34, ease: "easeOut" }}
          className="onb-stage-panel overflow-hidden p-3 sm:p-4 md:p-5"
        >
          <div className="mb-4 flex items-center justify-between gap-4 px-2 sm:px-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.34em] text-[#f4d39b]/68">
                Elemental Egg Chamber
              </p>
              <h2 className="mt-2 font-cinzel text-2xl font-semibold text-[#fff4df] md:text-3xl">
                Choose your element
              </h2>
            </div>
            <div className="hidden rounded-full border border-[#f4d39b]/18 bg-black/20 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-[#f4d39b]/70 md:block">
              2 x 3 chamber
            </div>
          </div>

          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.38, ease: "easeOut", delay: 0.04 }}
            className="onb-egg-chamber-shell"
          >
            <div
              className="onb-egg-chamber"
              data-testid="egg-chamber"
              style={{
                backgroundImage: `
                  radial-gradient(44% 28% at 50% 19%, ${activeGlow}26 0%, transparent 82%),
                  radial-gradient(26% 24% at 18% 18%, rgba(255, 190, 94, 0.18) 0%, transparent 82%),
                  radial-gradient(30% 22% at 82% 22%, rgba(255, 238, 194, 0.16) 0%, transparent 84%),
                  linear-gradient(180deg, rgba(85, 48, 20, 0.94) 0%, rgba(54, 31, 18, 0.94) 26%, rgba(35, 20, 15, 0.98) 72%, rgba(18, 11, 10, 1) 100%)
                `,
              }}
            >
              <div className="onb-egg-chamber__mist" aria-hidden="true" />
              <img
                src={EGG_CHAMBER_PEDESTAL_SRC}
                alt=""
                aria-hidden="true"
                className="onb-egg-chamber__pedestals"
              />

              <div className="onb-egg-chamber__grid">
                {COMPANION_ELEMENTS.map((element) => {
                  const slot = EGG_CHAMBER_SLOT_CONFIG[element.id];
                  const isSelected = element.id === selectedElement;

                  return (
                    <button
                      key={element.id}
                      type="button"
                      onClick={() => onSelectElement(element.id)}
                      className="onb-egg-slot"
                      aria-pressed={isSelected}
                      aria-label={`${element.productLabel} egg`}
                      data-testid={`egg-slot-${element.id}`}
                      data-selected={isSelected ? "true" : "false"}
                      data-animated={prefersReducedMotion ? "false" : "true"}
                      style={{
                        gridColumn: String(slot.column),
                        gridRow: String(slot.row),
                        ["--egg-glow" as string]: slot.glowColor,
                        ["--egg-accent" as string]: element.accentColor,
                        ["--egg-bounce-delay" as string]: slot.bounceDelay,
                        ["--egg-scale" as string]: String(slot.eggScale),
                      }}
                    >
                      <span className="onb-egg-slot__body">
                        <span className="onb-egg-slot__ambient" aria-hidden="true" />
                        <span className="onb-egg-slot__pedestal-flare" aria-hidden="true" />
                        <span className="onb-egg-slot__egg-shell" aria-hidden="true">
                          <span
                            className={cn(
                              "onb-egg-slot__egg-float",
                              !prefersReducedMotion && "onb-egg-slot__egg-float--animated",
                            )}
                          >
                            <span className="onb-egg-slot__aura" />
                            <img
                              src={getEggChamberEggSrc(element.id)}
                              alt=""
                              className="onb-egg-slot__egg"
                            />
                          </span>
                        </span>
                        <span className="onb-egg-slot__label font-cinzel text-lg font-semibold">
                          {element.productLabel}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.32, ease: "easeOut", delay: 0.08 }}
          className="onb-stage-panel p-4 sm:p-5"
        >
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[auto_1fr_auto] lg:items-center">
            <div className="flex items-center gap-3">
              <div className="onb-stage-creature-frame h-16 w-16 shrink-0">
                {preset ? (
                  <img
                    src={getSpeciesPreviewUrl(preset.id)}
                    alt={preset.displayName}
                    className="h-12 w-12 object-contain drop-shadow-[0_14px_28px_rgba(0,0,0,0.38)]"
                  />
                ) : null}
              </div>

              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.3em] text-[#f4d39b]/60">
                  Bound creature
                </p>
                <h2 className="mt-1 font-cinzel text-2xl font-semibold text-[#fff4df]">
                  {preset?.displayName ?? "Unknown"}
                </h2>
              </div>
            </div>

            <div className="min-w-0">
              <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.34em] text-[#f4d39b]/64">
                <Sparkles className="h-3.5 w-3.5" />
                Ceremony Summary
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="onb-stage-card min-w-[10.5rem] flex-1 px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-[#f4d39b]/58">
                    Story tone
                  </p>
                  <p className="mt-2 font-cinzel text-xl font-semibold text-[#fff4df]">
                    {selectedTone.label}
                  </p>
                </div>

                <div className="onb-stage-card min-w-[10.5rem] flex-1 px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-[#f4d39b]/58">
                    Element seal
                  </p>
                  <p className="mt-2 font-cinzel text-xl font-semibold text-[#fff4df]">
                    {selectedElementMeta?.productLabel ?? "Awaiting your egg"}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-sm leading-6 text-[#f7ead6]/70">
                {selectedElementMeta
                  ? `A ${selectedElementMeta.productLabel.toLowerCase()} egg will now carry your ${preset?.displayName?.toLowerCase() ?? "companion"} into the first chapter of its story.`
                  : "Choose one of the six elemental eggs to lock the creature, story tone, and shell together."}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Button
                type="button"
                variant="outline"
                onClick={onBack}
                className="h-14 rounded-full border-[#f3cd84]/22 bg-black/20 px-6 text-[#fff4df] hover:bg-black/30"
              >
                <ArrowLeft className="h-5 w-5" />
                Back
              </Button>

              <Button
                type="button"
                onClick={onContinue}
                disabled={!selectedElement}
                size="lg"
                className="onb-stage-cta h-14 rounded-full px-6 text-base font-semibold"
              >
                Seal My Egg
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </OnboardingStageShell>
  );
};
