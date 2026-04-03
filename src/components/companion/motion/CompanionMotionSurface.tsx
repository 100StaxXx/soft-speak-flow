import { type ReactNode } from "react";
import { CompanionMotionLayer } from "./CompanionMotionLayer";
import { cn } from "@/lib/utils";
import type { CompanionMotionEvent } from "@/config/companionMotion";
import type { CompanionMotionOverlayVariant } from "@/config/companionElementOverlayRecipes";

interface CompanionMotionSurfaceProps {
  variant: CompanionMotionOverlayVariant;
  stage: number;
  element?: string | null;
  event?: CompanionMotionEvent | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  className?: string;
  contentClassName?: string;
  backdropClassName?: string;
  foregroundClassName?: string;
  children: ReactNode;
}

export const CompanionMotionSurface = ({
  variant,
  stage,
  element,
  event,
  primaryColor,
  secondaryColor,
  className,
  contentClassName,
  backdropClassName,
  foregroundClassName,
  children,
}: CompanionMotionSurfaceProps) => (
  <div
    className={cn("relative isolate", className)}
    data-testid="companion-motion-surface"
  >
    <CompanionMotionLayer
      variant={variant}
      plane="backdrop"
      stage={stage}
      element={element}
      event={event}
      primaryColor={primaryColor}
      secondaryColor={secondaryColor}
      className={cn("absolute inset-0 z-0 rounded-2xl", backdropClassName)}
    />
    <div
      className={cn("relative z-10 h-full w-full", contentClassName)}
      data-testid="companion-motion-surface-content"
    >
      {children}
    </div>
    <CompanionMotionLayer
      variant={variant}
      plane="foreground"
      stage={stage}
      element={element}
      event={event}
      primaryColor={primaryColor}
      secondaryColor={secondaryColor}
      className={cn("absolute inset-0 z-20 rounded-2xl", foregroundClassName)}
    />
  </div>
);
