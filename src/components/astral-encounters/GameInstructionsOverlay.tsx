import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  Zap, 
  Circle, 
  Rocket,
  Sparkles,
  Music,
  Brain,
  Heart,
  Grid3X3,
  Target,
  Layers,
  Smartphone,
  LayoutGrid,
  type LucideIcon
} from "lucide-react";
import { MiniGameType } from "@/types/astralEncounters";

interface GameInstructionsOverlayProps {
  gameType: MiniGameType;
  onReady: () => void;
}

interface GameInstruction {
  icon: LucideIcon;
  title: string;
  goal: string;
  howToPlay: string[];
  statBonus: 'mind' | 'body' | 'soul';
  statIcon: LucideIcon;
}

const GAME_INSTRUCTIONS: Record<MiniGameType, GameInstruction> = {
  energy_beam: {
    icon: Zap,
    title: "Star Defender",
    goal: "Survive endless alien waves!",
    howToPlay: [
      "Move left/right to dodge attacks",
      "Auto-fire destroys enemies",
      "3 lives - survive as long as possible",
      "Waves get harder - how far can you go?"
    ],
    statBonus: 'body',
    statIcon: Heart,
  },
  tap_sequence: {
    icon: Circle,
    title: "Memory Sequence",
    goal: "How far can your memory take you?",
    howToPlay: [
      "Watch orbs light up in sequence",
      "Numbers hide - tap from memory!",
      "Wrong tap = lose a life, sequence replays",
      "3 lives total - survive endless levels!"
    ],
    statBonus: 'mind',
    statIcon: Brain,
  },
  astral_frequency: {
    icon: Rocket,
    title: "Cosmiq Dash",
    goal: "Survive the endless cosmic tunnel!",
    howToPlay: [
      "Swipe or tap ◀ ▶ to switch lanes",
      "🔴 RED ASTEROIDS = DANGER! Lose a life",
      "🟡 GOLD CRYSTALS = Points! Collect them",
      "🔵 CYAN SHIELDS = Protection for 1 hit",
      "Speed increases - survive as long as you can!"
    ],
    statBonus: 'soul',
    statIcon: Sparkles,
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
    statBonus: 'soul',
    statIcon: Sparkles,
  },
  starfall_dodge: {
    icon: Smartphone,
    title: "Starfall Dodge",
    goal: "Survive the endless starfall!",
    howToPlay: [
      "📱 Tilt or swipe to dodge debris",
      "3 lives - debris hits cost one!",
      "Collect 💎 crystals for bonus points",
      "Speed increases - how long can you last?"
    ],
    statBonus: 'body',
    statIcon: Heart,
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
    title: "Starburst",
    goal: "Match orbs before time runs out!",
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
    goal: "Memorize cards, match pairs, survive endless levels!",
    howToPlay: [
      "All cards revealed at start - MEMORIZE!",
      "Cards hide - match pairs from memory",
      "Wrong match = lose a life (3 total)",
      "Clear level → more cards next level!"
    ],
    statBonus: 'mind',
    statIcon: Brain,
  },
  cosmiq_grid: {
    icon: LayoutGrid,
    title: "Cosmiq Grid",
    goal: "Fill the grid with numbers 1-4!",
    howToPlay: [
      "Each row must have 1, 2, 3, 4",
      "Each column must have 1, 2, 3, 4",
      "Each 2×2 box must have 1, 2, 3, 4",
      "Tap a cell, then tap a number to place"
    ],
    statBonus: 'mind',
    statIcon: Brain,
  },
  stellar_flow: {
    icon: Target,
    title: "Pathfinder",
    goal: "Connect matching orbs with flowing paths!",
    howToPlay: [
      "Drag from one orb to its matching pair",
      "Paths cannot cross each other",
      "Fill every cell to complete the puzzle",
      "Faster times = higher scores!"
    ],
    statBonus: 'soul',
    statIcon: Sparkles,
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
