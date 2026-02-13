import { useState, memo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Snowflake, Flame, AlertTriangle, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

interface StreakFreezePromptModalProps {
  open: boolean;
  currentStreak: number;
  freezesAvailable: number;
  onUseFreeze: () => Promise<void>;
  onResetStreak: () => Promise<void>;
  onOpenChange?: (open: boolean) => void;
  isResolving: boolean;
}

export const StreakFreezePromptModal = memo(function StreakFreezePromptModal({
  open,
  currentStreak,
  freezesAvailable,
  onUseFreeze,
  onResetStreak,
  onOpenChange,
  isResolving,
}: StreakFreezePromptModalProps) {
  const [selectedAction, setSelectedAction] = useState<"freeze" | "reset" | null>(null);

  const handleUseFreeze = async () => {
    setSelectedAction("freeze");
    await onUseFreeze();
  };

  const handleResetStreak = async () => {
    setSelectedAction("reset");
    await onResetStreak();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-xl border-amber-500/30" hideCloseButton>
        <DialogHeader className="text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-auto mb-4 p-4 rounded-full bg-amber-500/20 border border-amber-500/30"
          >
            <AlertTriangle className="w-10 h-10 text-amber-400" />
          </motion.div>
          <DialogTitle className="text-2xl font-bold text-center">
            Your Streak is at Risk!
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            You missed a day. What would you like to do?
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Current Streak Display */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex items-center justify-center gap-3 p-4 rounded-xl bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30"
          >
            <Flame className="w-8 h-8 text-orange-400" />
            <div className="text-center">
              <p className="text-3xl font-bold text-foreground">{currentStreak}</p>
              <p className="text-sm text-muted-foreground">day streak</p>
            </div>
          </motion.div>

          {/* Options */}
          <div className="space-y-3">
            {/* Use Freeze Option */}
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Button
                onClick={handleUseFreeze}
                disabled={isResolving || freezesAvailable <= 0}
                className="w-full h-auto py-4 px-4 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-500/40 text-foreground"
                variant="outline"
              >
                <div className="flex items-center gap-4 w-full">
                  <div className="p-2 rounded-full bg-cyan-500/20">
                    <Snowflake className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-base">Use Streak Freeze</p>
                    <p className="text-sm text-muted-foreground">
                      Keep your {currentStreak}-day streak alive
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-cyan-400">
                      {freezesAvailable} available
                    </p>
                  </div>
                </div>
              </Button>
              {freezesAvailable <= 0 && (
                <p className="text-xs text-muted-foreground text-center mt-1">
                  No freezes available. Freezes reset weekly.
                </p>
              )}
            </motion.div>

            {/* Reset Streak Option */}
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Button
                onClick={handleResetStreak}
                disabled={isResolving}
                className="w-full h-auto py-4 px-4 bg-muted/30 hover:bg-muted/50 border border-border/50 text-foreground"
                variant="outline"
              >
                <div className="flex items-center gap-4 w-full">
                  <div className="p-2 rounded-full bg-muted/30">
                    <Sparkles className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-base">Start Fresh</p>
                    <p className="text-sm text-muted-foreground">
                      Let the streak reset and begin anew
                    </p>
                  </div>
                </div>
              </Button>
            </motion.div>
          </div>

          {/* Loading indicator */}
          {isResolving && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-sm text-muted-foreground"
            >
              {selectedAction === "freeze" ? "Preserving your streak..." : "Resetting streak..."}
            </motion.div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});
