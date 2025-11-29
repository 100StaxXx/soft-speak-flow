import { useEffect, useState, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CosmicTransitionProps {
  children: ReactNode;
  show: boolean;
  mode?: "warp" | "constellation";
  className?: string;
}

export const CosmicTransition = ({
  children,
  show,
  mode = "warp",
  className,
}: CosmicTransitionProps) => {
  const [shouldRender, setShouldRender] = useState(show);
  const [animationClass, setAnimationClass] = useState("");

  useEffect(() => {
    if (show) {
      setShouldRender(true);
      // Trigger enter animation
      requestAnimationFrame(() => {
        setAnimationClass(
          mode === "warp" ? "warp-enter" : "animate-constellation-fade-in"
        );
      });
    } else {
      // Trigger exit animation
      setAnimationClass(
        mode === "warp" ? "warp-exit" : "animate-constellation-fade-out"
      );
      // Wait for animation to complete before unmounting
      const timeout = setTimeout(() => {
        setShouldRender(false);
      }, mode === "warp" ? 300 : 500);
      return () => clearTimeout(timeout);
    }
  }, [show, mode]);

  if (!shouldRender) return null;

  return (
    <div className={cn(animationClass, className)}>
      {children}
    </div>
  );
};
