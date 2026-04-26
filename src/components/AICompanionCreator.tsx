import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  COMPANION_ELEMENTS,
  COMPANION_ONBOARDING_SILHOUETTE_SOURCES,
  COMPANION_PRESETS,
  COMPANION_STORY_TONES,
  type CompanionElementId,
  type CompanionStoryTone,
} from "@/config/companionCatalog";
import {
  COMPANION_CUSTOM_NAME_MAX_LENGTH,
  normalizeCompanionCustomName,
} from "@/lib/companionName";
import { cn } from "@/lib/utils";

const FAVORITE_COLORS = [
  { label: "Solar Gold", value: "#f5b942", gradient: "from-amber-300 via-yellow-400 to-orange-400" },
  { label: "Rose Ember", value: "#ff6b7f", gradient: "from-rose-400 via-pink-500 to-red-500" },
  { label: "Sky Current", value: "#52b7ff", gradient: "from-sky-300 via-cyan-400 to-blue-500" },
  { label: "Verdant Glow", value: "#58d68d", gradient: "from-emerald-300 via-green-400 to-lime-500" },
  { label: "Amethyst Mist", value: "#9b6bff", gradient: "from-violet-400 via-purple-500 to-fuchsia-500" },
  { label: "Moon Silver", value: "#d6dee8", gradient: "from-slate-200 via-zinc-200 to-slate-400" },
  { label: "Crimson Flare", value: "#ef4444", gradient: "from-red-400 via-red-500 to-orange-500" },
  { label: "Ocean Teal", value: "#14b8a6", gradient: "from-teal-300 via-teal-400 to-cyan-500" },
] as const;

const COLOR_ELEMENT_DEFAULTS: Record<string, CompanionElementId> = {
  "#f5b942": "light",
  "#ff6b7f": "fire",
  "#52b7ff": "ice",
  "#58d68d": "nature",
  "#9b6bff": "void",
  "#d6dee8": "light",
  "#ef4444": "fire",
  "#14b8a6": "nature",
};

export interface AICompanionCreationData {
  favoriteColor: string;
  spiritAnimal: string;
  coreElement: CompanionElementId;
  storyTone: CompanionStoryTone;
  companionName?: string | null;
}

interface AICompanionCreatorProps {
  onComplete: (data: AICompanionCreationData) => void;
  storyTone: CompanionStoryTone;
  isLoading?: boolean;
  layout?: "fullscreen" | "compact";
  allowToneSelection?: boolean;
  initialFavoriteColor?: string | null;
  initialSpiritAnimal?: string | null;
  initialElement?: CompanionElementId | null;
  initialCompanionName?: string | null;
  onBack?: () => void;
  title?: string;
  description?: string;
}

const isKnownFavoriteColor = (value: string | null | undefined): value is string =>
  Boolean(value && FAVORITE_COLORS.some((color) => color.value === value));

const getKnownSpiritAnimalDisplayName = (value: string | null | undefined): string | null => {
  const normalizedValue = value?.trim().toLowerCase();
  if (!normalizedValue) return null;

  return COMPANION_PRESETS.find((preset) =>
    preset.displayName.toLowerCase() === normalizedValue
    || preset.id.toLowerCase() === normalizedValue
  )?.displayName ?? null;
};

export const AICompanionCreator = ({
  onComplete,
  storyTone,
  isLoading = false,
  layout = "fullscreen",
  allowToneSelection = false,
  initialFavoriteColor = null,
  initialSpiritAnimal = null,
  initialElement = "fire",
  initialCompanionName = null,
  onBack,
  title = "Shape Your Companion Lineage",
  description = "Choose the color and species that will define your egg's hidden destiny.",
}: AICompanionCreatorProps) => {
  const isCompact = layout === "compact";
  const [favoriteColor, setFavoriteColor] = useState<string>(
    isKnownFavoriteColor(initialFavoriteColor) ? initialFavoriteColor : FAVORITE_COLORS[0].value,
  );
  const [spiritAnimal, setSpiritAnimal] = useState<string>(
    getKnownSpiritAnimalDisplayName(initialSpiritAnimal) ?? COMPANION_PRESETS[0].displayName,
  );
  const [selectedStoryTone, setSelectedStoryTone] = useState<CompanionStoryTone>(storyTone);
  const [customCompanionName, setCustomCompanionName] = useState(initialCompanionName ?? "");
  const coreElement = COLOR_ELEMENT_DEFAULTS[favoriteColor] ?? initialElement ?? "fire";

  const normalizedCustomName = normalizeCompanionCustomName(customCompanionName);
  const selectedTone = useMemo(
    () => COMPANION_STORY_TONES.find((tone) => tone.value === selectedStoryTone) ?? COMPANION_STORY_TONES[0],
    [selectedStoryTone],
  );
  const selectedElement = useMemo(
    () => COMPANION_ELEMENTS.find((element) => element.id === coreElement) ?? COMPANION_ELEMENTS[0],
    [coreElement],
  );
  const selectedColorMeta = useMemo(
    () => FAVORITE_COLORS.find((color) => color.value === favoriteColor) ?? FAVORITE_COLORS[0],
    [favoriteColor],
  );

  return (
    <div className={cn("relative z-10", isCompact ? "w-full" : "min-h-screen px-4 pt-safe-top pb-safe-bottom")}>
      <div
        className={cn(
          "mx-auto w-full rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,16,28,0.95),rgba(11,10,20,0.96))] shadow-[0_24px_60px_rgba(0,0,0,0.34)] backdrop-blur-xl",
          isCompact ? "max-w-4xl p-5" : "max-w-5xl p-6 sm:p-8",
        )}
      >
        <div className="space-y-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <span className="inline-flex rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                AI Companion
              </span>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold text-white sm:text-4xl">{title}</h1>
                <p className="max-w-3xl text-sm leading-6 text-white/72 sm:text-base">{description}</p>
              </div>
            </div>

            {onBack ? (
              <Button
                type="button"
                variant="ghost"
                onClick={onBack}
                disabled={isLoading}
                className="self-start rounded-full border border-white/12 bg-white/6 px-5 text-white/86 hover:bg-white/10"
              >
                Back
              </Button>
            ) : null}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6">
              <section className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="favorite-color-select" className="text-lg font-semibold text-white">
                    Favorite Color
                  </Label>
                  <p className="text-sm text-white/60">
                    Pick the color that should anchor your companion's look.
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <select
                    id="favorite-color-select"
                    value={favoriteColor}
                    onChange={(event) => setFavoriteColor(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-black/35 px-4 text-sm font-semibold text-white outline-none transition-colors focus:border-white/35"
                  >
                    {FAVORITE_COLORS.map((color) => (
                      <option key={color.value} value={color.value}>
                        {color.label}
                      </option>
                    ))}
                  </select>
                  <div className="mt-4 flex items-center gap-3">
                    <div className={cn("h-14 w-20 rounded-2xl bg-gradient-to-br", selectedColorMeta.gradient)} />
                    <div>
                      <p className="text-sm font-semibold text-white">{selectedColorMeta.label}</p>
                      <p className="text-xs leading-5 text-white/55">
                        This color also hints the egg toward {selectedElement.label.toLowerCase()} energy.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <div className="space-y-1">
                  <Label id="species-picker-label" className="text-lg font-semibold text-white">
                    Species
                  </Label>
                  <p className="text-sm text-white/60">
                    Choose the creature family your egg will grow toward.
                  </p>
                </div>
                <div
                  role="group"
                  aria-labelledby="species-picker-label"
                  className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
                >
                  {COMPANION_PRESETS.map((preset) => {
                    const isSelected = preset.displayName === spiritAnimal;
                    const silhouetteSrc = COMPANION_ONBOARDING_SILHOUETTE_SOURCES[preset.id];

                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setSpiritAnimal(preset.displayName)}
                        aria-label={`Select ${preset.displayName} species`}
                        aria-pressed={isSelected}
                        className={cn(
                          "rounded-[24px] border p-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                          isSelected
                            ? "border-emerald-300/45 bg-emerald-300/14 text-white shadow-[0_20px_40px_rgba(52,211,153,0.14)]"
                            : "border-white/10 bg-white/5 text-white/86 hover:border-white/20 hover:bg-white/8",
                        )}
                        data-selected={isSelected ? "true" : "false"}
                      >
                        <div className="aspect-square rounded-[20px] border border-white/8 bg-black/25 p-3">
                          {silhouetteSrc ? (
                            <img
                              src={silhouetteSrc}
                              alt=""
                              aria-hidden="true"
                              data-testid={`species-silhouette-${preset.id}`}
                              className="h-full w-full object-contain"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-white/45">
                              {preset.displayName.slice(0, 2)}
                            </div>
                          )}
                        </div>
                        <div className="mt-3 flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-white">{preset.displayName}</div>
                            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/45">
                              {preset.role}
                            </p>
                          </div>
                          {isSelected ? (
                            <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/85">
                              Selected
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-xs leading-5 text-white/60">{preset.revealCopy}</p>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className="space-y-5">
              <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/48">
                    {allowToneSelection ? "Story Tone" : "Locked Story Tone"}
                  </p>
                  <h2 className="text-2xl font-semibold text-white">{selectedTone.label}</h2>
                  <p className="text-sm leading-6 text-white/72">{selectedTone.summary}</p>
                </div>
                {allowToneSelection ? (
                  <div className="mt-4 grid gap-3">
                    {COMPANION_STORY_TONES.map((tone) => {
                      const isSelected = tone.value === selectedStoryTone;
                      return (
                        <button
                          key={tone.value}
                          type="button"
                          onClick={() => setSelectedStoryTone(tone.value)}
                          className={cn(
                            "rounded-2xl border px-4 py-3 text-left transition-all duration-200",
                            isSelected
                              ? "border-primary/60 bg-primary/15 text-white"
                              : "border-white/10 bg-white/5 text-white/82 hover:border-white/20 hover:bg-white/8",
                          )}
                        >
                          <div className="text-sm font-semibold">{tone.label}</div>
                          <p className="mt-1 text-xs leading-5 text-white/58">{tone.summary}</p>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="companion-custom-name" className="text-lg font-semibold text-white">
                      Companion Name
                    </Label>
                    <p className="text-sm text-white/60">
                      Optional. If you do not choose a companion name, one will be granted to your companion.
                    </p>
                  </div>
                  <Input
                    id="companion-custom-name"
                    value={customCompanionName}
                    onChange={(event) => setCustomCompanionName(event.target.value)}
                    placeholder="Optional custom name"
                    maxLength={COMPANION_CUSTOM_NAME_MAX_LENGTH}
                    className="h-11 border-white/10 bg-black/25 text-white placeholder:text-white/40"
                  />
                  <div className="flex items-center justify-between text-xs text-white/50">
                    <span>
                      {normalizedCustomName
                        ? `${normalizedCustomName} will be shown from the beginning.`
                        : "Leave blank for a granted companion name."}
                    </span>
                    <span>{customCompanionName.length}/{COMPANION_CUSTOM_NAME_MAX_LENGTH}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  size="lg"
                  disabled={isLoading}
                  className="min-w-[240px] rounded-full px-8"
                  onClick={() => onComplete({
                    favoriteColor,
                    spiritAnimal,
                    coreElement,
                    storyTone: selectedStoryTone,
                    companionName: normalizedCustomName,
                  })}
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isLoading ? "Forging Egg..." : "Create AI Egg"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
