import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 uppercase tracking-wide active:scale-95",
  {
    variants: {
      variant: {
        default: "bg-royal-purple text-pure-white hover:bg-royal-purple/90 shadow-soft hover:shadow-glow active:shadow-medium",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-soft",
        outline: "border-2 border-primary/40 bg-card/50 text-foreground hover:bg-primary/10 hover:border-primary/60",
        secondary: "bg-graphite text-pure-white hover:bg-graphite/90 border-2 border-steel/20 shadow-soft",
        ghost: "hover:bg-graphite/50 hover:text-royal-purple",
        link: "text-royal-purple underline-offset-4 hover:underline",
        cta: "bg-gradient-to-r from-royal-purple via-accent-purple to-nebula-pink text-pure-white hover:shadow-glow-lg hover:scale-[1.02] shadow-medium font-black",
        gradient: "bg-gradient-to-r from-primary to-accent text-pure-white shadow-glow hover:shadow-glow-lg hover:scale-[1.02]",
        accent: "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-soft hover:shadow-medium hover:scale-[1.02]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-12 rounded-lg px-8 text-base",
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
