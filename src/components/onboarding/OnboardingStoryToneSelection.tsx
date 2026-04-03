import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  COMPANION_STORY_TONES,
  type CompanionStoryTone,
} from "@/config/companionCatalog";
import { cn } from "@/lib/utils";

interface OnboardingStoryToneSelectionProps {
  initialTone?: CompanionStoryTone;
  onComplete: (tone: CompanionStoryTone) => void;
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
  onComplete,
  onBack,
}: OnboardingStoryToneSelectionProps) => {
  const [selectedTone, setSelectedTone] = useState<CompanionStoryTone>(initialTone);

  const selectedToneMeta = useMemo(
    () => COMPANION_STORY_TONES.find((tone) => tone.value === selectedTone) ?? COMPANION_STORY_TONES[0],
    [selectedTone],
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

            <div className="rounded-[28px] border border-white/[0.10] bg-black/20 p-5">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.22em] text-white/[0.48]">Selected Mood</p>
                <h2 className="text-xl font-semibold text-white">{selectedToneMeta.label}</h2>
                <p className="text-sm leading-6 text-white/[0.72]">
                  {TONE_INTROS[selectedToneMeta.value]} {selectedToneMeta.summary}
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                size="lg"
                onClick={() => onComplete(selectedTone)}
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
