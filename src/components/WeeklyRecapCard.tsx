import { Calendar, Sparkles, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { useWeeklyRecap } from "@/hooks/useWeeklyRecap";

export const WeeklyRecapCard = () => {
  const { currentRecap, openRecap, isSunday } = useWeeklyRecap();

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
        className="w-full p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-red-500/20 border border-amber-500/30 backdrop-blur-sm hover:border-amber-500/50 transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-amber-500/20 group-hover:bg-amber-500/30 transition-colors">
            <Sparkles className="h-5 w-5 text-amber-300" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-medium text-foreground">Your Week in Review</p>
            <p className="text-sm text-muted-foreground">{dateRange}</p>
          </div>
          {!currentRecap.viewed_at && (
            <div className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary font-medium">
              +5 XP
            </div>
          )}
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
      </button>
    </motion.div>
  );
};