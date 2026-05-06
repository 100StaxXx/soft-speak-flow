import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CompanionImage } from "@/components/CompanionImage";
import {
  COMPANION_ELEMENTS,
  COMPANION_ONBOARDING_SILHOUETTE_SOURCES,
  COMPANION_PRESETS,
  COMPANION_STORY_TONES,
  FAVORITE_COLORS,
  getCompanionEggLabel,
  type CompanionElementId,
  type CompanionStoryTone,
} from "@/config/companionCatalog";
import { isPilotCompanionElement } from "@/config/companionPilotAvailability";
import { getUniversalEggAssetUrl } from "@/lib/companionAssetResolver";
import {
  COMPANION_CUSTOM_NAME_MAX_LENGTH,
  normalizeCompanionCustomName,
} from "@/lib/companionName";
import { cn } from "@/lib/utils";

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
  submitLabel?: string;
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
  description = "Choose the color, element, and species that will define your egg's hidden destiny.",
  submitLabel = "Create AI Egg",
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
  const [coreElement, setCoreElement] = useState<CompanionElementId>(() => {
    const candidate = initialElement ?? "fire";
    return isPilotCompanionElement(candidate) ? candidate : "fire";
  });

  const normalizedCustomName = normalizeCompanionCustomName(customCompanionName);
  const selectedTone = useMemo(
    () => COMPANION_STORY_TONES.find((tone) => tone.value === selectedStoryTone) ?? COMPANION_STORY_TONES[0],
    [selectedStoryTone],
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
                        Color anchors your companion's palette.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <div className="space-y-1">
                  <Label id="egg-element-picker-label" className="text-lg font-semibold text-white">
                    Egg Element
                  </Label>
                  <p className="text-sm text-white/60">
                    Pick the egg whose elemental energy your companion will hatch with.
                  </p>
                </div>
                <div
                  role="group"
                  aria-labelledby="egg-element-picker-label"
                  className="rounded-[24px] border border-white/10 bg-white/5 p-4"
                >
                  <div className="grid grid-cols-2 gap-3">
                    {COMPANION_ELEMENTS.map((element) => {
                      const isSupported = isPilotCompanionElement(element.id);
                      const isSelected = isSupported && element.id === coreElement;
                      const eggLabel = getCompanionEggLabel(element.id);

                      return (
                        <button
                          key={element.id}
                          type="button"
                          onClick={() => {
                            if (!isSupported) return;
                            setCoreElement(element.id);
                          }}
                          disabled={!isSupported}
                          aria-pressed={isSelected}
                          aria-label={`Select ${eggLabel}`}
                          data-selected={isSelected ? "true" : "false"}
                          data-supported={isSupported ? "true" : "false"}
                          className={cn(
                            "group flex flex-col overflow-hidden rounded-2xl border text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed",
                            isSelected
                              ? "border-primary/60 bg-primary/12 shadow-[0_18px_36px_rgba(168,85,247,0.18)]"
                              : isSupported
                                ? "border-white/10 bg-black/25 hover:border-white/25 hover:bg-black/35"
                                : "border-white/8 bg-black/20 opacity-65 saturate-50",
                          )}
                        >
                          <div className="relative flex h-28 w-full items-center justify-center bg-gradient-to-br from-slate-950/70 via-slate-900/60 to-slate-950/85">
                            <CompanionImage
                              src={getUniversalEggAssetUrl(element.id)}
                              alt={eggLabel}
                              fit="contain"
                              className="h-full w-full p-2"
                              loading="lazy"
                            />
                          </div>
                          <div className="px-3 py-2">
                            <span className="text-sm font-semibold text-white">{eggLabel}</span>
                          </div>
                        </button>
                      );
                    })}
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
                  className="space-y-3"
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
                          "w-full overflow-hidden rounded-2xl border px-3.5 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                          isSelected
                            ? "border-emerald-300/55 bg-[#20313a]/88 text-white shadow-[0_20px_44px_rgba(52,211,153,0.14)]"
                            : "border-white/10 bg-[#171421]/82 text-white/86 hover:border-white/20 hover:bg-[#1d1929]/88",
                        )}
                        data-selected={isSelected ? "true" : "false"}
                      >
                        <div className="grid grid-cols-[minmax(0,1fr)_48px] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(0,1fr)_56px]">
                          <div className="min-w-0 self-start">
                            <div className="text-base font-semibold leading-tight text-white">
                              {preset.displayName}
                            </div>
                            <p className="mt-1 break-words text-[10px] uppercase leading-4 tracking-[0.18em] text-white/48">
                              {preset.role}
                            </p>
                          </div>

                          <div className="row-span-2 flex h-12 w-12 items-center justify-center justify-self-end self-center sm:h-14 sm:w-14">
                            {silhouetteSrc ? (
                              <img
                                src={silhouetteSrc}
                                alt=""
                                aria-hidden="true"
                                data-testid={`species-silhouette-${preset.id}`}
                                data-silhouette-variant="compact-black"
                                className="h-full w-full object-contain opacity-95"
                                loading="lazy"
                                style={{ filter: "brightness(0) drop-shadow(0 0 10px rgba(132, 99, 255, 0.34))" }}
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-black/80">
                                {preset.displayName.slice(0, 2)}
                              </div>
                            )}
                          </div>

                          <p className="line-clamp-2 text-xs leading-[18px] text-white/72">
                            {preset.revealCopy}
                          </p>
                        </div>
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
                  {isLoading ? "Forging Egg..." : submitLabel}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
