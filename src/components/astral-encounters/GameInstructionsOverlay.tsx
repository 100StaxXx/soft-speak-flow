import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  Zap, 
  Circle, 
  Rocket,
  Moon,
  Sparkles,
  Music,
  Brain,
  Heart,
  Grid3X3,
  Target,
  Layers
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
    title: "Star Defender",
    goal: "Destroy the alien fleet before they reach you!",
    howToPlay: [
      "Move left/right to dodge attacks",
      "Auto-fire destroys enemies",
      "Collect power-ups for shields & bonuses",
      "Clear all waves to win"
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
  astral_frequency: {
    icon: Rocket,
    title: "Cosmic Dash",
    goal: "Dash through the cosmic tunnel! Collect stardust, avoid obstacles!",
    howToPlay: [
      "Swipe or tap arrows to switch lanes",
      "Collect ✨ stardust for points",
      "Grab 🛡️ shields for protection",
      "Speed increases - stay alert!"
    ],
    statBonus: 'mind',
    statIcon: Brain,
  },
  eclipse_timing: {
    icon: Music,
    title: "Stellar Beats",
    goal: "Hit the notes in rhythm as they fall!",
    howToPlay: [
      "Watch notes scroll down the 3 lanes",
      "Tap the lane when notes reach the glowing line",
      "Chain combos for multiplied points!"
    ],
    statBonus: 'body',
    statIcon: Heart,
  },
  starfall_dodge: {
    icon: Sparkles,
    title: "Starfall Dodge",
    goal: "Dodge debris and collect crystals!",
    howToPlay: [
      "Move left and right to dodge falling debris",
      "Collect glowing crystals for points",
      "Survive the 10-second starfall"
    ],
    statBonus: 'mind',
    statIcon: Brain,
  },
  rune_resonance: {
    icon: Music,
    title: "Rune Resonance",
    goal: "Tap runes at their peak brightness!",
    howToPlay: [
      "Each rune pulses at its own rhythm",
      "Tap when a rune glows brightest",
      "Activate all runes to complete"
    ],
    statBonus: 'soul',
    statIcon: Sparkles,
  },
  soul_serpent: {
    icon: Zap,
    title: "Soul Serpent",
    goal: "Guide the serpent and survive as long as possible!",
    howToPlay: [
      "Swipe or use D-Pad to change direction",
      "Collect glowing stardust to grow longer",
      "Game ends when you hit yourself!"
    ],
    statBonus: 'body',
    statIcon: Heart,
  },
  orb_match: {
    icon: Grid3X3,
    title: "Cosmic Orb Match",
    goal: "Drag orbs to create matches of 3 or more!",
    howToPlay: [
      "Touch and drag any orb across the grid",
      "Orbs swap positions as you pass through",
      "Match 3+ of the same color to score",
      "Chain combos for bonus points!"
    ],
    statBonus: 'soul',
    statIcon: Sparkles,
  },
  galactic_match: {
    icon: Layers,
    title: "Galactic Match",
    goal: "Find all matching cosmic pairs before time runs out!",
    howToPlay: [
      "Tap cards to flip and reveal symbols",
      "Remember card positions",
      "Match identical pairs to clear them",
      "Chain matches for combo bonus!"
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
