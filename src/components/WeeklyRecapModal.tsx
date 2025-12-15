import { useRef } from "react";
import { X, Share2, TrendingUp, TrendingDown, Minus, Calendar, CheckCircle2, Moon, Sparkles, Target, Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { useWeeklyRecap, WeeklyRecap } from "@/hooks/useWeeklyRecap";
import { useProfile } from "@/hooks/useProfile";
import { useMentorPersonality } from "@/hooks/useMentorPersonality";
import { downloadImage } from "@/utils/imageDownload";
import { toPng } from "html-to-image";

const MOOD_EMOJIS: Record<string, string> = {
  great: "😊",
  good: "🙂",
  okay: "😐",
  low: "😔",
  rough: "😢",
  energized: "⚡",
  calm: "😌",
  anxious: "😰",
  grateful: "🙏",
  motivated: "💪",
};

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

export const WeeklyRecapModal = () => {
  const { isModalOpen, selectedRecap, closeRecap } = useWeeklyRecap();
  const { profile } = useProfile();
  const mentor = useMentorPersonality();
  const cardRef = useRef<HTMLDivElement>(null);

  if (!selectedRecap) return null;

  const startDate = parseISO(selectedRecap.week_start_date);
  const endDate = parseISO(selectedRecap.week_end_date);
  const dateRange = `${format(startDate, "MMM d")} - ${format(endDate, "d, yyyy")}`;

  const handleShare = async () => {
    if (!cardRef.current) return;

    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 0.95,
        backgroundColor: "#0a0a0f",
      });
      await downloadImage(dataUrl, `cosmiq-recap-${selectedRecap.week_start_date}.png`);
    } catch (error) {
      console.error("Failed to share recap:", error);
    }
  };

  return (
    <AnimatePresence>
      {isModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={closeRecap}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-gradient-to-b from-background via-background to-background/95 border border-border/50 shadow-2xl"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-background/95 backdrop-blur-sm border-b border-border/30">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-400" />
                Your Week in Review
              </h2>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={handleShare}>
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={closeRecap}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div ref={cardRef} className="p-6 space-y-6 bg-gradient-to-b from-background to-background/95">
              {/* Date Range */}
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">{dateRange}</span>
                </div>
              </div>

              {/* Mood Journey */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Moon className="h-4 w-4 text-purple-400" />
                  Mood Journey
                </h3>
                <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
                  {/* Morning moods */}
                  {selectedRecap.mood_data.morning.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-muted-foreground mb-2">Mornings</p>
                      <div className="flex gap-2 flex-wrap">
                        {selectedRecap.mood_data.morning.map((m, i) => (
                          <div key={i} className="flex flex-col items-center">
                            <span className="text-xl">{MOOD_EMOJIS[m.mood] || "😊"}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {format(parseISO(m.date), "EEE")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Evening moods */}
                  {selectedRecap.mood_data.evening.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Evenings</p>
                      <div className="flex gap-2 flex-wrap">
                        {selectedRecap.mood_data.evening.map((m, i) => (
                          <div key={i} className="flex flex-col items-center">
                            <span className="text-xl">{MOOD_EMOJIS[m.mood] || "😊"}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {format(parseISO(m.date), "EEE")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Trend */}
                  <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-center gap-2">
                    <TrendIcon trend={selectedRecap.mood_data.trend} />
                    <span className="text-sm text-muted-foreground capitalize">
                      {selectedRecap.mood_data.trend} week
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-2">
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
                  <p className="text-2xl font-bold text-blue-400">{selectedRecap.stats.checkIns}</p>
                  <p className="text-[10px] text-muted-foreground">Check-ins</p>
                </div>
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
                  <p className="text-2xl font-bold text-purple-400">{selectedRecap.stats.reflections}</p>
                  <p className="text-[10px] text-muted-foreground">Reflections</p>
                </div>
                <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
                  <p className="text-2xl font-bold text-green-400">{selectedRecap.stats.quests}</p>
                  <p className="text-[10px] text-muted-foreground">Quests</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <p className="text-2xl font-bold text-amber-400">{selectedRecap.stats.habits}</p>
                  <p className="text-[10px] text-muted-foreground">Habits</p>
                </div>
              </div>

              {/* Gratitude Themes */}
              {selectedRecap.gratitude_themes.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Heart className="h-4 w-4 text-pink-400" />
                    Gratitude Highlights
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedRecap.gratitude_themes.map((theme, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-xs text-pink-300"
                      >
                        {theme}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Wins */}
              {selectedRecap.win_highlights.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Target className="h-4 w-4 text-green-400" />
                    Top Wins
                  </h3>
                  <div className="space-y-2">
                    {selectedRecap.win_highlights.slice(0, 3).map((win, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20"
                      >
                        <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-foreground/90">{win}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mentor Insight */}
              {selectedRecap.mentor_insight && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    {mentor?.name || "Your Mentor"}'s Insight
                  </h3>
                  <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-red-500/10 border border-amber-500/20">
                    <p className="text-sm text-foreground/90 italic leading-relaxed">
                      "{selectedRecap.mentor_insight}"
                    </p>
                  </div>
                </div>
              )}

              {/* Cosmiq Branding */}
              <div className="text-center pt-4 border-t border-border/30">
                <p className="text-xs text-muted-foreground">
                  ✨ Cosmiq Weekly Recap ✨
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 p-4 bg-background/95 backdrop-blur-sm border-t border-border/30">
              <Button onClick={closeRecap} className="w-full">
                Got it!
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};