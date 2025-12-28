import { motion } from "framer-motion";
import { Zap, Sparkles } from "lucide-react";
import { useViewMode } from "@/contexts/ViewModeContext";
import { cn } from "@/lib/utils";

export function ViewModeToggle() {
  const { viewMode, toggleViewMode } = useViewMode();
  const isFocus = viewMode === "focus";

  return (
    <button
      onClick={toggleViewMode}
      className={cn(
        "relative flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300",
        "border border-border/60 bg-muted/30 hover:bg-muted/50",
        isFocus 
          ? "text-foreground" 
          : "text-primary"
      )}
      aria-label={`Switch to ${isFocus ? "Quest" : "Focus"} mode`}
    >
      {/* Sliding background indicator */}
      <motion.div
        className={cn(
          "absolute inset-y-1 rounded-full -z-10",
          isFocus ? "bg-muted" : "bg-primary/20"
        )}
        initial={false}
        animate={{
          left: isFocus ? "4px" : "50%",
          right: isFocus ? "50%" : "4px",
        }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />

      {/* Focus option */}
      <span className={cn(
        "flex items-center gap-1 px-2 py-0.5 rounded-full transition-colors",
        isFocus ? "text-foreground" : "text-muted-foreground"
      )}>
        <Zap className="h-3 w-3" />
        <span className="hidden sm:inline">Focus</span>
      </span>

      {/* Quest option */}
      <span className={cn(
        "flex items-center gap-1 px-2 py-0.5 rounded-full transition-colors",
        !isFocus ? "text-primary" : "text-muted-foreground"
      )}>
        <Sparkles className="h-3 w-3" />
        <span className="hidden sm:inline">Quest</span>
      </span>
    </button>
  );
}
