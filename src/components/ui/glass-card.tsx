import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const glassCardVariants = cva(
  "rounded-2xl border transition-all duration-300",
  {
    variants: {
      variant: {
        default: [
          "bg-white/[0.03] backdrop-blur-xl",
          "border-white/[0.08]",
          "shadow-[0_8px_32px_rgba(0,0,0,0.12)]",
        ],
        elevated: [
          "bg-white/[0.06] backdrop-blur-2xl",
          "border-white/[0.12]",
          "shadow-[0_12px_40px_rgba(0,0,0,0.2),0_2px_8px_rgba(0,0,0,0.08)]",
        ],
        inset: [
          "bg-black/[0.1] backdrop-blur-lg",
          "border-white/[0.05]",
          "shadow-inner",
        ],
        hero: [
          "bg-gradient-to-br from-primary/[0.08] to-accent/[0.05] backdrop-blur-2xl",
          "border-white/[0.1]",
          "shadow-[0_16px_48px_rgba(0,0,0,0.15)]",
        ],
        subtle: [
          "bg-white/[0.02] backdrop-blur-md",
          "border-white/[0.04]",
          "shadow-[0_4px_16px_rgba(0,0,0,0.08)]",
        ],
        ultra: [
          "bg-white/[0.02] backdrop-blur-2xl",
          "border-white/[0.06]",
          "shadow-[0_8px_32px_rgba(0,0,0,0.15)]",
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
