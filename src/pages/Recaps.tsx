import { Calendar, ChevronLeft, Sparkles, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { PageTransition } from "@/components/PageTransition";
import { useWeeklyRecap, WeeklyRecap } from "@/hooks/useWeeklyRecap";
import { WeeklyRecapModal } from "@/components/WeeklyRecapModal";
import { formatDisplayLabel } from "@/lib/utils";

const TrendIcon = ({ trend }: { trend: string }) => {
  switch (trend) {
    case "improving":
      return <TrendingUp className="h-4 w-4 text-green-400" />;
    case "declining":
      return <TrendingDown className="h-4 w-4 text-red-400" />;
    default:
      return <Minus className="h-4 w-4 text-yellow-400" />;
  }
};

const RecapCard = ({ recap, onClick }: { recap: WeeklyRecap; onClick: () => void }) => {
  const startDate = parseISO(recap.week_start_date);
  const endDate = parseISO(recap.week_end_date);
  const dateRange = `${format(startDate, "MMM d")} - ${format(endDate, "MMM d, yyyy")}`;

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="w-full p-4 rounded-2xl bg-card/50 border border-border/30 hover:border-primary/30 transition-all text-left"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          {dateRange}
        </div>
        <div className="flex items-center gap-1">
          <TrendIcon trend={recap.mood_data.trend} />
          <span className="text-xs text-muted-foreground">
            {formatDisplayLabel(recap.mood_data.trend)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <p className="text-lg font-bold text-blue-400">{recap.stats.checkIns}</p>
          <p className="text-[10px] text-muted-foreground">Check-ins</p>
        </div>
        <div>
          <p className="text-lg font-bold text-purple-400">{recap.stats.reflections}</p>
          <p className="text-[10px] text-muted-foreground">Reflections</p>
        </div>
        <div>
          <p className="text-lg font-bold text-green-400">{recap.stats.quests}</p>
          <p className="text-[10px] text-muted-foreground">Quests</p>
        </div>
        <div>
          <p className="text-lg font-bold text-amber-400">{recap.stats.habits}</p>
          <p className="text-[10px] text-muted-foreground">Habits</p>
        </div>
      </div>

      {recap.win_highlights.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/30">
          <p className="text-xs text-muted-foreground line-clamp-1">
            ✨ {recap.win_highlights[0]}
          </p>
        </div>
      )}
    </motion.button>
  );
};

const Recaps = () => {
  const navigate = useNavigate();
  const { pastRecaps, isLoading, openRecap } = useWeeklyRecap();

  return (
    <PageTransition>
      <StarfieldBackground />
      
      <div className="min-h-screen pb-nav-safe pt-safe relative z-10">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 safe-area-top">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/profile")}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-400" />
                  Weekly Recaps
                </h1>
                <p className="text-sm text-muted-foreground">Your reflection history</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4 relative z-10">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            </div>
          ) : pastRecaps.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-muted/30 flex items-center justify-center">
                <Calendar className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">No recaps yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Complete check-ins and reflections to build your recap history.
                  <br />
                  Your first recap will appear next Sunday!
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {pastRecaps.map((recap) => (
                <RecapCard
                  key={recap.id}
                  recap={recap}
                  onClick={() => openRecap(recap)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <WeeklyRecapModal />
    </PageTransition>
  );
};

export default Recaps;
