import { useState, type CSSProperties } from "react";
import { useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CompanionCreationLoader } from "@/components/CompanionCreationLoader";
import {
  COMPANION_ELEMENTS,
  getCompanionElement,
  getCompanionElementAnchorColor,
  type CompanionElementId,
  type CompanionPresetId,
  type CompanionStoryTone,
} from "@/config/companionCatalog";
import { cn } from "@/lib/utils";

const CHAMBER_ASSET_BASE = "/onboarding/egg-chamber";

type ChamberSlotConfig = {
  elementId: CompanionElementId;
  centerX: string;
  centerY: string;
  width: string;
  height: string;
  eggWidth: string;
  eggBottom: string;
  pedestalWidth: string;
  pedestalBottom: string;
  plaqueWidth: string;
  plaqueBottom: string;
  bounceDelay: string;
  bounceDuration: string;
  eggSrc: string;
  glowColor: string;
  chipAccent: string;
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

type ChamberSpark = {
  x: string;
  y: string;
  size: string;
  opacity: number;
  delay: string;
  duration: string;
};

const buildChamberSlotConfig = (
  config: Omit<ChamberSlotConfig, "chipAccent" | "glowColor">,
): ChamberSlotConfig => {
  const element = getCompanionElement(config.elementId);

  return {
    ...config,
    glowColor: getCompanionElementAnchorColor(config.elementId),
    chipAccent: element.accentColor,
  };
};

const CHAMBER_SLOTS: Record<CompanionElementId, ChamberSlotConfig> = {
  fire: buildChamberSlotConfig({
    elementId: "fire",
    centerX: "18.6%",
    centerY: "29.2%",
    width: "28.8%",
    height: "31.5%",
    eggWidth: "74%",
    eggBottom: "23%",
    pedestalWidth: "80%",
    pedestalBottom: "11%",
    plaqueWidth: "66%",
    plaqueBottom: "1.5%",
    bounceDelay: "-0.1s",
    bounceDuration: "3.4s",
    eggSrc: `${CHAMBER_ASSET_BASE}/ember_eggclear.png`,
  }),
  ice: buildChamberSlotConfig({
    elementId: "ice",
    centerX: "49.9%",
    centerY: "29.1%",
    width: "31.2%",
    height: "32%",
    eggWidth: "79%",
    eggBottom: "22.5%",
    pedestalWidth: "82%",
    pedestalBottom: "11.2%",
    plaqueWidth: "67%",
    plaqueBottom: "1.8%",
    bounceDelay: "-1.2s",
    bounceDuration: "3.9s",
    eggSrc: `${CHAMBER_ASSET_BASE}/frost_eggclear.png`,
  }),
  nature: buildChamberSlotConfig({
    elementId: "nature",
    centerX: "81.2%",
    centerY: "29.4%",
    width: "28.8%",
    height: "31.5%",
    eggWidth: "72%",
    eggBottom: "23%",
    pedestalWidth: "80%",
    pedestalBottom: "11%",
    plaqueWidth: "66%",
    plaqueBottom: "1.5%",
    bounceDelay: "-0.8s",
    bounceDuration: "3.6s",
    eggSrc: `${CHAMBER_ASSET_BASE}/terra_eggclear.png`,
  }),
  void: buildChamberSlotConfig({
    elementId: "void",
    centerX: "18.6%",
    centerY: "57.2%",
    width: "28%",
    height: "31.5%",
    eggWidth: "69%",
    eggBottom: "24.5%",
    pedestalWidth: "78%",
    pedestalBottom: "11%",
    plaqueWidth: "64%",
    plaqueBottom: "1.5%",
    bounceDelay: "-1.7s",
    bounceDuration: "4.1s",
    eggSrc: `${CHAMBER_ASSET_BASE}/void_eggclear.png`,
  }),
  storm: buildChamberSlotConfig({
    elementId: "storm",
    centerX: "49.9%",
    centerY: "57.8%",
    width: "29%",
    height: "31.8%",
    eggWidth: "71%",
    eggBottom: "24.8%",
    pedestalWidth: "80%",
    pedestalBottom: "11.2%",
    plaqueWidth: "66%",
    plaqueBottom: "1.7%",
    bounceDelay: "-2.2s",
    bounceDuration: "3.7s",
    eggSrc: `${CHAMBER_ASSET_BASE}/storm_eggclear.png`,
  }),
  light: buildChamberSlotConfig({
    elementId: "light",
    centerX: "81.2%",
    centerY: "57.2%",
    width: "28.8%",
    height: "31.5%",
    eggWidth: "59%",
    eggBottom: "25.4%",
    pedestalWidth: "80%",
    pedestalBottom: "11%",
    plaqueWidth: "64%",
    plaqueBottom: "1.5%",
    bounceDelay: "-0.5s",
    bounceDuration: "3.5s",
    eggSrc: `${CHAMBER_ASSET_BASE}/light_eggclear.png`,
  }),
};

const CHAMBER_SPARKS: ChamberSpark[] = [
  { x: "7%", y: "9%", size: "6px", opacity: 0.45, delay: "-0.4s", duration: "4.8s" },
  { x: "18%", y: "15%", size: "4px", opacity: 0.35, delay: "-1.2s", duration: "5.6s" },
  { x: "31%", y: "11%", size: "5px", opacity: 0.5, delay: "-0.8s", duration: "4.4s" },
  { x: "44%", y: "19%", size: "5px", opacity: 0.36, delay: "-2.1s", duration: "5.4s" },
  { x: "59%", y: "12%", size: "6px", opacity: 0.44, delay: "-0.6s", duration: "4.2s" },
  { x: "72%", y: "17%", size: "4px", opacity: 0.32, delay: "-1.7s", duration: "5.8s" },
  { x: "86%", y: "10%", size: "5px", opacity: 0.42, delay: "-0.2s", duration: "4.9s" },
  { x: "13%", y: "35%", size: "5px", opacity: 0.28, delay: "-2.4s", duration: "6.1s" },
  { x: "27%", y: "46%", size: "6px", opacity: 0.31, delay: "-1.3s", duration: "4.6s" },
  { x: "51%", y: "42%", size: "4px", opacity: 0.3, delay: "-0.9s", duration: "5.1s" },
  { x: "77%", y: "39%", size: "5px", opacity: 0.27, delay: "-1.8s", duration: "6.3s" },
  { x: "90%", y: "48%", size: "4px", opacity: 0.29, delay: "-0.5s", duration: "5.7s" },
  { x: "9%", y: "72%", size: "5px", opacity: 0.25, delay: "-2.2s", duration: "6.2s" },
  { x: "37%", y: "82%", size: "4px", opacity: 0.24, delay: "-1.1s", duration: "5.5s" },
  { x: "62%", y: "79%", size: "6px", opacity: 0.3, delay: "-0.7s", duration: "4.7s" },
  { x: "88%", y: "86%", size: "4px", opacity: 0.25, delay: "-1.9s", duration: "5.9s" },
];

export const OnboardingEggSelection = ({
  onComplete,
  isLoading = false,
  storyTone,
  initialElement = null,
  onBack,
}: OnboardingEggSelectionProps) => {
  const prefersReducedMotion = useReducedMotion();
  const [selectedElement, setSelectedElement] = useState<CompanionElementId | null>(initialElement);

  const handleContinue = () => {
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
  };

  if (isLoading) {
    return <CompanionCreationLoader />;
  }

  return (
    <div className="relative z-10 min-h-screen pt-safe-top pb-safe-bottom">
      <div className="onboarding-egg-selection__layout mx-auto flex w-full max-w-[46rem] items-center justify-center">
        <div
          className="onboarding-egg-chamber"
          data-reduced-motion={prefersReducedMotion ? "true" : "false"}
          data-selected-element={selectedElement ?? ""}
          data-testid="onboarding-egg-chamber"
        >
          <div className="onboarding-egg-chamber__cosmos" aria-hidden="true">
            <span className="onboarding-egg-chamber__cosmos-orbit onboarding-egg-chamber__cosmos-orbit--left" />
            <span className="onboarding-egg-chamber__cosmos-orbit onboarding-egg-chamber__cosmos-orbit--right" />
          </div>

          {onBack ? (
            <Button
              type="button"
              variant="ghost"
              onClick={onBack}
              className="onboarding-egg-chamber__back"
            >
              Back
            </Button>
          ) : null}

          <div className="onboarding-egg-chamber__frame">
            <div className="onboarding-egg-chamber__title-wrap">
              <div className="onboarding-egg-chamber__title-ribbon">
                <h1 className="onboarding-egg-chamber__title">Choose Your Element</h1>
              </div>
            </div>

            <div className="onboarding-egg-chamber__scene">
              <div className="onboarding-egg-chamber__scene-ambience" aria-hidden="true">
                <span className="onboarding-egg-chamber__beam onboarding-egg-chamber__beam--left" />
                <span className="onboarding-egg-chamber__beam onboarding-egg-chamber__beam--center" />
                <span className="onboarding-egg-chamber__beam onboarding-egg-chamber__beam--right" />
                <span className="onboarding-egg-chamber__tier onboarding-egg-chamber__tier--upper" />
                <span className="onboarding-egg-chamber__tier onboarding-egg-chamber__tier--lower" />
                <span className="onboarding-egg-chamber__mist" />
              </div>

              {CHAMBER_SPARKS.map((spark, index) => (
                <span
                  key={`spark-${index}`}
                  className="onboarding-egg-chamber__spark"
                  style={{
                    left: spark.x,
                    top: spark.y,
                    width: spark.size,
                    height: spark.size,
                    opacity: spark.opacity,
                    animationDelay: spark.delay,
                    animationDuration: spark.duration,
                  }}
                  aria-hidden="true"
                />
              ))}

              {ELEMENT_ORDER.map((elementId) => {
                const slot = CHAMBER_SLOTS[elementId];
                const element = getCompanionElement(elementId);
                const isSelected = selectedElement === element.id;
                const slotStyle: ChamberSlotStyle = {
                  "--egg-slot-x": slot.centerX,
                  "--egg-slot-y": slot.centerY,
                  "--egg-slot-width": slot.width,
                  "--egg-slot-height": slot.height,
                  "--egg-width": slot.eggWidth,
                  "--egg-bottom": slot.eggBottom,
                  "--pedestal-width": slot.pedestalWidth,
                  "--pedestal-bottom": slot.pedestalBottom,
                  "--plaque-width": slot.plaqueWidth,
                  "--plaque-bottom": slot.plaqueBottom,
                  "--egg-delay": slot.bounceDelay,
                  "--egg-duration": slot.bounceDuration,
                  "--egg-glow": slot.glowColor,
                  "--egg-accent": slot.chipAccent,
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
                    <span className="onboarding-egg-slot__pedestal-shadow" aria-hidden="true" />
                    <span className="onboarding-egg-slot__pedestal-base" aria-hidden="true" />
                    <span className="onboarding-egg-slot__pedestal" aria-hidden="true" />
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
                    <span
                      className="onboarding-egg-slot__plaque"
                      data-testid={`pedestal-label-${element.id}`}
                    >
                      {element.productLabel}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="onboarding-egg-chamber__chips" aria-hidden="true">
              {COMPANION_ELEMENTS.map((element) => {
                const slot = CHAMBER_SLOTS[element.id];
                const isSelected = selectedElement === element.id;

                return (
                  <div
                    key={element.id}
                    className="onboarding-element-chip"
                    data-selected={isSelected ? "true" : "false"}
                    data-testid={`element-chip-${element.id}`}
                    style={
                      {
                        "--chip-glow": slot.glowColor,
                        "--chip-accent": slot.chipAccent,
                      } as ChamberSlotStyle
                    }
                  >
                    <span className="onboarding-element-chip__core" />
                    <span className="onboarding-element-chip__label">{element.productLabel}</span>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className="onboarding-egg-chamber__continue"
              onClick={handleContinue}
              disabled={!selectedElement}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
