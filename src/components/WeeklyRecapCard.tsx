import { memo } from "react";
import { Sparkles, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { useWeeklyRecap } from "@/hooks/useWeeklyRecap";

export const WeeklyRecapCard = memo(() => {
  const { currentRecap, openRecap } = useWeeklyRecap();

  // Only show if recap exists for current week
  if (!currentRecap) return null;

  const startDate = parseISO(currentRecap.week_start_date);
  const endDate = parseISO(currentRecap.week_end_date);
  const dateRange = `${format(startDate, "MMM d")} - ${format(endDate, "MMM d")}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4"
    >
      <button
        onClick={() => openRecap(currentRecap)}
        className="w-full p-4 rounded-2xl bg-gradient-to-r from-stardust-gold/10 via-amber-500/5 to-celestial-blue/5 border border-white/[0.08] backdrop-blur-2xl hover:border-stardust-gold/30 transition-all group shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-stardust-gold/20 group-hover:bg-stardust-gold/30 transition-colors">
            <Sparkles className="h-5 w-5 text-stardust-gold" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-medium text-foreground">Your Week in Review</p>
            <p className="text-sm text-celestial-blue">{dateRange}</p>
          </div>
          {!currentRecap.viewed_at && (
            <div className="text-xs px-2 py-1 rounded-full bg-stardust-gold/20 text-stardust-gold font-medium">
              +5 XP
            </div>
          )}
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-stardust-gold transition-colors" />
        </div>
      </button>
    </motion.div>
  );
});

WeeklyRecapCard.displayName = 'WeeklyRecapCard';