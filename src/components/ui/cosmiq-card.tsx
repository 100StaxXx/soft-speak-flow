import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cosmiqCardVariants = cva(
  "relative rounded-2xl backdrop-blur-xl border transition-all duration-300 overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-card/86 border-border/60 hover:border-border/80",
        warning: "bg-card/86 border-l-4 border-l-amber-500 border-t-border/40 border-r-border/40 border-b-border/40",
        success: "bg-card/86 border-l-4 border-l-green-500 border-t-border/40 border-r-border/40 border-b-border/40",
        info: "bg-card/86 border-l-4 border-l-blue-500 border-t-border/40 border-r-border/40 border-b-border/40",
        highlight: "bg-gradient-to-br from-primary/14 via-card/92 to-accent/12 border-primary/35 shadow-[0_12px_28px_hsl(var(--primary)/0.2)]",
        glass: "bg-card/74 border-border/55 backdrop-blur-2xl",
      },
      size: {
        default: "p-4",
        sm: "p-3",
        lg: "p-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface CosmiqCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cosmiqCardVariants> {
  glow?: boolean;
}

const CosmiqCard = React.forwardRef<HTMLDivElement, CosmiqCardProps>(
  ({ className, variant, size, glow, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          cosmiqCardVariants({ variant, size }),
          glow && "shadow-[0_10px_28px_hsl(var(--primary)/0.22)] hover:shadow-[0_14px_34px_hsl(var(--primary)/0.28)]",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
CosmiqCard.displayName = "CosmiqCard";

export { CosmiqCard, cosmiqCardVariants };
