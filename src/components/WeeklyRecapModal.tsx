import { useRef } from "react";
import { BookHeart, Calendar, Minus, Share2, Sparkles, TrendingDown, TrendingUp, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { toPng } from "html-to-image";

import { Button } from "@/components/ui/button";
import { PRODUCT } from "@/config/product";
import { useWeeklyRecap } from "@/hooks/useWeeklyRecap";
import { downloadImage } from "@/utils/imageDownload";

const TrendBadge = ({ trend, isCosmiq }: { trend: string; isCosmiq: boolean }) => {
  const config = isCosmiq ? {
    improving: { icon: TrendingUp, label: "Rising week" },
    declining: { icon: TrendingDown, label: "Reflective week" },
    stable: { icon: Minus, label: "Steady week" },
  } : {
    improving: { icon: TrendingUp, label: "A strengthening week" },
    declining: { icon: TrendingDown, label: "A tender week" },
    stable: { icon: Minus, label: "A steady week" },
  };
  const { icon: Icon, label } = config[trend as keyof typeof config] ?? config.stable;

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.07] px-3 py-1 text-xs font-medium text-primary">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
};

const Stat = ({ value, label }: { value: number; label: string }) => (
  <div className="text-center">
    <p className="text-xl font-semibold text-foreground">{value}</p>
    <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
  </div>
);

export const WeeklyRecapModal = () => {
  const { isModalOpen, selectedRecap, closeRecap } = useWeeklyRecap();
  const cardRef = useRef<HTMLDivElement>(null);

  if (!selectedRecap) return null;

  const startDate = parseISO(selectedRecap.week_start_date);
  const endDate = parseISO(selectedRecap.week_end_date);
  const dateRange = `${format(startDate, "MMMM d")} – ${format(endDate, "d, yyyy")}`;
  const reviewText = selectedRecap.mentor_story?.trim() || selectedRecap.mentor_insight?.trim();
  const paragraphs = reviewText?.split(/\n{2,}/).filter((paragraph) => paragraph.trim()) ?? [];
  const practices = selectedRecap.stats.quests + selectedRecap.stats.habits;
  const isCosmiq = PRODUCT.mode === "cosmiq";

  const handleShare = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 0.95,
        backgroundColor: isCosmiq ? "#0a0a0f" : "#f1f0e7",
      });
      await downloadImage(
        dataUrl,
        `${isCosmiq ? "cosmiq-recap" : "graceward-review"}-${selectedRecap.week_start_date}.png`,
      );
    } catch (error) {
      console.error("Failed to share weekly review:", error);
    }
  };

  return (
    <AnimatePresence>
      {isModalOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={isCosmiq
            ? "fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 pb-20 backdrop-blur-md"
            : "fixed inset-0 z-50 flex items-center justify-center bg-[#17271b]/70 p-4 pb-20 backdrop-blur-md"}
          onClick={closeRecap}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            onClick={(event) => event.stopPropagation()}
            className={isCosmiq
              ? "relative flex max-h-[78dvh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#0a0a0f] text-white shadow-[0_24px_100px_rgba(139,92,246,0.22)]"
              : "relative flex max-h-[78dvh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] border border-white/70 bg-[#f1f0e7] text-[#203124] shadow-2xl"}
          >
            {isCosmiq ? (
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(245,158,11,0.12),transparent_32%),radial-gradient(circle_at_88%_28%,rgba(139,92,246,0.18),transparent_38%)]" />
            ) : null}
            <div className={isCosmiq
              ? "relative flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6"
              : "flex items-center justify-between border-b border-[#203124]/10 px-5 py-4 sm:px-6"}>
              <div className="flex items-center gap-3">
                <span className={isCosmiq
                  ? "relative rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 p-3 text-white shadow-lg shadow-orange-500/20"
                  : "rounded-2xl bg-[#496f4c]/10 p-3 text-[#496f4c]"}>
                  <BookHeart className="h-5 w-5" />
                  {isCosmiq ? <Sparkles className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-violet-500 p-0.5 text-white" /> : null}
                </span>
                <div>
                  <h2 className={isCosmiq ? "text-xl font-semibold" : "font-serif text-xl font-semibold"}>
                    {isCosmiq ? "Weekly journal" : "Weekly review"}
                  </h2>
                  <p className={isCosmiq
                    ? "mt-1 flex items-center gap-1.5 text-xs text-white/55"
                    : "mt-1 flex items-center gap-1.5 text-xs text-[#657067]"}>
                    <Calendar className="h-3.5 w-3.5" />{dateRange}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => void handleShare()} aria-label="Share weekly review"><Share2 className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={closeRecap} aria-label="Close weekly review"><X className="h-4 w-4" /></Button>
              </div>
            </div>

            <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div ref={cardRef} className={isCosmiq
                ? "space-y-6 bg-[#0a0a0f] px-5 py-6 text-white sm:px-7"
                : "space-y-6 bg-[#f1f0e7] px-5 py-6 sm:px-7"}>
                <div className="flex justify-center"><TrendBadge trend={selectedRecap.mood_data.trend} isCosmiq={isCosmiq} /></div>

                {paragraphs.length > 0 ? (
                  <div className="space-y-4">
                    {paragraphs.map((paragraph, index) => (
                      <p key={`${index}-${paragraph.slice(0, 20)}`} className={isCosmiq ? "leading-7 text-white/85" : "leading-7 text-[#38463b]"}>{paragraph}</p>
                    ))}
                  </div>
                ) : (
                  <div className={isCosmiq
                    ? "rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm leading-6 text-white/55"
                    : "rounded-2xl border border-dashed border-[#203124]/15 p-6 text-center text-sm leading-6 text-[#657067]"}>
                    {isCosmiq
                      ? "Your weekly story is still taking shape. Keep showing up."
                      : "Your review does not have a written reflection yet. The record of showing up still matters."}
                  </div>
                )}

                <div className={isCosmiq
                  ? "grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-4"
                  : "grid grid-cols-3 gap-2 rounded-2xl border border-[#203124]/10 bg-white/45 p-4"}>
                  <Stat value={selectedRecap.stats.checkIns} label="Check-ins" />
                  <Stat value={selectedRecap.stats.reflections} label="Reflections" />
                  <Stat value={practices} label={isCosmiq ? "Quests + habits" : "Practices"} />
                </div>

                <p className={isCosmiq
                  ? "text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35"
                  : "text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-[#657067]"}>
                  {PRODUCT.name} · {isCosmiq ? "weekly journal" : "weekly review"}
                </p>
              </div>
            </div>

            <div className={isCosmiq ? "relative border-t border-white/10 p-5" : "border-t border-[#203124]/10 p-5"}>
              <Button
                onClick={closeRecap}
                className={isCosmiq
                  ? "h-12 w-full rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/20 hover:from-violet-500 hover:via-purple-500 hover:to-fuchsia-500"
                  : "h-12 w-full rounded-xl bg-[#2f5938] text-white hover:bg-[#24482d]"}
              >
                {isCosmiq ? "Continue your journey" : "Return to the day"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
