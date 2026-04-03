import { useState, type CSSProperties } from "react";
import { useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CompanionCreationLoader } from "@/components/CompanionCreationLoader";
import {
  COMPANION_ELEMENTS,
  COMPANION_STORY_TONES,
  getCompanionElementAnchorColor,
  type CompanionElementId,
  type CompanionPresetId,
  type CompanionStoryTone,
} from "@/config/companionCatalog";
import { cn } from "@/lib/utils";

const CHAMBER_ASSET_BASE = "/onboarding/egg-chamber";
const CHAMBER_BACKGROUND_SRC = `${CHAMBER_ASSET_BASE}/choose-your-element-selection-screen.png`;
const CHAMBER_PEDESTALS_SRC = `${CHAMBER_ASSET_BASE}/all_pedestals.png`;

type ChamberSlotConfig = {
  centerX: string;
  centerY: string;
  width: string;
  height: string;
  eggWidth: string;
  eggBottom: string;
  bounceDelay: string;
  bounceDuration: string;
  eggSrc: string;
  glowColor: string;
};

type ChamberSlotStyle = CSSProperties & Record<`--${string}`, string>;

interface OnboardingCompanionSelectionData {
  presetId: CompanionPresetId | null;
  favoriteColor: string;
  spiritAnimal: string;
  coreElement: CompanionElementId;
  storyTone: CompanionStoryTone;
}

export interface OnboardingEggSelectionProps {
  onComplete: (data: OnboardingCompanionSelectionData) => void;
  isLoading?: boolean;
  storyTone: CompanionStoryTone;
  initialElement?: CompanionElementId | null;
  onBack?: () => void;
}

const ELEMENT_ORDER: CompanionElementId[] = ["fire", "ice", "nature", "void", "storm", "light"];

const CHAMBER_SLOTS: Record<CompanionElementId, ChamberSlotConfig> = {
  fire: {
    centerX: "18.6%",
    centerY: "29.4%",
    width: "28.5%",
    height: "31%",
    eggWidth: "76%",
    eggBottom: "17%",
    bounceDelay: "-0.1s",
    bounceDuration: "3.4s",
    eggSrc: `${CHAMBER_ASSET_BASE}/ember_eggclear.png`,
    glowColor: "#ff7a1a",
  },
  ice: {
    centerX: "49.9%",
    centerY: "29.1%",
    width: "31%",
    height: "31.5%",
    eggWidth: "81%",
    eggBottom: "16.5%",
    bounceDelay: "-1.2s",
    bounceDuration: "3.9s",
    eggSrc: `${CHAMBER_ASSET_BASE}/frost_eggclear.png`,
    glowColor: "#80d4ff",
  },
  nature: {
    centerX: "81.2%",
    centerY: "29.4%",
    width: "28.5%",
    height: "31%",
    eggWidth: "74%",
    eggBottom: "17%",
    bounceDelay: "-0.8s",
    bounceDuration: "3.6s",
    eggSrc: `${CHAMBER_ASSET_BASE}/terra_eggclear.png`,
    glowColor: "#a3f46d",
  },
  void: {
    centerX: "18.6%",
    centerY: "56.7%",
    width: "27.5%",
    height: "30.5%",
    eggWidth: "71%",
    eggBottom: "19%",
    bounceDelay: "-1.7s",
    bounceDuration: "4.1s",
    eggSrc: `${CHAMBER_ASSET_BASE}/void_eggclear.png`,
    glowColor: "#b04dff",
  },
  storm: {
    centerX: "49.9%",
    centerY: "56.6%",
    width: "28.5%",
    height: "31%",
    eggWidth: "72%",
    eggBottom: "19%",
    bounceDelay: "-2.2s",
    bounceDuration: "3.7s",
    eggSrc: `${CHAMBER_ASSET_BASE}/storm_eggclear.png`,
    glowColor: "#ffb648",
  },
  light: {
    centerX: "81.2%",
    centerY: "56.6%",
    width: "28.5%",
    height: "31%",
    eggWidth: "65%",
    eggBottom: "19.2%",
    bounceDelay: "-0.5s",
    bounceDuration: "3.5s",
    eggSrc: `${CHAMBER_ASSET_BASE}/light_eggclear.png`,
    glowColor: "#ffe46b",
  },
};

export const OnboardingEggSelection = ({
  onComplete,
  isLoading = false,
  storyTone,
  initialElement = null,
  onBack,
}: OnboardingEggSelectionProps) => {
  const prefersReducedMotion = useReducedMotion();
  const [selectedElement, setSelectedElement] = useState<CompanionElementId | null>(initialElement);

  const selectedElementMeta = selectedElement
    ? COMPANION_ELEMENTS.find((element) => element.id === selectedElement) ?? null
    : null;
  const selectedToneMeta =
    COMPANION_STORY_TONES.find((tone) => tone.value === storyTone) ?? COMPANION_STORY_TONES[0];

  if (isLoading) {
    return <CompanionCreationLoader />;
  }

  return (
    <div className="relative z-10 min-h-screen px-4 pt-safe-top pb-safe-bottom">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-4 py-6">
        <div className="w-full max-w-[42rem]">
          <div className="flex flex-col gap-4 rounded-[28px] border border-white/[0.10] bg-[linear-gradient(180deg,rgba(27,18,41,0.92),rgba(18,13,31,0.92))] p-4 shadow-[0_20px_52px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-3">
                <span className="inline-flex rounded-full border border-white/[0.12] bg-white/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/[0.72]">
                  Final Choice
                </span>
                <div className="space-y-1.5">
                  <h1 className="text-2xl font-semibold text-white sm:text-[2rem]">Choose Your Egg</h1>
                  <p className="max-w-2xl text-sm leading-6 text-white/[0.72] sm:text-base">
                    Let the chamber answer with the shell that feels most like the beginning of your companion bond.
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

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-sky-300/[0.20] bg-sky-300/[0.10] px-3 py-1 text-sm font-semibold text-sky-100">
                Story Tone: {selectedToneMeta.label}
              </span>
              {selectedElementMeta ? (
                <span className="rounded-full border border-amber-300/[0.25] bg-amber-300/[0.10] px-3 py-1 text-sm font-semibold text-amber-100">
                  {selectedElementMeta.productLabel} Egg
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div
          className="onboarding-egg-chamber w-full max-w-[42rem]"
          data-reduced-motion={prefersReducedMotion ? "true" : "false"}
          data-selected-element={selectedElement ?? ""}
          data-testid="onboarding-egg-chamber"
        >
          <div className="onboarding-egg-chamber__scene">
            <img
              src={CHAMBER_BACKGROUND_SRC}
              alt=""
              aria-hidden="true"
              className="onboarding-egg-chamber__background"
              loading="eager"
            />
            <img
              src={CHAMBER_PEDESTALS_SRC}
              alt=""
              aria-hidden="true"
              className="onboarding-egg-chamber__pedestal-overlay"
              loading="eager"
            />

            {ELEMENT_ORDER.map((elementId) => {
              const slot = CHAMBER_SLOTS[elementId];
              const element = COMPANION_ELEMENTS.find((item) => item.id === elementId);

              if (!element) {
                return null;
              }

              const isSelected = selectedElement === element.id;
              const slotStyle: ChamberSlotStyle = {
                "--egg-slot-x": slot.centerX,
                "--egg-slot-y": slot.centerY,
                "--egg-slot-width": slot.width,
                "--egg-slot-height": slot.height,
                "--egg-width": slot.eggWidth,
                "--egg-bottom": slot.eggBottom,
                "--egg-delay": slot.bounceDelay,
                "--egg-duration": slot.bounceDuration,
                "--egg-glow": slot.glowColor,
              };

              return (
                <button
                  key={element.id}
                  type="button"
                  className="onboarding-egg-slot"
                  data-selected={isSelected ? "true" : "false"}
                  data-element={element.id}
                  data-testid={`egg-slot-${element.id}`}
                  style={slotStyle}
                  aria-label={`Select ${element.productLabel} egg`}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedElement(element.id)}
                >
                  <span className="onboarding-egg-slot__pedestal-flare" aria-hidden="true" />
                  <span className="onboarding-egg-slot__egg-aura" aria-hidden="true" />
                  <span
                    className={cn(
                      "onboarding-egg-slot__float",
                      !prefersReducedMotion && "onboarding-egg-slot__float--animated",
                    )}
                    data-testid={`egg-float-${element.id}`}
                    data-bouncing={prefersReducedMotion ? "false" : "true"}
                    aria-hidden="true"
                  >
                    <img
                      src={slot.eggSrc}
                      alt=""
                      className="onboarding-egg-slot__egg"
                      loading="lazy"
                    />
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              className="onboarding-egg-chamber__continue"
              onClick={() => {
                if (!selectedElement) {
                  return;
                }

                onComplete({
                  presetId: null,
                  favoriteColor: getCompanionElementAnchorColor(selectedElement),
                  spiritAnimal: "Egg",
                  coreElement: selectedElement,
                  storyTone,
                });
              }}
              disabled={!selectedElement}
              aria-label="Continue"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
