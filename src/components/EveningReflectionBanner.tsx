import { memo } from "react";
import { Moon, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useEveningReflection } from "@/hooks/useEveningReflection";
import { EveningReflectionDrawer } from "./EveningReflectionDrawer";

export const EveningReflectionBanner = memo(() => {
  const { shouldShowBanner, isDrawerOpen, setIsDrawerOpen } = useEveningReflection();

  if (!shouldShowBanner) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-4"
      >
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="relative w-full p-4 rounded-2xl bg-gradient-to-r from-indigo-600/30 via-purple-600/30 to-pink-600/30 border border-purple-500/40 backdrop-blur-sm hover:border-purple-400/60 hover:shadow-lg hover:shadow-purple-500/20 transition-all duration-300 group overflow-hidden"
        >
          {/* Animated shimmer sweep */}
          <div className="absolute inset-0 overflow-hidden rounded-2xl">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer-sweep_3s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
          </div>
          
          {/* Subtle star particles */}
          <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
            <motion.div
              animate={{ 
                opacity: [0.3, 0.7, 0.3],
                scale: [0.8, 1.1, 0.8]
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-2 right-8"
            >
              <Sparkles className="h-3 w-3 text-purple-300/60" />
            </motion.div>
            <motion.div
              animate={{ 
                opacity: [0.5, 0.9, 0.5],
                scale: [1, 1.2, 1]
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              className="absolute bottom-3 right-16"
            >
              <Sparkles className="h-2 w-2 text-pink-300/50" />
            </motion.div>
          </div>
          
          {/* Glow effect on hover */}
          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10" />
          
          <div className="relative flex items-center gap-3">
            {/* Animated moon icon */}
            <motion.div 
              className="p-2.5 rounded-full bg-gradient-to-br from-purple-500/30 to-indigo-500/30 border border-purple-400/30 group-hover:border-purple-300/50 transition-all duration-300"
              animate={{ 
                boxShadow: [
                  "0 0 0 0 rgba(168, 85, 247, 0)",
                  "0 0 15px 2px rgba(168, 85, 247, 0.3)",
                  "0 0 0 0 rgba(168, 85, 247, 0)"
                ]
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Moon className="h-5 w-5 text-purple-200 group-hover:text-purple-100 transition-colors" />
            </motion.div>
            
            <div className="flex-1 text-left">
              <p className="font-semibold text-foreground group-hover:text-white transition-colors">
                Evening Reflection
              </p>
              <p className="text-sm text-muted-foreground group-hover:text-purple-200/80 transition-colors">
                How was your day? ✨
              </p>
            </div>
            
            {/* Animated XP badge */}
            <motion.div 
              className="text-xs px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/30 to-purple-500/30 text-primary font-bold border border-primary/30 group-hover:border-primary/50 transition-all"
              animate={{ 
                scale: [1, 1.05, 1]
              }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              +3 XP
            </motion.div>
          </div>
        </button>
      </motion.div>

      <EveningReflectionDrawer 
        open={isDrawerOpen} 
        onOpenChange={setIsDrawerOpen} 
      />
    </>
  );
});

EveningReflectionBanner.displayName = 'EveningReflectionBanner';
