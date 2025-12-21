import { useRef, useState } from "react";
import { X, Share2, Volume2, VolumeX, Calendar, Sparkles, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { useWeeklyRecap } from "@/hooks/useWeeklyRecap";
import { useMentorPersonality } from "@/hooks/useMentorPersonality";
import { downloadImage } from "@/utils/imageDownload";
import { toPng } from "html-to-image";
import { ScrollArea } from "@/components/ui/scroll-area";

const TrendBadge = ({ trend }: { trend: string }) => {
  const config = {
    improving: { icon: TrendingUp, label: "Rising", className: "text-green-400 bg-green-500/10 border-green-500/20" },
    declining: { icon: TrendingDown, label: "Challenging", className: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
    stable: { icon: Minus, label: "Steady", className: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  };
  const { icon: Icon, label, className } = config[trend as keyof typeof config] || config.stable;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${className}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
};

export const WeeklyRecapModal = () => {
  const { isModalOpen, selectedRecap, closeRecap } = useWeeklyRecap();
  const mentor = useMentorPersonality();
  const cardRef = useRef<HTMLDivElement>(null);
  const [isReading, setIsReading] = useState(false);

  if (!selectedRecap) return null;

  const startDate = parseISO(selectedRecap.week_start_date);
  const endDate = parseISO(selectedRecap.week_end_date);
  const dateRange = `${format(startDate, "MMMM d")} – ${format(endDate, "d, yyyy")}`;

  // Use mentor_story if available, fall back to mentor_insight
  const storyContent = selectedRecap.mentor_story || selectedRecap.mentor_insight;

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

  const handleReadAloud = () => {
    if (!storyContent) return;
    
    if (isReading) {
      window.speechSynthesis.cancel();
      setIsReading(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(storyContent);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.onend = () => setIsReading(false);
    utterance.onerror = () => setIsReading(false);
    
    window.speechSynthesis.speak(utterance);
    setIsReading(true);
  };

  const handleClose = () => {
    window.speechSynthesis.cancel();
    setIsReading(false);
    closeRecap();
  };

  return (
    <AnimatePresence>
      {isModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-background border border-border/50 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/30 bg-background/95 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">
                    {mentor?.name || "Your Mentor"} Reflects
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{dateRange}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {storyContent && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleReadAloud}
                    className={isReading ? "text-amber-400" : ""}
                  >
                    {isReading ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={handleShare}>
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Story Content */}
            <ScrollArea className="flex-1 min-h-0">
              <div ref={cardRef} className="p-6 space-y-6 bg-background">
                {/* Trend Badge */}
                <div className="flex items-center justify-center">
                  <TrendBadge trend={selectedRecap.mood_data.trend} />
                </div>

                {/* The Story */}
                {storyContent ? (
                  <div className="space-y-4">
                    <article className="prose prose-invert prose-sm max-w-none">
                      {storyContent.split('\n\n').map((paragraph, i) => (
                        <p 
                          key={i} 
                          className="text-foreground/90 leading-relaxed text-[15px] first:first-letter:text-2xl first:first-letter:font-bold first:first-letter:text-amber-400 first:first-letter:mr-1"
                        >
                          {paragraph}
                        </p>
                      ))}
                    </article>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      No story available for this week.
                    </p>
                  </div>
                )}

                {/* Compact Stats Footer */}
                <div className="pt-4 border-t border-border/30">
                  <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="text-blue-400 font-medium">{selectedRecap.stats.checkIns}</span>
                      check-ins
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-purple-400 font-medium">{selectedRecap.stats.reflections}</span>
                      reflections
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-green-400 font-medium">{selectedRecap.stats.quests}</span>
                      quests
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-amber-400 font-medium">{selectedRecap.stats.habits}</span>
                      habits
                    </span>
                  </div>
                </div>

                {/* Branding */}
                <div className="text-center pt-2">
                  <p className="text-[10px] text-muted-foreground/50">
                    ✨ Cosmiq Weekly Recap
                  </p>
                </div>
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border/30 bg-background/95 backdrop-blur-sm">
              <Button onClick={handleClose} className="w-full">
                Continue Your Journey
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
