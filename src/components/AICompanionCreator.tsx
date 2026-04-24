import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  COMPANION_ELEMENTS,
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

const SPIRIT_ANIMALS = [
  { name: "Dragon", glyph: "Dr" },
  { name: "Wolf", glyph: "Wo" },
  { name: "Fox", glyph: "Fx" },
  { name: "Owl", glyph: "Ow" },
  { name: "Lion", glyph: "Li" },
  { name: "Phoenix", glyph: "Ph" },
  { name: "Bear", glyph: "Be" },
  { name: "Deer", glyph: "De" },
  { name: "Raven", glyph: "Ra" },
  { name: "Tanuki", glyph: "Ta" },
  { name: "Pegasus", glyph: "Pe" },
  { name: "Griffin", glyph: "Gr" },
] as const;

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

const isKnownSpiritAnimal = (value: string | null | undefined): value is string =>
  Boolean(value && SPIRIT_ANIMALS.some((animal) => animal.name === value));

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
  description = "Choose the color, species, and element that will define your egg's hidden destiny.",
}: AICompanionCreatorProps) => {
  const isCompact = layout === "compact";
  const [favoriteColor, setFavoriteColor] = useState<string>(
    isKnownFavoriteColor(initialFavoriteColor) ? initialFavoriteColor : FAVORITE_COLORS[0].value,
  );
  const [spiritAnimal, setSpiritAnimal] = useState<string>(
    isKnownSpiritAnimal(initialSpiritAnimal) ? initialSpiritAnimal : SPIRIT_ANIMALS[0].name,
  );
  const [coreElement, setCoreElement] = useState<CompanionElementId>(initialElement ?? "fire");
  const [selectedStoryTone, setSelectedStoryTone] = useState<CompanionStoryTone>(storyTone);
  const [customCompanionName, setCustomCompanionName] = useState(initialCompanionName ?? "");

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
                  <Label className="text-lg font-semibold text-white">Favorite Color</Label>
                  <p className="text-sm text-white/60">This becomes the visual anchor that carries across every evolution.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {FAVORITE_COLORS.map((color) => {
                    const isSelected = color.value === favoriteColor;
                    return (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => setFavoriteColor(color.value)}
                        className={cn(
                          "rounded-[24px] border p-3 text-left transition-all duration-200",
                          isSelected
                            ? "border-white/40 bg-white/12 shadow-[0_18px_40px_rgba(255,255,255,0.08)]"
                            : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8",
                        )}
                      >
                        <div className={cn("h-20 rounded-2xl bg-gradient-to-br", color.gradient)} />
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-white">{color.label}</span>
                          {isSelected ? (
                            <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/85">
                              Selected
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-lg font-semibold text-white">Spirit Animal</Label>
                  <p className="text-sm text-white/60">This sets the creature family your egg will grow toward.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {SPIRIT_ANIMALS.map((animal) => {
                    const isSelected = animal.name === spiritAnimal;
                    return (
                      <button
                        key={animal.name}
                        type="button"
                        onClick={() => setSpiritAnimal(animal.name)}
                        className={cn(
                          "flex items-center gap-4 rounded-[24px] border px-4 py-4 text-left transition-all duration-200",
                          isSelected
                            ? "border-emerald-300/45 bg-emerald-300/14 text-white shadow-[0_18px_40px_rgba(52,211,153,0.14)]"
                            : "border-white/10 bg-white/5 text-white/86 hover:border-white/20 hover:bg-white/8",
                        )}
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-sm font-black tracking-[0.16em] text-white/85">
                          {animal.glyph}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">{animal.name}</div>
                          <p className="mt-1 text-xs leading-5 text-white/60">AI lineage locked to {animal.name.toLowerCase()} family anatomy.</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-lg font-semibold text-white">Core Element</Label>
                  <p className="text-sm text-white/60">This shapes the aura, energy effects, and symbolic mood of the line.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {COMPANION_ELEMENTS.map((element) => {
                    const isSelected = element.id === coreElement;
                    return (
                      <button
                        key={element.id}
                        type="button"
                        onClick={() => setCoreElement(element.id)}
                        className={cn(
                          "rounded-[24px] border px-4 py-4 text-left transition-all duration-200",
                          isSelected
                            ? "border-amber-300/45 bg-amber-300/14 text-white shadow-[0_18px_40px_rgba(245,158,11,0.14)]"
                            : "border-white/10 bg-white/5 text-white/86 hover:border-white/20 hover:bg-white/8",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="h-4 w-4 rounded-full shadow-[0_0_18px_currentColor]"
                            style={{ backgroundColor: element.anchorColor, color: element.anchorColor }}
                          />
                          <div className="text-sm font-semibold">{element.label}</div>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-white/60">{element.summary}</p>
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
                      Optional. This name will appear immediately while the egg is still sealed.
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
                        : "Leave blank to keep the generated name later."}
                    </span>
                    <span>{customCompanionName.length}/{COMPANION_CUSTOM_NAME_MAX_LENGTH}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/48">Egg Preview</p>
                  <div
                    className={cn(
                      "rounded-[26px] border border-white/10 p-5",
                      "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.10),rgba(255,255,255,0.03)_48%,rgba(0,0,0,0.18)_100%)]",
                    )}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xl font-semibold text-white">{normalizedCustomName ?? `${selectedElement.label} Egg`}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.2em] text-white/48">Stage 0 • AI-generated egg</div>
                        </div>
                        <div
                          className="h-4 w-4 rounded-full shadow-[0_0_18px_currentColor]"
                          style={{ backgroundColor: favoriteColor, color: favoriteColor }}
                        />
                      </div>
                      <p className="text-sm leading-6 text-white/72">
                        A {spiritAnimal.toLowerCase()} lineage shaped by {selectedColorMeta.label.toLowerCase()} and {selectedElement.label.toLowerCase()} energy.
                      </p>
                      <p className="text-xs leading-5 text-white/52">
                        The shell will hint at this family now, then reveal the first true creature form when it reaches Level 1.
                      </p>
                    </div>
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
