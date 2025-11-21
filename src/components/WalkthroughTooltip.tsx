import React from "react";
import { TooltipRenderProps } from "react-joyride";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

/**
 * Custom tooltip component for the walkthrough that ensures mobile responsiveness
 * Specifically addresses the close button being tappable on mobile devices
 */

// Mobile-optimized button styles to ensure proper touch interaction
const MOBILE_BUTTON_STYLES = {
  minHeight: "44px",
  touchAction: "manipulation" as const,
};

export const WalkthroughTooltip: React.FC<TooltipRenderProps> = ({
  continuous,
  index,
  step,
  backProps,
  closeProps,
  primaryProps,
  skipProps,
  tooltipProps,
  isLastStep,
}) => {
  const { content, title, hideBackButton, hideCloseButton } = step as {
    content: React.ReactNode;
    title?: React.ReactNode;
    hideBackButton?: boolean;
    hideCloseButton?: boolean;
  };

  return (
    <div
      {...tooltipProps}
      className="relative bg-card text-card-foreground rounded-2xl border-[3px] border-primary/80 shadow-2xl p-6 max-w-[85vw] sm:max-w-md"
      style={{
        animation: "tooltip-border-pulse 2s ease-in-out infinite",
      }}
    >
      {/* Close button - positioned absolutely with mobile-optimized tap target */}
      {!hideCloseButton && (
        <button
          {...closeProps}
          className="absolute top-2 right-2 z-50 rounded-full p-2 hover:bg-accent/20 active:bg-accent/30 transition-colors"
          style={{
            // Ensure minimum tap target size for mobile (44x44px recommended by Apple/Google)
            minWidth: "44px",
            minHeight: "44px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
          }}
          aria-label="Close tour"
        >
          <X className="h-5 w-5 text-foreground" />
        </button>
      )}

      {/* Title */}
      {title && (
        <h3 className="text-xl font-bold mb-3 pr-8">{title}</h3>
      )}

      {/* Content */}
      <div className="text-base leading-relaxed mb-4 text-foreground/90">
        {content}
      </div>

      {/* Footer with action buttons */}
      <div className="flex gap-2 mt-4">
        {index > 0 && !hideBackButton && (
          <Button
            {...backProps}
            variant="outline"
            size="lg"
            className="flex-1"
            style={MOBILE_BUTTON_STYLES}
          >
            Back
          </Button>
        )}

        {continuous && (
          <Button
            {...primaryProps}
            variant="default"
            size="lg"
            className="flex-1"
            style={MOBILE_BUTTON_STYLES}
          >
            {isLastStep ? "Close" : "Next"}
          </Button>
        )}

        {!continuous && !isLastStep && (
          <Button
            {...skipProps}
            variant="outline"
            size="lg"
            className="flex-1"
            style={MOBILE_BUTTON_STYLES}
          >
            Skip
          </Button>
        )}
      </div>
    </div>
  );
};
