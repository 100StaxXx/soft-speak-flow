import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CompanionCreationLoader } from "./CompanionCreationLoader";
import { CompanionImage, CompanionPortraitShell } from "./CompanionImage";
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

const getPresetPreviewUrl = (presetId: CompanionPresetId, element: CompanionElementId) =>
  getPresetCompanionAssetUrl({
    presetId,
    stage: 1,
    element,
    state: "normal",
  }) ?? "/placeholder-companion.svg";

const getEggPreviewUrl = (element: CompanionElementId) =>
  getUniversalEggAssetUrl(element);

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
  const isMigrationMode = mode === "migration";

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
                        <CompanionImage
                          src={getEggPreviewUrl(element.id)}
                          alt={`${element.label} Egg`}
                          fit="contain"
                          className="h-full w-full p-4"
                          loading="lazy"
                        />
                        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-lg font-heading font-bold text-white">
                                {element.label} Egg
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
                          <CompanionPortraitShell
                            src={previewUrl}
                            element={selectedElement}
                            className="h-full w-full"
                            contentClassName="h-full w-full p-4"
                          >
                            <CompanionImage
                              src={previewUrl}
                              alt={preset.displayName}
                              fit="portrait"
                              element={selectedElement}
                              className="h-full w-full"
                              loading="lazy"
                              onError={() =>
                                setBrokenPreviewKeys((current) => ({
                                  ...current,
                                  [previewKey]: true,
                                }))
                              }
                            />
                          </CompanionPortraitShell>
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
                      <div className="p-4">
                        <p className="text-sm text-foreground/90">
                          {preset.revealCopy}
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
                    ? `${selectedElementMeta.label} energy sealed inside a living cosmic shell.`
                    : `${selectedPreset.displayName} with a ${selectedElementMeta.label.toLowerCase()} skin.`}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                {isEggSelectionMode ? (
                  <div className="space-y-3">
                    <div className="mx-auto h-44 w-44">
                      <CompanionImage
                        src={getEggPreviewUrl(selectedElement)}
                        alt={`${selectedElementMeta.label} Egg`}
                        fit="contain"
                        className="h-full w-full"
                      />
                    </div>
                    <div className="text-sm font-medium text-foreground">{selectedElementMeta.label} Egg</div>
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
                    <div className="mt-2 font-semibold text-foreground">{selectedElementMeta.label}</div>
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
                          <div className="font-semibold text-foreground">{element.label}</div>
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
                  ? `${selectedElementMeta.label} Egg • ${selectedToneMeta.label}`
                  : `${selectedPreset.displayName} • ${selectedElementMeta.label} • ${selectedToneMeta.label}`}
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
              onClick={() => onComplete({
                presetId: isEggSelectionMode ? null : selectedPreset.id,
                favoriteColor: getCompanionElementAnchorColor(selectedElement),
                spiritAnimal: isEggSelectionMode ? "Egg" : selectedPreset.displayName,
                coreElement: selectedElement,
                storyTone: selectedTone,
              })}
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
