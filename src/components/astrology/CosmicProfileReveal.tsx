import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Stars } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CosmicProfileRevealProps {
  onReveal: () => void;
  isRevealing: boolean;
}

export const CosmicProfileReveal = ({ onReveal, isRevealing }: CosmicProfileRevealProps) => {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="flex flex-col items-center justify-center min-h-[400px] space-y-8 p-8"
      >
        {/* Animated cosmic circle */}
        <motion.div
          animate={{
            rotate: 360,
            scale: [1, 1.1, 1],
          }}
          transition={{
            rotate: { duration: 20, repeat: Infinity, ease: "linear" },
            scale: { duration: 3, repeat: Infinity, ease: "easeInOut" },
          }}
          className="relative w-48 h-48"
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-blue-500/20 blur-2xl"></div>
          <div className="absolute inset-4 rounded-full bg-gradient-to-br from-purple-600/30 via-pink-600/30 to-blue-600/30 blur-xl"></div>
          <div className="absolute inset-8 rounded-full bg-obsidian border-2 border-accent-purple/50 flex items-center justify-center">
            <Stars className="w-16 h-16 text-accent-purple" />
          </div>
          
          {/* Orbiting particles */}
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-accent-purple rounded-full"
              style={{
                top: '50%',
                left: '50%',
              }}
              animate={{
                rotate: 360,
                x: [0, Math.cos((i * Math.PI * 2) / 8) * 80],
                y: [0, Math.sin((i * Math.PI * 2) / 8) * 80],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "linear",
                delay: i * 0.5,
              }}
            />
          ))}
        </motion.div>

        {/* Text content */}
        <div className="text-center space-y-4 max-w-md">
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex items-center justify-center gap-2"
          >
            <Sparkles className="w-5 h-5 text-accent-purple" />
            <h2 className="text-2xl font-bold text-pure-white">
              Reveal Your Cosmic Profile
            </h2>
            <Sparkles className="w-5 h-5 text-accent-purple" />
          </motion.div>
          
          <p className="text-cloud-white">
            Unlock the celestial map of your soul. Discover your Big Three and planetary placements that shape your journey through the cosmos.
          </p>
        </div>

        {/* Reveal button */}
        <Button
          onClick={onReveal}
          disabled={isRevealing}
          size="lg"
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-6 text-lg shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all"
        >
          {isRevealing ? (
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              Calculating the Stars...
            </motion.span>
          ) : (
            <>
              <Sparkles className="w-5 h-5 mr-2" />
              Reveal My Cosmic Profile
            </>
          )}
        </Button>

        {/* Mystical hint */}
        <p className="text-xs text-steel italic">
          ✨ The stars have been waiting for this moment
        </p>
      </motion.div>
    </AnimatePresence>
  );
};