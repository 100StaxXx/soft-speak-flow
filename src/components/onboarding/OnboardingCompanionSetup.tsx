import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Crown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OnboardingStageShell } from "./OnboardingStageShell";
import {
  COMPANION_PRESETS,
  COMPANION_STORY_TONES,
  type CompanionPresetId,
  type CompanionStoryTone,
} from "@/config/companionCatalog";
import { getPresetCompanionAssetUrl } from "@/lib/companionAssetResolver";

const SPECIES_PREVIEW_ELEMENT = "light";

const getSpeciesPreviewUrl = (presetId: CompanionPresetId) =>
  getPresetCompanionAssetUrl({
    presetId,
    stage: 1,
    element: SPECIES_PREVIEW_ELEMENT,
    state: "normal",
  }) ?? "/placeholder-companion.svg";

interface OnboardingCompanionSetupProps {
  selectedPresetId: CompanionPresetId | null;
  selectedStoryTone: CompanionStoryTone | null;
  onSelectPreset: (presetId: CompanionPresetId) => void;
  onSelectStoryTone: (storyTone: CompanionStoryTone) => void;
  onContinue: () => void;
  mode?: "standard" | "reset";
}

export const OnboardingCompanionSetup = ({
  selectedPresetId,
  selectedStoryTone,
  onSelectPreset,
  onSelectStoryTone,
  onContinue,
  mode = "standard",
}: OnboardingCompanionSetupProps) => {
  const selectedPreset = COMPANION_PRESETS.find((preset) => preset.id === selectedPresetId) ?? null;
  const selectedTone = COMPANION_STORY_TONES.find((tone) => tone.value === selectedStoryTone) ?? null;
  const canContinue = Boolean(selectedPreset && selectedTone);
  const eyebrow = mode === "reset" ? "Companion Rebinding" : "Companion Oath";
  const title = mode === "reset" ? "Choose Your Companion Again" : "Choose The Form Of Your Companion";
  const description = mode === "reset"
    ? "Your previous bond has been cleared. Select the creature spirit and story feeling you want to carry into this new beginning."
    : "Before the hatchery seals an egg, it records the creature spirit and story cadence bound inside. Choose both now, then step into the chamber.";

  return (
    <OnboardingStageShell
      width="full"
      align="top"
      accent="38 88% 70%"
      eyebrow={eyebrow}
      title={title}
      description={description}
      hero={
        <div className="onb-stage-emblem">
          <Crown className="h-9 w-9 text-[#ffe2a3]" />
        </div>
      }
      bodyClassName="mx-auto w-full max-w-6xl"
    >
      <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
        <div className="onb-stage-panel overflow-hidden p-5 sm:p-6 md:p-7">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.34em] text-[#f4d39b]/68">
                Creature Spirit
              </p>
              <h2 className="mt-2 font-cinzel text-2xl font-semibold text-[#fff4df] md:text-3xl">
                Choose the form waiting inside the shell
              </h2>
            </div>
            <div className="hidden rounded-full border border-[#f4d39b]/18 bg-black/20 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-[#f4d39b]/70 md:block">
              13 forms
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {COMPANION_PRESETS.map((preset, index) => {
              const isSelected = preset.id === selectedPresetId;
              return (
                <motion.button
                  key={preset.id}
                  type="button"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.03 * index }}
                  onClick={() => onSelectPreset(preset.id)}
                  className={cn(
                    "group relative overflow-hidden rounded-[1.55rem] border p-4 text-left transition duration-200",
                    isSelected
                      ? "border-[#f3cd84]/70 bg-[linear-gradient(180deg,rgba(92,53,19,0.72),rgba(42,20,13,0.92))] shadow-[0_20px_60px_rgba(243,205,132,0.16)]"
                      : "border-[#f3cd84]/12 bg-[linear-gradient(180deg,rgba(36,19,13,0.76),rgba(20,10,10,0.92))] hover:border-[#f3cd84]/30 hover:bg-[linear-gradient(180deg,rgba(51,28,18,0.8),rgba(20,10,10,0.95))]",
                  )}
                  aria-pressed={isSelected}
                >
                  <div
                    className="pointer-events-none absolute inset-x-6 top-2 h-16 rounded-full blur-3xl"
                    style={{
                      background: isSelected
                        ? "radial-gradient(circle, rgba(249, 191, 92, 0.28) 0%, transparent 72%)"
                        : "radial-gradient(circle, rgba(255, 238, 203, 0.12) 0%, transparent 72%)",
                    }}
                  />

                  <div className="relative flex items-start gap-4">
                    <div className="onb-stage-creature-frame shrink-0">
                      <img
                        src={getSpeciesPreviewUrl(preset.id)}
                        alt={preset.displayName}
                        className="h-24 w-24 object-contain drop-shadow-[0_14px_30px_rgba(0,0,0,0.38)]"
                      />
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.3em] text-[#f4d39b]/54">
                          {preset.role}
                        </p>
                        <h3 className="mt-2 font-cinzel text-xl font-semibold text-[#fff4df]">
                          {preset.displayName}
                        </h3>
                      </div>
                      <p className="text-sm leading-6 text-[#f7ead6]/72">
                        {preset.revealCopy}
                      </p>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="onb-stage-panel p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#f3cd84]/18 bg-black/20 text-[#ffe2a3]">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-[#f4d39b]/60">
                  Story Tone
                </p>
                <h2 className="mt-1 font-cinzel text-2xl font-semibold text-[#fff4df]">
                  Choose the feeling of your tale
                </h2>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {COMPANION_STORY_TONES.map((tone, index) => {
                const isSelected = tone.value === selectedStoryTone;
                return (
                  <motion.button
                    key={tone.value}
                    type="button"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 * index }}
                    onClick={() => onSelectStoryTone(tone.value)}
                    className={cn(
                      "rounded-[1.25rem] border p-4 text-left transition",
                      isSelected
                        ? "border-[#f3cd84]/65 bg-[linear-gradient(180deg,rgba(96,56,20,0.7),rgba(48,24,14,0.9))] shadow-[0_18px_45px_rgba(243,205,132,0.14)]"
                        : "border-[#f3cd84]/10 bg-black/20 hover:border-[#f3cd84]/26 hover:bg-black/28",
                    )}
                    aria-pressed={isSelected}
                  >
                    <div className="flex items-start gap-4">
                      <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full border border-[#f3cd84]/18 bg-black/20 text-[11px] font-semibold text-[#f4d39b]/72">
                        {index + 1}
                      </div>
                      <div className="space-y-1.5">
                        <div className="font-cinzel text-lg font-semibold text-[#fff4df]">
                          {tone.label}
                        </div>
                        <p className="text-sm leading-6 text-[#f7ead6]/70">
                          {tone.summary}
                        </p>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div className="onb-stage-panel p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.34em] text-[#f4d39b]/64">
              <Sparkles className="h-3.5 w-3.5" />
              Selection Ledger
            </div>

            <div className="space-y-4">
              <div className="onb-stage-card p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-[#f4d39b]/58">
                  Chosen form
                </p>
                <p className="mt-2 font-cinzel text-2xl font-semibold text-[#fff4df]">
                  {selectedPreset?.displayName ?? "Awaiting your choice"}
                </p>
                <p className="mt-2 text-sm leading-6 text-[#f7ead6]/68">
                  {selectedPreset?.signatureIdentity ?? "Pick the creature spirit that best matches the companion you want beside you."}
                </p>
              </div>

              <div className="onb-stage-card p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-[#f4d39b]/58">
                  Story promise
                </p>
                <p className="mt-2 font-cinzel text-2xl font-semibold text-[#fff4df]">
                  {selectedTone?.label ?? "Awaiting your choice"}
                </p>
                <p className="mt-2 text-sm leading-6 text-[#f7ead6]/68">
                  {selectedTone?.summary ?? "Choose the emotional texture you want carried through your companion's future story beats."}
                </p>
              </div>

              <Button
                type="button"
                onClick={onContinue}
                disabled={!canContinue}
                size="lg"
                className="onb-stage-cta h-14 w-full rounded-full px-6 text-base font-semibold"
              >
                Continue to Egg Chamber
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </OnboardingStageShell>
  );
};
