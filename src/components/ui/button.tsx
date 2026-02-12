import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] text-sm font-semibold ring-offset-background transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.985]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_10px_20px_hsl(var(--primary)/0.28)] hover:bg-primary/92 active:bg-primary/88",
        destructive: "bg-destructive text-destructive-foreground shadow-[0_10px_20px_hsl(var(--destructive)/0.25)] hover:bg-destructive/92 active:bg-destructive/88",
        outline: "border border-border/70 bg-card/70 text-foreground hover:bg-card/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/85",
        ghost: "text-foreground/85 hover:bg-foreground/5 hover:text-foreground",
        link: "text-royal-purple underline-offset-4 hover:underline",
        cta: "bg-gradient-to-r from-royal-purple via-accent-purple to-nebula-pink text-pure-white shadow-[0_12px_24px_hsl(var(--royal-purple)/0.32)] hover:brightness-105",
        gradient: "bg-gradient-to-r from-primary to-accent text-pure-white shadow-[0_12px_24px_hsl(var(--primary)/0.25)] hover:brightness-105",
        accent: "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-[0_10px_20px_hsl(28_96%_56%/0.3)] hover:brightness-105",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-9 rounded-[12px] px-3 text-xs",
        lg: "h-12 rounded-[16px] px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
