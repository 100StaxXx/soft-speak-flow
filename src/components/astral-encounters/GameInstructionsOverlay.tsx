import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  Zap, 
  Circle, 
  Wind, 
  ArrowRight, 
  Star, 
  Shield, 
  Scale,
  Brain,
  Heart,
  Sparkles
} from "lucide-react";
import { MiniGameType } from "@/types/astralEncounters";

interface GameInstructionsOverlayProps {
  gameType: MiniGameType;
  onReady: () => void;
}

interface GameInstruction {
  icon: React.ElementType;
  title: string;
  goal: string;
  howToPlay: string[];
  statBonus: 'mind' | 'body' | 'soul';
  statIcon: React.ElementType;
}

const GAME_INSTRUCTIONS: Record<MiniGameType, GameInstruction> = {
  energy_beam: {
    icon: Zap,
    title: "Energy Beam",
    goal: "Release your energy at the perfect moment!",
    howToPlay: [
      "Hold the button to charge your beam",
      "Watch for the glowing sweet spot zone",
      "Release when the charge is in the zone"
    ],
    statBonus: 'body',
    statIcon: Heart,
  },
  tap_sequence: {
    icon: Circle,
    title: "Cosmic Tap Sequence",
    goal: "Memorize and tap the orbs in order!",
    howToPlay: [
      "Watch the orbs light up in sequence",
      "Remember the order they appear",
      "Tap them in the same order"
    ],
    statBonus: 'mind',
    statIcon: Brain,
  },
  breath_sync: {
    icon: Wind,
    title: "Breath Sync",
    goal: "Match your breathing to the cosmic rhythm!",
    howToPlay: [
      "Watch the breathing circle expand and contract",
      "Hold when the circle expands (inhale)",
      "Release when it shrinks (exhale)"
    ],
    statBonus: 'soul',
    statIcon: Sparkles,
  },
  quick_swipe: {
    icon: ArrowRight,
    title: "Quick Swipe",
    goal: "Block incoming attacks with quick reflexes!",
    howToPlay: [
      "Watch for incoming attack indicators",
      "Swipe in the matching direction quickly",
      "Chain successful blocks for bonus points"
    ],
    statBonus: 'body',
    statIcon: Heart,
  },
  constellation_trace: {
    icon: Star,
    title: "Constellation Trace",
    goal: "Connect the stars before they fade!",
    howToPlay: [
      "Stars appear with numbers showing order",
      "Tap each star in the correct sequence",
      "Complete the constellation before time runs out"
    ],
    statBonus: 'soul',
    statIcon: Sparkles,
  },
  shield_barrier: {
    icon: Shield,
    title: "Shield Barrier",
    goal: "Protect your core from all directions!",
    howToPlay: [
      "Attacks come from four directions",
      "Tap the shield quadrant matching the attack",
      "React quickly to block each strike"
    ],
    statBonus: 'body',
    statIcon: Heart,
  },
  gravity_balance: {
    icon: Scale,
    title: "Gravity Balance",
    goal: "Keep the cosmic orb centered!",
    howToPlay: [
      "Gravity shifts pull the orb around",
      "Tap opposite to the pull direction",
      "Keep the orb in the safe zone"
    ],
    statBonus: 'mind',
    statIcon: Brain,
  },
};

const STAT_COLORS = {
  mind: 'hsl(217, 91%, 60%)',
  body: 'hsl(0, 84%, 60%)',
  soul: 'hsl(271, 91%, 65%)',
};

export const GameInstructionsOverlay = ({ gameType, onReady }: GameInstructionsOverlayProps) => {
  const instruction = GAME_INSTRUCTIONS[gameType];
  const Icon = instruction.icon;
  const StatIcon = instruction.statIcon;
  const statColor = STAT_COLORS[instruction.statBonus];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-6 flex flex-col items-center"
    >
      {/* Animated icon */}
      <motion.div
        className="relative mb-6"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
      >
        <motion.div
          className="absolute inset-0 rounded-full blur-xl opacity-50"
          style={{ backgroundColor: statColor }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <div 
          className="relative p-5 rounded-full"
          style={{ 
            background: `linear-gradient(135deg, ${statColor}40, ${statColor}20)`,
            border: `2px solid ${statColor}60`
          }}
        >
          <Icon 
            className="w-12 h-12" 
            style={{ color: statColor, filter: `drop-shadow(0 0 8px ${statColor})` }}
          />
        </div>
      </motion.div>

      {/* Title */}
      <motion.h3
        className="text-2xl font-bold text-foreground mb-2 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {instruction.title}
      </motion.h3>

      {/* Goal */}
      <motion.p
        className="text-muted-foreground text-center mb-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {instruction.goal}
      </motion.p>

      {/* How to Play */}
      <motion.div
        className="w-full max-w-xs space-y-3 mb-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide text-center">
          How to Play
        </h4>
        <div className="space-y-2">
          {instruction.howToPlay.map((step, index) => (
            <motion.div
              key={index}
              className="flex items-start gap-3 text-sm text-muted-foreground"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.1 }}
            >
              <span 
                className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: statColor }}
              >
                {index + 1}
              </span>
              <span>{step}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Stat bonus indicator */}
      <motion.div
        className="flex items-center gap-2 mb-6 px-4 py-2 rounded-full"
        style={{ 
          backgroundColor: `${statColor}15`,
          border: `1px solid ${statColor}30`
        }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
      >
        <StatIcon className="w-4 h-4" style={{ color: statColor }} />
        <span className="text-sm font-medium capitalize" style={{ color: statColor }}>
          {instruction.statBonus} Stat Bonus
        </span>
      </motion.div>

      {/* Ready button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Button
          onClick={onReady}
          size="lg"
          className="px-8 font-bold"
          style={{
            background: `linear-gradient(135deg, ${statColor}, ${statColor}cc)`,
            boxShadow: `0 0 20px ${statColor}50`
          }}
        >
          <motion.span
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            Ready!
          </motion.span>
        </Button>
      </motion.div>
    </motion.div>
  );
};
