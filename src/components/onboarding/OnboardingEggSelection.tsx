import { motion } from "framer-motion";
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

const getSpeciesPreviewUrl = (presetId: CompanionPresetId) =>
  getPresetCompanionAssetUrl({
    presetId,
    stage: 1,
    element: SPECIES_PREVIEW_ELEMENT,
    state: "normal",
  }) ?? "/placeholder-companion.svg";

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
  if (isLoading) {
    return <CompanionCreationLoader />;
  }

  const preset = getCompanionPreset(presetId);
  const selectedTone = COMPANION_STORY_TONES.find((tone) => tone.value === storyTone) ?? COMPANION_STORY_TONES[0];
  const selectedElementMeta = selectedElement ? getCompanionElement(selectedElement) : null;
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
      bodyClassName="mx-auto w-full max-w-6xl"
    >
      <div className="grid gap-6 xl:grid-cols-[1.04fr_0.96fr]">
        <div className="onb-stage-panel p-5 sm:p-6 md:p-7">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.34em] text-[#f4d39b]/68">
                Elemental Egg Chamber
              </p>
              <h2 className="mt-2 font-cinzel text-2xl font-semibold text-[#fff4df] md:text-3xl">
                Choose your element
              </h2>
            </div>
            <div className="hidden rounded-full border border-[#f4d39b]/18 bg-black/20 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-[#f4d39b]/70 md:block">
              2 x 3 selection
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {COMPANION_ELEMENTS.map((element, index) => {
              const isSelected = element.id === selectedElement;
              return (
                <motion.button
                  key={element.id}
                  type="button"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * index }}
                  onClick={() => onSelectElement(element.id)}
                  className={cn(
                    "group relative overflow-hidden rounded-[1.65rem] border px-4 pb-4 pt-5 text-center transition",
                    isSelected
                      ? "border-[#f3cd84]/72 bg-[linear-gradient(180deg,rgba(92,54,19,0.74),rgba(39,19,12,0.94))] shadow-[0_22px_65px_rgba(243,205,132,0.18)]"
                      : "border-[#f3cd84]/12 bg-[linear-gradient(180deg,rgba(33,18,12,0.8),rgba(18,10,9,0.94))] hover:border-[#f3cd84]/32 hover:bg-[linear-gradient(180deg,rgba(54,31,19,0.82),rgba(18,10,9,0.96))]",
                  )}
                  aria-pressed={isSelected}
                  aria-label={`${element.productLabel} egg`}
                >
                  <div
                    className="pointer-events-none absolute inset-x-5 top-3 h-16 rounded-full blur-3xl"
                    style={{
                      background: `radial-gradient(circle, ${element.anchorColor}55 0%, transparent 72%)`,
                    }}
                  />
                  <div
                    className="pointer-events-none absolute inset-x-8 bottom-5 h-6 rounded-full blur-2xl"
                    style={{
                      background: `radial-gradient(circle, ${element.anchorColor}72 0%, transparent 75%)`,
                    }}
                  />

                  <div className="relative mb-4 flex min-h-[10.5rem] items-end justify-center">
                    <div
                      className="pointer-events-none absolute bottom-2 h-7 w-28 rounded-full border border-[#f3cd84]/20"
                      style={{
                        background: "linear-gradient(180deg, rgba(247, 206, 124, 0.32), rgba(121, 68, 24, 0.52))",
                      }}
                    />
                    <div
                      className="pointer-events-none absolute bottom-0 h-12 w-32 rounded-[999px] border border-[#f3cd84]/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]"
                    />
                    <img
                      src={getUniversalEggAssetUrl(element.id)}
                      alt={`${element.productLabel} Egg`}
                      className={cn(
                        "relative z-10 h-36 w-auto object-contain drop-shadow-[0_24px_45px_rgba(0,0,0,0.42)] transition-transform duration-200",
                        isSelected ? "scale-[1.06]" : "group-hover:scale-[1.03]",
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-cinzel text-2xl font-semibold text-[#fff4df]">
                      {element.productLabel}
                    </h3>
                    <p className="text-sm leading-6 text-[#f7ead6]/68">
                      {element.summary}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="onb-stage-panel p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="onb-stage-creature-frame">
                {preset ? (
                  <img
                    src={getSpeciesPreviewUrl(preset.id)}
                    alt={preset.displayName}
                    className="h-24 w-24 object-contain drop-shadow-[0_14px_28px_rgba(0,0,0,0.38)]"
                  />
                ) : null}
              </div>

              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.3em] text-[#f4d39b]/60">
                  Bound creature
                </p>
                <h2 className="mt-1 font-cinzel text-3xl font-semibold text-[#fff4df]">
                  {preset?.displayName ?? "Unknown"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#f7ead6]/68">
                  {preset?.revealCopy ?? "The hatchery has recorded your chosen creature spirit."}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="onb-stage-card p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-[#f4d39b]/58">
                  Story tone
                </p>
                <p className="mt-2 font-cinzel text-2xl font-semibold text-[#fff4df]">
                  {selectedTone.label}
                </p>
                <p className="mt-2 text-sm leading-6 text-[#f7ead6]/68">
                  {selectedTone.summary}
                </p>
              </div>

              <div className="onb-stage-card p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-[#f4d39b]/58">
                  Element seal
                </p>
                <p className="mt-2 font-cinzel text-2xl font-semibold text-[#fff4df]">
                  {selectedElementMeta?.productLabel ?? "Awaiting your egg"}
                </p>
                <p className="mt-2 text-sm leading-6 text-[#f7ead6]/68">
                  {selectedElementMeta?.summary ?? "Choose one of the six elemental eggs to seal your companion's first shell."}
                </p>
              </div>
            </div>
          </div>

          <div className="onb-stage-panel p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.34em] text-[#f4d39b]/64">
              <Sparkles className="h-3.5 w-3.5" />
              Ceremony Summary
            </div>

            <div className="onb-stage-card overflow-hidden p-4">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.15rem] border border-[#f3cd84]/18 bg-black/20"
                  style={{
                    boxShadow: selectedElementMeta
                      ? `0 0 24px ${selectedElementMeta.anchorColor}40`
                      : undefined,
                  }}
                >
                  {selectedElementMeta ? (
                    <img
                      src={getUniversalEggAssetUrl(selectedElementMeta.id)}
                      alt={`${selectedElementMeta.productLabel} Egg`}
                      className="h-12 w-12 object-contain"
                    />
                  ) : (
                    <Shield className="h-6 w-6 text-[#f4d39b]/60" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-cinzel text-2xl font-semibold text-[#fff4df]">
                    {selectedElementMeta
                      ? `${selectedElementMeta.productLabel} ${preset?.displayName ?? "Companion"}`
                      : "Awaiting your final seal"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#f7ead6]/68">
                    {selectedElementMeta
                      ? `A ${selectedElementMeta.productLabel.toLowerCase()} egg will now carry your ${preset?.displayName?.toLowerCase() ?? "companion"} into the first chapter of its story.`
                      : "Make an egg selection to lock the element, creature form, and story tone together."}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
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
                className="onb-stage-cta h-14 flex-1 rounded-full px-6 text-base font-semibold"
              >
                Seal My Egg
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </OnboardingStageShell>
  );
};
