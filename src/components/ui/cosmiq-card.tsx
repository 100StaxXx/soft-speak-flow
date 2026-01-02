import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cosmiqCardVariants = cva(
  "relative rounded-2xl backdrop-blur-xl border transition-all duration-300 overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-card/80 border-border/50 hover:border-border",
        warning: "bg-card/80 border-l-4 border-l-amber-500 border-t-border/30 border-r-border/30 border-b-border/30",
        success: "bg-card/80 border-l-4 border-l-green-500 border-t-border/30 border-r-border/30 border-b-border/30",
        info: "bg-card/80 border-l-4 border-l-blue-500 border-t-border/30 border-r-border/30 border-b-border/30",
        highlight: "bg-gradient-to-br from-primary/10 via-card/90 to-accent/10 border-primary/30 shadow-glow",
        glass: "bg-white/5 border-white/10 backdrop-blur-2xl",
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
          glow && "shadow-glow hover:shadow-glow-lg",
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
