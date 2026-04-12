import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  COMPANION_ONBOARDING_SILHOUETTE_SOURCES,
  COMPANION_PRESETS,
  COMPANION_STORY_TONES,
  type CompanionPresetId,
  type CompanionStoryTone,
} from "@/config/companionCatalog";
import {
  COMPANION_FUTURE_STATE_LABEL,
  isPilotCompanionPreset,
} from "@/config/companionPilotAvailability";
import { cn } from "@/lib/utils";

export interface OnboardingStoryToneSelectionValue {
  storyTone: CompanionStoryTone;
  presetId: CompanionPresetId;
}

interface OnboardingStoryToneSelectionProps {
  initialTone?: CompanionStoryTone;
  initialPresetId?: CompanionPresetId | null;
  onComplete: (selection: OnboardingStoryToneSelectionValue) => void;
  onBack?: () => void;
}

const TONE_INTROS: Record<CompanionStoryTone, string> = {
  soft_gentle: "A warmer path with quieter magic and more tender turns.",
  epic_adventure: "A bold path with larger-than-life stakes and heroic momentum.",
  emotional_heartfelt: "A bond-first path where feeling and closeness stay in focus.",
  dark_intense: "A higher-tension path with sharper trials and deeper shadows.",
  whimsical_playful: "A brighter path full of odd wonder, surprise, and delight.",
};

export const OnboardingStoryToneSelection = ({
  initialTone = "epic_adventure",
  initialPresetId = null,
  onComplete,
  onBack,
}: OnboardingStoryToneSelectionProps) => {
  const [selectedTone, setSelectedTone] = useState<CompanionStoryTone>(initialTone);
  const [selectedPresetId, setSelectedPresetId] = useState<CompanionPresetId | null>(
    initialPresetId && isPilotCompanionPreset(initialPresetId)
      ? initialPresetId
      : null,
  );

  const selectedToneMeta = useMemo(
    () => COMPANION_STORY_TONES.find((tone) => tone.value === selectedTone) ?? COMPANION_STORY_TONES[0],
    [selectedTone],
  );
  const selectedPresetMeta = useMemo(
    () => COMPANION_PRESETS.find((preset) => preset.id === selectedPresetId) ?? null,
    [selectedPresetId],
  );

  return (
    <div className="relative z-10 min-h-screen px-4 pt-safe-top pb-safe-bottom">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-6 py-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto w-full max-w-4xl rounded-[32px] border border-white/[0.10] bg-[linear-gradient(180deg,rgba(26,18,40,0.95),rgba(15,11,28,0.96))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:p-6"
        >
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-3">
                <span className="inline-flex rounded-full border border-white/[0.12] bg-white/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/[0.72]">
                  Companion Tone
                </span>
                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold text-white sm:text-4xl">
                    Choose The Story Tone
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-white/[0.72] sm:text-base">
                    This shapes the mood of your companion story, not the egg element itself. Pick the tone
                    you want carrying the bond forward.
                  </p>
                </div>
              </div>

              {onBack ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onBack}
                  className="self-start rounded-full border border-white/[0.12] bg-white/[0.06] px-5 text-white/[0.86] hover:bg-white/[0.10]"
                >
                  Back
                </Button>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {COMPANION_STORY_TONES.map((tone, index) => {
                const isSelected = tone.value === selectedTone;

                return (
                  <motion.button
                    key={tone.value}
                    type="button"
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => setSelectedTone(tone.value)}
                    className={cn(
                      "rounded-[26px] border px-4 py-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                      isSelected
                        ? "border-amber-300/[0.45] bg-amber-300/[0.14] text-white shadow-[0_20px_40px_rgba(255,199,84,0.16)]"
                        : "border-white/[0.10] bg-white/[0.05] text-white/[0.86] hover:border-white/[0.2] hover:bg-white/[0.08]",
                    )}
                    data-selected={isSelected ? "true" : "false"}
                    aria-pressed={isSelected}
                  >
                    <div className="text-sm font-semibold">{tone.label}</div>
                    <p className="mt-2 text-xs leading-5 text-white/[0.6]">{tone.summary}</p>
                  </motion.button>
                );
              })}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.22em] text-white/[0.48]">Companion Form</p>
                <h2 className="text-2xl font-semibold text-white">Choose The Species</h2>
                <p className="max-w-3xl text-sm leading-6 text-white/[0.72]">
                  Lock the creature sleeping inside your egg now. You&apos;ll still choose the egg&apos;s
                  element in the chamber next.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {COMPANION_PRESETS.map((preset, index) => {
                  const isSupported = isPilotCompanionPreset(preset.id);
                  const isSelected = isSupported && preset.id === selectedPresetId;
                  const silhouetteSrc = COMPANION_ONBOARDING_SILHOUETTE_SOURCES[preset.id] ?? null;

                  return (
                    <motion.button
                      key={preset.id}
                      type="button"
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => {
                        if (!isSupported) return;
                        setSelectedPresetId(preset.id);
                      }}
                      disabled={!isSupported}
                      className={cn(
                        "rounded-[26px] border px-4 py-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed",
                        isSelected
                          ? "border-emerald-300/[0.45] bg-emerald-300/[0.14] text-white shadow-[0_20px_40px_rgba(52,211,153,0.14)]"
                          : isSupported
                            ? "border-white/[0.10] bg-white/[0.05] text-white/[0.86] hover:border-white/[0.2] hover:bg-white/[0.08]"
                            : "border-white/[0.08] bg-white/[0.03] text-white/[0.52] saturate-50",
                      )}
                      data-selected={isSelected ? "true" : "false"}
                      data-supported={isSupported ? "true" : "false"}
                      aria-pressed={isSelected}
                      aria-disabled={!isSupported}
                    >
                      <div className="flex items-start gap-4">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold">{preset.displayName}</div>
                              <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-white/[0.45]">
                                {preset.role}
                              </p>
                            </div>
                            {isSelected ? (
                              <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/85">
                                Selected
                              </span>
                            ) : !isSupported ? (
                              <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                                {COMPANION_FUTURE_STATE_LABEL}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs leading-5 text-white/[0.74]">{preset.revealCopy}</p>
                        </div>

                        {silhouetteSrc ? (
                          <div className="pointer-events-none relative flex h-16 w-14 shrink-0 items-center justify-center self-center sm:h-[4.5rem] sm:w-16">
                            <div
                              className="absolute inset-x-1 bottom-2 h-8 rounded-full bg-white/[0.05] blur-lg"
                              aria-hidden="true"
                            />
                            <img
                              src={silhouetteSrc}
                              alt=""
                              aria-hidden="true"
                              data-testid={`species-silhouette-${preset.id}`}
                              className={cn(
                                "relative h-full w-full object-contain brightness-0 contrast-200",
                                !isSupported && "opacity-50",
                              )}
                            />
                          </div>
                        ) : null}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-[28px] border border-white/[0.10] bg-black/20 p-5">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/[0.48]">Selected Mood</p>
                  <h2 className="text-xl font-semibold text-white">{selectedToneMeta.label}</h2>
                  <p className="text-sm leading-6 text-white/[0.72]">
                    {TONE_INTROS[selectedToneMeta.value]} {selectedToneMeta.summary}
                  </p>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/[0.10] bg-black/20 p-5">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/[0.48]">Locked Species</p>
                  <h2 className="text-xl font-semibold text-white">
                    {selectedPresetMeta?.displayName ?? "Choose a species"}
                  </h2>
                  <p className="text-sm leading-6 text-white/[0.72]">
                    {selectedPresetMeta
                      ? `${selectedPresetMeta.revealCopy} This choice stays sleeping inside the egg until the first hatch.`
                      : "Choose one of the currently awakened species so the egg chamber can focus only on element."}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                size="lg"
                onClick={() => {
                  if (!selectedPresetId) return;
                  onComplete({
                    storyTone: selectedTone,
                    presetId: selectedPresetId,
                  });
                }}
                disabled={!selectedPresetId}
                className="min-w-[220px] rounded-full px-8"
              >
                Continue
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
