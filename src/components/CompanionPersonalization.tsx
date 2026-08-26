import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CompanionCreationLoader } from "./CompanionCreationLoader";
import { CompanionImage, CompanionPortraitShell } from "./CompanionImage";
import {
  COMPANION_ELEMENTS,
  COMPANION_CATALOG_PRESETS,
  COMPANION_STORY_TONES,
  getCompanionElementAnchorColor,
  getCompanionElement,
  type CompanionElementId,
  type CompanionPresetId,
  type CompanionStoryTone,
} from "@/config/companionCatalog";
import {
  COMPANION_LEGACY_STATE_LABEL,
  getDefaultPilotCompanionElementId,
  getDefaultPilotCompanionPresetId,
  isPilotCompanionElement,
  isPilotCompanionPreset,
} from "@/config/companionPilotAvailability";
import {
  getPresetCompanionAssetUrl,
  getUniversalEggAssetUrl,
} from "@/lib/companionAssetResolver";
import {
  COMPANION_CUSTOM_NAME_MAX_LENGTH,
  normalizeCompanionCustomName,
} from "@/lib/companionName";

type CompanionPersonalizationMode = "onboarding" | "migration" | "hatch" | "reset";

interface CompanionSelectionData {
  presetId: CompanionPresetId | null;
  favoriteColor: string;
  spiritAnimal: string;
  coreElement: CompanionElementId;
  storyTone: CompanionStoryTone;
  companionName?: string | null;
}

interface CompanionPersonalizationProps {
  onComplete: (data: CompanionSelectionData) => void;
  isLoading?: boolean;
  mode?: CompanionPersonalizationMode;
  layout?: "fullscreen" | "compact";
  initialElement?: CompanionElementId;
  initialStoryTone?: CompanionStoryTone;
  initialCompanionName?: string | null;
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

const getCosmiqEggLabel = (element: CompanionElementId) =>
  `${getCompanionElement(element).label} Egg`;

export const CompanionPersonalization = ({
  onComplete,
  isLoading = false,
  mode = "onboarding",
  layout = "fullscreen",
  initialElement = "fire",
  initialStoryTone = "epic_adventure",
  initialCompanionName = null,
}: CompanionPersonalizationProps) => {
  const restrictToPilot = mode === "onboarding" || mode === "reset";
  const [selectedPresetId, setSelectedPresetId] = useState<CompanionPresetId>(getDefaultPilotCompanionPresetId());
  const [selectedElement, setSelectedElement] = useState<CompanionElementId>(
    !restrictToPilot || isPilotCompanionElement(initialElement)
      ? initialElement
      : getDefaultPilotCompanionElementId(),
  );
  const [selectedTone, setSelectedTone] = useState<CompanionStoryTone>(initialStoryTone);
  const [customCompanionName, setCustomCompanionName] = useState(initialCompanionName ?? "");
  const [brokenPreviewKeys, setBrokenPreviewKeys] = useState<Record<string, boolean>>({});
  const isFullscreen = layout === "fullscreen";
  const isResetMode = mode === "reset";
  const isEggSelectionMode = mode === "onboarding" || isResetMode;
  const isHatchMode = mode === "hatch";
  const normalizedCustomCompanionName = normalizeCompanionCustomName(customCompanionName);

  const selectedPreset = useMemo(
    () => COMPANION_CATALOG_PRESETS.find((preset) => preset.id === selectedPresetId) ?? COMPANION_CATALOG_PRESETS[0],
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
  const selectedEggLabel = useMemo(
    () => getCosmiqEggLabel(selectedElement),
    [selectedElement],
  );
  const selectedDisplayName = normalizedCustomCompanionName
    ?? (isEggSelectionMode ? selectedEggLabel : selectedPreset.displayName);

  if (isLoading) {
    return <CompanionCreationLoader />;
  }

  const heading = isResetMode
    ? "Choose a Fresh Start"
    : isEggSelectionMode
      ? "Choose Your Starting Form"
    : isHatchMode
      ? "Your Companion Is Ready to Grow"
      : "Choose Your Companion Form";
  const subheading = isResetMode
    ? "Start fresh by choosing a visual nature, symbolic creature, and companion personality."
    : isEggSelectionMode
      ? "Select the visual nature your companion begins with. Its creature form will be revealed at the first growth milestone."
    : isHatchMode
      ? "Choose the symbolic creature your companion will become. Its visual nature and personality stay the same."
      : "Pick the creature, visual nature, and personality you want to carry forward.";
  const cta = isResetMode
    ? "Begin Again"
    : isEggSelectionMode
      ? "Begin My Daily Path"
    : isHatchMode
      ? "Reveal Companion"
      : "Save Companion Form";
  const renderPresetCarousel = () => (
    <div
      data-testid="companion-preset-carousel"
      className="flex w-full min-w-0 max-w-full gap-4 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-3 scroll-px-1 snap-x snap-mandatory touch-auto [-webkit-overflow-scrolling:touch]"
    >
      {COMPANION_CATALOG_PRESETS.map((preset) => {
        const previewUrl = getPresetPreviewUrl(preset.id, selectedElement);
        const previewKey = `${preset.id}:${selectedElement}`;
        const isSupported = isPilotCompanionPreset(preset.id);
        const isSelected = isSupported && preset.id === selectedPreset.id;

        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => {
              if (!isSupported) return;
              setSelectedPresetId(preset.id);
            }}
            disabled={!isSupported}
            aria-disabled={!isSupported}
            aria-pressed={isSelected}
            className={[
              "snap-center shrink-0 w-[250px] rounded-3xl border text-left transition-all duration-300 overflow-hidden disabled:cursor-not-allowed",
              isSelected
                ? "border-primary/70 bg-primary/10 shadow-[0_0_40px_rgba(168,85,247,0.20)] scale-[1.01]"
                : isSupported
                  ? "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10"
                  : "border-white/10 bg-white/[0.03] opacity-70 saturate-50",
            ].join(" ")}
            data-supported={isSupported ? "true" : "false"}
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
                    className={isSupported ? "h-full w-full" : "h-full w-full opacity-70"}
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
                  {!isSupported ? (
                    <span className="rounded-full border border-white/15 bg-black/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70">
                      {COMPANION_LEGACY_STATE_LABEL}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm text-foreground/90">
                {preset.revealCopy}
              </p>
              {!isSupported ? (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Existing companions keep their last approved portrait. New selection is unavailable.
                </p>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className={isFullscreen ? "relative z-10 flex min-h-[100dvh] w-full max-w-full touch-pan-y items-start justify-center overflow-x-hidden px-4 pb-safe-bottom pt-safe-top" : "w-full min-w-0 max-w-full"}>
      <div className={`min-w-0 w-full ${isFullscreen ? "max-w-5xl p-4 sm:p-8" : "p-2"} space-y-8 animate-scale-in cosmic-glass rounded-3xl border border-white/10`}>
        <div className="text-center space-y-4">
          <h1 className="text-3xl md:text-4xl font-heading font-black bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            {heading}
          </h1>
          <div className="space-y-2 max-w-2xl mx-auto">
            <p className="text-lg font-medium text-foreground">
              {isEggSelectionMode
                ? "Your companion begins as a small symbol with room to grow."
                : isHatchMode
                  ? "Your completed practices have reached a new visual milestone."
                  : "This keeps your progress while updating its visual form."}
            </p>
            <p className="text-sm text-muted-foreground">
              {subheading}
            </p>
          </div>
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="min-w-0 space-y-4">
            <div className="space-y-2">
              <Label className="text-lg font-semibold text-foreground">
                {isEggSelectionMode ? "Starting Forms" : isHatchMode ? "Growth Reveal" : "Companion Forms"}
              </Label>
              <p className="text-sm text-muted-foreground">
                {isEggSelectionMode
                  ? "Choose the visual nature you want to carry into your daily path."
                  : isHatchMode
                    ? "Pick the symbolic creature your companion will grow into."
                    : "Scroll through the companion roster and tap a card to lock your companion."}
              </p>
            </div>

            {isEggSelectionMode ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  {COMPANION_ELEMENTS.map((element) => {
                    const isSupported = isPilotCompanionElement(element.id)
                      || (!restrictToPilot && element.id === selectedElement);
                    const isSelected = isSupported && element.id === selectedElement;
                    return (
                      <button
                        key={element.id}
                        type="button"
                        onClick={() => {
                          if (!isSupported) return;
                          setSelectedElement(element.id);
                        }}
                        disabled={!isSupported}
                        aria-disabled={!isSupported}
                        aria-pressed={isSelected}
                        className={[
                          "rounded-3xl border text-left transition-all duration-300 overflow-hidden disabled:cursor-not-allowed",
                          isSelected
                            ? "border-primary/70 bg-primary/10 shadow-[0_0_40px_rgba(168,85,247,0.20)] scale-[1.01]"
                            : isSupported
                              ? "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10"
                              : "border-white/10 bg-white/[0.03] opacity-70 saturate-50",
                        ].join(" ")}
                        data-supported={isSupported ? "true" : "false"}
                      >
                        <div className="relative h-[220px] bg-gradient-to-br from-slate-950/80 via-slate-900/80 to-slate-950/95">
                          <CompanionImage
                            src={getEggPreviewUrl(element.id)}
                            alt={getCosmiqEggLabel(element.id)}
                            fit="contain"
                            className="h-full w-full p-4"
                            loading="lazy"
                          />
                          <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-lg font-heading font-bold text-white">
                                  {getCosmiqEggLabel(element.id)}
                                </div>
                                <div className="text-xs uppercase tracking-[0.2em] text-white/55">
                                  Stage 0 • Egg
                                </div>
                              </div>
                              {!isSupported ? (
                                <span className="rounded-full border border-white/15 bg-black/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70">
                                  {COMPANION_LEGACY_STATE_LABEL}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <div className="p-4 space-y-2">
                          <p className="text-sm text-foreground/90">
                            {element.summary}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            This choice sets your companion&apos;s visual nature.
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {isResetMode ? (
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label className="text-lg font-semibold text-foreground">Symbolic Creature</Label>
                      <p className="text-sm text-muted-foreground">
                        Choose the creature that will appear at your first growth milestone.
                      </p>
                    </div>
                    {renderPresetCarousel()}
                  </div>
                ) : null}
              </>
            ) : renderPresetCarousel()}
          </div>

          <div className="min-w-0 space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4">
              <div className="space-y-1">
                <Label className="text-lg font-semibold text-foreground">
                  {isResetMode ? "Selected Form and Creature" : isEggSelectionMode ? "Selected Starting Form" : "Selected Companion"}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {isResetMode
                    ? `${selectedElementMeta.label} visuals paired with a ${selectedPreset.displayName}.`
                    : isEggSelectionMode
                    ? `${selectedElementMeta.label} colors prepared for the first growth stage.`
                    : `${selectedPreset.displayName} with a ${selectedElementMeta.label.toLowerCase()} skin.`}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                {isEggSelectionMode ? (
                  <div className="space-y-3">
                    <div className="mx-auto h-44 w-44">
                      <CompanionImage
                        src={getEggPreviewUrl(selectedElement)}
                        alt={selectedEggLabel}
                        fit="contain"
                        className="h-full w-full"
                      />
                    </div>
                    <div className="text-sm font-medium text-foreground">{selectedDisplayName}</div>
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Creature revealed at the first growth milestone</div>
                    <p className="text-sm text-foreground/85">{selectedElementMeta.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      {isResetMode
                        ? "Stage 0 art stays shared across the roster. Your reset locks both the element and species now, then reveals that species when the shell cracks."
                        : "Stage 0 is shared across the roster. The egg locks your element now, and you&apos;ll choose the creature form when it hatches."}
                    </p>
                    {isResetMode ? (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left">
                        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Symbolic Creature</div>
                        <div className="mt-1 font-semibold text-foreground">{selectedPreset.displayName}</div>
                        <p className="mt-1 text-xs text-muted-foreground">{selectedPreset.revealCopy}</p>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div className="text-sm font-medium text-foreground">{selectedPreset.displayName}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">{selectedPreset.role}</div>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4">
              <div className="space-y-1">
                <Label htmlFor="companion-custom-name" className="text-lg font-semibold text-foreground">
                  Companion Name
                </Label>
                <p className="text-sm text-muted-foreground">
                  Optional. Leave blank to keep the generated companion name.
                </p>
              </div>
              <div className="space-y-3">
                <Input
                  id="companion-custom-name"
                  value={customCompanionName}
                  onChange={(event) => setCustomCompanionName(event.target.value)}
                  placeholder="Optional custom name"
                  maxLength={COMPANION_CUSTOM_NAME_MAX_LENGTH}
                  className="h-11 border-white/10 bg-black/20 text-foreground placeholder:text-muted-foreground"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {normalizedCustomCompanionName
                      ? `${normalizedCustomCompanionName} will appear right away, even before its first growth milestone.`
                      : "Your companion will use its generated name until you set one."}
                  </span>
                  <span>{customCompanionName.length}/{COMPANION_CUSTOM_NAME_MAX_LENGTH}</span>
                </div>
              </div>
            </div>

            {!isEggSelectionMode && isHatchMode && (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4">
                <div className="space-y-1">
                  <Label className="text-lg font-semibold text-foreground">Kept From Your Starting Form</Label>
                  <p className="text-sm text-muted-foreground">
                    This growth reveal only sets the creature form. Its visual nature and personality stay the same.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Visual Nature</div>
                    <div className="mt-2 font-semibold text-foreground">{selectedElementMeta.label}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{selectedElementMeta.summary}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Personality</div>
                    <div className="mt-2 font-semibold text-foreground">{selectedToneMeta.label}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{selectedToneMeta.summary}</p>
                  </div>
                </div>
              </div>
            )}

            {!isEggSelectionMode && !isHatchMode && (
              <div className="space-y-3">
                <Label className="text-lg font-semibold text-foreground">Visual Nature</Label>
                <div className="grid grid-cols-2 gap-3">
                  {COMPANION_ELEMENTS.map((element) => {
                    const isSupported = isPilotCompanionElement(element.id)
                      || (!restrictToPilot && element.id === selectedElement);
                    const isSelected = isSupported && selectedElement === element.id;
                    return (
                      <button
                        key={element.id}
                        type="button"
                        onClick={() => {
                          if (!isSupported) return;
                          setSelectedElement(element.id);
                        }}
                        disabled={!isSupported}
                        aria-disabled={!isSupported}
                        aria-pressed={isSelected}
                        className={[
                          "rounded-2xl border-2 p-4 text-left transition-all duration-200 disabled:cursor-not-allowed",
                          isSelected
                            ? "border-primary bg-primary/15 shadow-lg shadow-primary/15"
                            : isSupported
                              ? "border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/10"
                              : "border-white/10 bg-white/[0.03] opacity-70 saturate-50",
                        ].join(" ")}
                        data-supported={isSupported ? "true" : "false"}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="h-4 w-4 rounded-full shadow-[0_0_16px_currentColor]"
                              style={{ backgroundColor: element.anchorColor, color: element.anchorColor }}
                            />
                            <div className="font-semibold text-foreground">{element.label}</div>
                          </div>
                          {!isSupported ? (
                            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                              {COMPANION_LEGACY_STATE_LABEL}
                            </span>
                          ) : null}
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
                <Label className="text-lg font-semibold text-foreground">Personality</Label>
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
                {isResetMode
                  ? `${selectedEggLabel} • ${selectedPreset.displayName} • ${selectedToneMeta.label}`
                  : isEggSelectionMode
                  ? `${selectedEggLabel} • ${selectedToneMeta.label}`
                  : `${selectedPreset.displayName} • ${selectedElementMeta.label} • ${selectedToneMeta.label}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {isResetMode
                  ? "Your fresh start keeps the shared egg at stage 0 while locking the species, element, and tone you want for the next hatch."
                  : isEggSelectionMode
                  ? "Your egg locks the element now. Creature form is chosen when the shell cracks."
                  : isHatchMode
                    ? "Hatching preserves the egg&apos;s element and story tone while locking the creature form."
                    : "Your companion art will resolve from shared preset assets while the tone shapes the story only."}
              </p>
            </div>
            <Button
              onClick={() => onComplete({
                presetId: isResetMode ? selectedPreset.id : isEggSelectionMode ? null : selectedPreset.id,
                favoriteColor: getCompanionElementAnchorColor(selectedElement),
                spiritAnimal: isResetMode ? selectedPreset.displayName : isEggSelectionMode ? "Egg" : selectedPreset.displayName,
                coreElement: selectedElement,
                storyTone: selectedTone,
                companionName: normalizedCustomCompanionName,
              })}
              disabled={
                isLoading
                || !isPilotCompanionElement(selectedElement)
                || ((isResetMode || !isEggSelectionMode) && !isPilotCompanionPreset(selectedPreset.id))
              }
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
