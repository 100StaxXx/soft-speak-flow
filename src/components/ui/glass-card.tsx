import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const glassCardVariants = cva(
  "rounded-2xl border transition-all duration-300",
  {
    variants: {
      variant: {
        default: [
          "bg-card/78 backdrop-blur-lg",
          "border-border/60",
          "shadow-[0_10px_24px_rgba(0,0,0,0.22)]",
        ],
        elevated: [
          "bg-card/86 backdrop-blur-2xl",
          "border-border/70",
          "shadow-[0_14px_34px_rgba(0,0,0,0.28),0_2px_8px_rgba(0,0,0,0.12)]",
        ],
        inset: [
          "bg-background/60 backdrop-blur-lg",
          "border-border/45",
          "shadow-inner",
        ],
        hero: [
          "bg-gradient-to-br from-primary/[0.12] to-accent/[0.07] backdrop-blur-2xl",
          "border-border/60",
          "shadow-[0_16px_38px_rgba(0,0,0,0.24)]",
        ],
        subtle: [
          "bg-card/62 backdrop-blur-md",
          "border-border/45",
          "shadow-[0_6px_16px_rgba(0,0,0,0.16)]",
        ],
        ultra: [
          "bg-card/70 backdrop-blur-2xl",
          "border-border/55",
          "shadow-[0_10px_28px_rgba(0,0,0,0.24)]",
        ],
      },
      glow: {
        none: "",
        soft: "shadow-[0_0_30px_rgba(255,255,255,0.05)]",
        accent: "shadow-[0_0_40px_hsl(var(--accent)/0.15)]",
        primary: "shadow-[0_0_40px_hsl(var(--primary)/0.2)]",
      },
    },
    defaultVariants: {
      variant: "default",
      glow: "none",
    },
  }
);

export interface GlassCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassCardVariants> {
  asChild?: boolean;
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant, glow, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(glassCardVariants({ variant, glow }), className)}
      {...props}
    />
  )
);
GlassCard.displayName = "GlassCard";

export { GlassCard, glassCardVariants };
