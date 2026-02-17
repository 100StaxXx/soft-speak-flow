import { Button } from "@/components/ui/button";
import { Mail, Star, BookOpen, Sparkles, X } from "lucide-react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface PostcardsTutorialModalProps {
  open: boolean;
  onClose: () => void;
}

interface StoryPoint {
  icon: LucideIcon;
  title: string;
  description: string;
}

const storyPoints: StoryPoint[] = [
  {
    icon: Mail,
    title: "Letters from the Cosmos",
    description: "Your companion travels to mysterious places and sends you postcards!",
  },
  {
    icon: Star,
    title: "Chapter Milestones",
    description: "Special milestones unlock new chapters of your story.",
  },
  {
    icon: BookOpen,
    title: "An Unfolding Tale",
    description: "Each postcard reveals clues and prophecies in your journey.",
  },
  {
    icon: Sparkles,
    title: "Collect & Share",
    description: "View your growing collection and share your favorites!",
  },
];

export function PostcardsTutorialModal({ open, onClose }: PostcardsTutorialModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed left-0 right-0 z-[75] px-3 pointer-events-none"
      style={{ top: "calc(1rem + env(safe-area-inset-top, 0px))" }}
      data-testid="postcards-tutorial-floating-wrapper"
    >
      <motion.div
        role="dialog"
        aria-label="Your Companion's Journey"
        aria-modal="false"
        aria-live="polite"
        className="pointer-events-auto mx-auto max-w-sm rounded-3xl bg-gradient-to-br from-amber-950/90 via-background/95 to-orange-950/80 backdrop-blur-2xl border border-amber-500/20 shadow-2xl shadow-amber-900/30 p-0 overflow-hidden"
      >
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ 
            type: "spring", 
            damping: 25, 
            stiffness: 300 
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Hide tutorial"
            className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-amber-200/80 hover:text-amber-100 hover:bg-amber-500/20 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Floating sparkles decoration */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[
              { top: "1rem", right: "2rem", size: "0.5rem", delay: 0 },
              { top: "3rem", left: "3rem", size: "0.375rem", delay: 1 },
              { bottom: "5rem", right: "4rem", size: "0.5rem", delay: 0.5 },
            ].map((spark, i) => (
              <motion.div
                key={i}
                animate={{ 
                  y: [0, -10, 0],
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: "easeInOut", delay: spark.delay }}
                className="absolute bg-amber-400 rounded-full blur-sm"
                style={{ 
                  top: spark.top, 
                  right: spark.right, 
                  left: spark.left, 
                  bottom: spark.bottom,
                  width: spark.size, 
                  height: spark.size 
                }}
              />
            ))}
          </div>

          {/* Hero section */}
          <div className="pt-8 pb-4 flex flex-col items-center relative">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", damping: 15 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-amber-500/30 rounded-full blur-2xl scale-150" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-600/20 flex items-center justify-center border border-amber-500/20 shadow-lg shadow-amber-500/20">
                <Mail className="w-8 h-8 text-amber-400" />
              </div>
            </motion.div>
            
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-5 text-xl font-semibold tracking-tight bg-gradient-to-r from-amber-300 via-orange-300 to-yellow-300 bg-clip-text text-transparent"
            >
              Your Companion's Journey
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-2 text-sm text-amber-200/60 text-center px-6 leading-relaxed"
            >
              Discover the magic of cosmic postcards
            </motion.p>
          </div>

          {/* Feature list */}
          <div className="px-5 pb-4">
            <div className="rounded-2xl bg-amber-500/5 backdrop-blur-sm divide-y divide-amber-500/10 overflow-hidden border border-amber-500/10">
              {storyPoints.map((point, i) => {
                const PointIcon = point.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.05 }}
                    className="flex items-start gap-3 px-4 py-3.5"
                  >
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <PointIcon className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-amber-200/90 mb-0.5">
                        {point.title}
                      </h4>
                      <p className="text-xs text-amber-200/50 leading-relaxed">
                        {point.description}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* CTA Button */}
          <div className="px-5 pb-6 pt-2">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Button
                onClick={onClose}
                className="w-full h-12 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium text-base shadow-lg shadow-amber-500/25 transition-all duration-200 active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Begin My Journey
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
