import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Sparkles } from "lucide-react";
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
  const eyebrow = mode === "reset" ? "Companion Rebinding" : "Companion Bond";
  const title = mode === "reset" ? "Choose Your Companion Again" : "Choose The Form Of Your Companion";
  const description = mode === "reset"
    ? "Your previous bond has been cleared. Select the creature spirit and story feeling you want to carry into this new beginning."
    : "First choose the creature spirit and story feeling you want beside you. Once both are set, you'll choose the egg element that carries them forward.";

  return (
    <OnboardingStageShell
      width="full"
      align="top"
      accent="198 95% 68%"
      eyebrow={eyebrow}
      title={title}
      description={description}
      hero={
        <div className="onb-stage-emblem">
          <Sparkles className="h-9 w-9 text-white" />
        </div>
      }
      bodyClassName="mx-auto w-full max-w-6xl"
    >
      <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
        <div className="onb-stage-panel overflow-hidden p-5 sm:p-6 md:p-7">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.34em] text-white/58">
                Creature Spirit
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white md:text-3xl">
                Choose the companion who will hatch beside you
              </h2>
            </div>
            <div className="hidden rounded-full border border-white/10 bg-black/20 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-white/58 md:block">
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
                      ? "border-primary/45 bg-white/[0.09] shadow-[0_20px_60px_rgba(61,184,245,0.16)]"
                      : "border-white/10 bg-black/20 hover:border-white/18 hover:bg-white/[0.05]",
                  )}
                  aria-pressed={isSelected}
                >
                  <div
                    className="pointer-events-none absolute inset-x-6 top-4 h-20 rounded-full blur-3xl"
                    style={{
                      background: isSelected
                        ? "radial-gradient(circle, rgba(61, 184, 245, 0.3) 0%, transparent 72%)"
                        : "radial-gradient(circle, rgba(181, 196, 255, 0.14) 0%, transparent 72%)",
                    }}
                  />

                  <div className="relative">
                    <div
                      className="mb-4 flex min-h-[13.5rem] items-end justify-center overflow-visible rounded-[1.4rem] border border-white/8 bg-white/[0.04] px-4 pt-4"
                      data-testid={`species-preview-stage-${preset.id}`}
                    >
                      <img
                        src={getSpeciesPreviewUrl(preset.id)}
                        alt={preset.displayName}
                        data-testid={`species-preview-image-${preset.id}`}
                        className="h-48 w-full object-contain object-bottom drop-shadow-[0_18px_34px_rgba(0,0,0,0.38)]"
                      />
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-white/48">
                        {preset.role}
                      </p>
                      <h3 className="text-xl font-semibold text-white">
                        {preset.displayName}
                      </h3>
                      <p className="text-sm leading-6 text-white/68">
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
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-black/20 text-white">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">
                  Story Tone
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-white">
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
                        ? "border-primary/45 bg-white/[0.08] shadow-[0_18px_45px_rgba(61,184,245,0.14)]"
                        : "border-white/10 bg-black/20 hover:border-white/18 hover:bg-white/[0.05]",
                    )}
                    aria-pressed={isSelected}
                  >
                    <div className="flex items-start gap-4">
                      <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full border border-white/14 bg-black/20 text-[11px] font-semibold text-primary/80">
                        {index + 1}
                      </div>
                      <div className="space-y-1.5">
                        <div className="text-lg font-semibold text-white">
                          {tone.label}
                        </div>
                        <p className="text-sm leading-6 text-white/70">
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
            <div className="mb-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.34em] text-white/60">
              <Sparkles className="h-3.5 w-3.5" />
              Your Bond So Far
            </div>

            <div className="space-y-4">
              {selectedPreset ? (
                <div className="onb-stage-card overflow-hidden p-4">
                  <div className="flex min-h-[11rem] items-end justify-center rounded-[1.25rem] border border-white/8 bg-white/[0.04] px-4 pt-4">
                    <img
                      src={getSpeciesPreviewUrl(selectedPreset.id)}
                      alt={selectedPreset.displayName}
                      className="h-44 w-full object-contain object-bottom drop-shadow-[0_20px_34px_rgba(0,0,0,0.4)]"
                    />
                  </div>
                </div>
              ) : null}

              <div className="onb-stage-card p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-white/54">
                  Chosen form
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {selectedPreset?.displayName ?? "Awaiting your choice"}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/68">
                  {selectedPreset?.signatureIdentity ?? "Pick the creature spirit that best matches the companion you want beside you."}
                </p>
              </div>

              <div className="onb-stage-card p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-white/54">
                  Story promise
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {selectedTone?.label ?? "Awaiting your choice"}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/68">
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
