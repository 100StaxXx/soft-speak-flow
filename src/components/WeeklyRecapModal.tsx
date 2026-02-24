import { useRef } from "react";
import { X, Share2, Calendar, Sparkles, TrendingUp, TrendingDown, Minus, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { useWeeklyRecap } from "@/hooks/useWeeklyRecap";
import { useMentorPersonality } from "@/hooks/useMentorPersonality";
import { downloadImage } from "@/utils/imageDownload";
import { toPng } from "html-to-image";

const TrendBadge = ({ trend }: { trend: string }) => {
  const config = {
    improving: { icon: TrendingUp, label: "Rising Week", className: "text-emerald-300 bg-emerald-500/20 border-emerald-400/30" },
    declining: { icon: TrendingDown, label: "Reflective Week", className: "text-amber-300 bg-amber-500/20 border-amber-400/30" },
    stable: { icon: Minus, label: "Steady Week", className: "text-sky-300 bg-sky-500/20 border-sky-400/30" },
  };
  const { icon: Icon, label, className } = config[trend as keyof typeof config] || config.stable;
  
  return (
    <motion.span 
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3 }}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-sm ${className}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </motion.span>
  );
};

const StatPill = ({ value, label, color }: { value: number; label: string; color: string }) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center gap-0.5"
  >
    <span className={`text-lg font-bold ${color}`}>{value}</span>
    <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">{label}</span>
  </motion.div>
);

export const WeeklyRecapModal = () => {
  const { isModalOpen, selectedRecap, closeRecap } = useWeeklyRecap();
  const mentor = useMentorPersonality();
  const cardRef = useRef<HTMLDivElement>(null);

  if (!selectedRecap) return null;

  const startDate = parseISO(selectedRecap.week_start_date);
  const endDate = parseISO(selectedRecap.week_end_date);
  const dateRange = `${format(startDate, "MMMM d")} – ${format(endDate, "d, yyyy")}`;

  const storyContent = selectedRecap.mentor_insight || selectedRecap.mentor_story;
  const paragraphs = storyContent?.split(/\n{2,}/).filter(p => p.trim()) || [];

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

  const handleClose = () => {
    closeRecap();
  };

  return (
    <AnimatePresence>
      {isModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-20"
          onClick={handleClose}
        >
          {/* Backdrop with animated gradient */}
          <motion.div 
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
          
          {/* Ambient glow effects */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div 
              className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl"
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div 
              className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"
              animate={{ 
                scale: [1.2, 1, 1.2],
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 4 }}
            />
          </div>

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 40 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg max-h-[75dvh] flex flex-col rounded-3xl overflow-hidden"
          >
            {/* Glass card background */}
            <div className="absolute inset-0 bg-gradient-to-b from-background/95 via-background/90 to-background/95 backdrop-blur-xl border border-white/10 rounded-3xl" />
            
            {/* Decorative top accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />

            {/* Header */}
            <div className="relative flex items-center justify-between px-6 py-5">
              <motion.div 
                className="flex items-center gap-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="relative">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                    <BookOpen className="h-6 w-6 text-white" />
                  </div>
                  <motion.div 
                    className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Sparkles className="h-2.5 w-2.5 text-white" />
                  </motion.div>
                </div>
                <div>
                  <h2 className="font-semibold text-lg text-foreground">
                    {mentor?.name || "Your Mentor"} Reflects
                  </h2>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{dateRange}</span>
                  </div>
                </div>
              </motion.div>
              
              <motion.div 
                className="flex items-center gap-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Button variant="ghost" size="icon" onClick={handleShare} className="rounded-xl hover:bg-white/5">
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleClose} className="rounded-xl hover:bg-white/5">
                  <X className="h-4 w-4" />
                </Button>
              </motion.div>
            </div>

            {/* Story Content */}
            <div
              className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain"
              style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
            >
              <div ref={cardRef} className="px-4 pb-6 space-y-6">
                {/* Trend Badge */}
                <div className="flex items-center justify-center pt-2">
                  <TrendBadge trend={selectedRecap.mood_data.trend} />
                </div>

                {/* The Story */}
                {paragraphs.length > 0 ? (
                  <div className="space-y-5">
                    {paragraphs.map((paragraph, i) => (
                      <motion.p 
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 + (i * 0.1), duration: 0.5 }}
                        className="text-[15px] leading-[1.65] text-foreground/90"
                      >
                        {paragraph}
                      </motion.p>
                    ))}
                  </div>
                ) : (
                  <motion.div 
                    className="text-center py-12"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted/30 mb-4">
                      <BookOpen className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-muted-foreground">
                      No story available for this week yet.
                    </p>
                  </motion.div>
                )}

                {/* Decorative divider */}
                <motion.div 
                  className="flex items-center justify-center gap-3 py-4"
                  initial={{ opacity: 0, scaleX: 0 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                  <Sparkles className="h-3 w-3 text-amber-400/50" />
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                </motion.div>

                {/* Stats Row */}
                <motion.div 
                  className="flex items-center justify-around py-4 px-2 rounded-2xl bg-white/[0.02] border border-white/5"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 }}
                >
                  <StatPill value={selectedRecap.stats.checkIns} label="Check-ins" color="text-sky-400" />
                  <div className="w-px h-8 bg-border/30" />
                  <StatPill value={selectedRecap.stats.reflections} label="Reflections" color="text-violet-400" />
                  <div className="w-px h-8 bg-border/30" />
                  <StatPill value={selectedRecap.stats.quests} label="Quests" color="text-emerald-400" />
                  <div className="w-px h-8 bg-border/30" />
                  <StatPill value={selectedRecap.stats.habits} label="Habits" color="text-amber-400" />
                </motion.div>

                {/* Branding */}
                <motion.div 
                  className="text-center pt-2 pb-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                >
                  <p className="text-[10px] text-muted-foreground/40 tracking-widest uppercase">
                    Cosmiq Weekly Journal
                  </p>
                </motion.div>
              </div>
            </div>

            {/* Footer */}
            <div className="relative px-6 py-5 pb-6 border-t border-white/5">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Button 
                  onClick={handleClose} 
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-400 hover:via-orange-400 hover:to-rose-400 text-white font-medium shadow-lg shadow-orange-500/20 transition-all duration-300 hover:shadow-orange-500/30 hover:scale-[1.02]"
                >
                  Continue Your Journey
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
