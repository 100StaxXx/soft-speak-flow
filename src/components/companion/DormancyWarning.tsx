import { motion, AnimatePresence } from "framer-motion";
import { Moon, AlertTriangle } from "lucide-react";

interface DormancyWarningProps {
  daysUntilDormancy?: number;
  show: boolean;
}

export const DormancyWarning = ({ daysUntilDormancy = 2, show }: DormancyWarningProps) => {
  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="absolute top-2 left-2 right-2 z-20"
      >
        <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg px-3 py-2 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-orange-300">
            <AlertTriangle className="w-4 h-4 animate-pulse" />
            <span className="text-xs font-medium">
              {daysUntilDormancy === 1 
                ? "Your companion feels forgotten..." 
                : `${daysUntilDormancy} days until dormancy`}
            </span>
          </div>
          <p className="text-[10px] text-orange-200/70 mt-1 pl-6">
            Complete any activity to reconnect
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

interface DormantOverlayProps {
  isDormant: boolean;
  recoveryDays: number;
  daysUntilWake: number;
}

export const DormantOverlay = ({ isDormant, recoveryDays, daysUntilWake }: DormantOverlayProps) => {
  if (!isDormant) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm rounded-2xl"
    >
      <Moon className="w-12 h-12 text-slate-400 mb-3 animate-pulse" />
      <span className="text-slate-300 font-medium text-lg">Dormant</span>
      <p className="text-slate-400 text-sm mt-1 text-center px-4">
        Your companion has fallen into a deep sleep
      </p>
      
      {recoveryDays > 0 && (
        <div className="mt-4 px-4 w-full max-w-[200px]">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Awakening...</span>
            <span>{recoveryDays}/5 days</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(recoveryDays / 5) * 100}%` }}
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400"
            />
          </div>
        </div>
      )}
      
      {recoveryDays === 0 && (
        <p className="text-xs text-amber-400/70 mt-3 text-center px-6">
          Be active for 5 consecutive days to wake them
        </p>
      )}
    </motion.div>
  );
};
