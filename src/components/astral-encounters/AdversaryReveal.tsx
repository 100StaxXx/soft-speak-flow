import { motion } from 'framer-motion';
import { Skull, Zap, Wind, Brain } from 'lucide-react';
import { Adversary, AdversaryTier } from '@/types/astralEncounters';
import { Button } from '@/components/ui/button';
import { formatDisplayLabel } from '@/lib/utils';

interface AdversaryRevealProps {
  adversary: Adversary;
  onBeginBattle: () => void;
}

const TIER_COLORS: Record<AdversaryTier, string> = {
  common: 'from-slate-500 to-slate-700',
  uncommon: 'from-emerald-500 to-emerald-700',
  rare: 'from-blue-500 to-blue-700',
  epic: 'from-purple-500 to-purple-700',
  legendary: 'from-amber-500 to-orange-600',
};

const TIER_GLOW: Record<AdversaryTier, string> = {
  common: 'shadow-slate-500/30',
  uncommon: 'shadow-emerald-500/30',
  rare: 'shadow-blue-500/30',
  epic: 'shadow-purple-500/40',
  legendary: 'shadow-amber-500/50',
};

const MINIGAME_ICONS: Record<string, typeof Skull> = {
  energy_beam: Zap,
  tap_sequence: Brain,
  astral_frequency: Wind,
  eclipse_timing: Skull,
  starfall_dodge: Skull,
  soul_serpent: Skull,
  orb_match: Brain,
  galactic_match: Brain,
};

export const AdversaryReveal = ({ adversary, onBeginBattle }: AdversaryRevealProps) => {
  const Icon = MINIGAME_ICONS[adversary.miniGameType] || Skull;

  return (
    <div className="flex flex-col items-center gap-6 p-6 text-center">
      {/* Adversary silhouette */}
      <motion.div
        className={`relative w-40 h-40 rounded-full bg-gradient-to-br ${TIER_COLORS[adversary.tier]} flex items-center justify-center shadow-2xl ${TIER_GLOW[adversary.tier]}`}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', duration: 0.8 }}
      >
        {/* Pulsing glow effect */}
        <motion.div
          className={`absolute inset-0 rounded-full bg-gradient-to-br ${TIER_COLORS[adversary.tier]} opacity-50`}
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
          transition={{ repeat: Infinity, duration: 2 }}
        />
        
        {/* Silhouette icon */}
        <Icon className="w-20 h-20 text-white/80" />

        {/* Tier badge */}
        <div className={`absolute -bottom-2 px-3 py-1 rounded-full text-xs font-bold uppercase bg-background border border-border`}>
          {formatDisplayLabel(adversary.tier)}
        </div>
      </motion.div>

      {/* Name */}
      <motion.h2
        className="text-2xl font-bold text-foreground"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {adversary.name}
      </motion.h2>

      {/* Lore */}
      <motion.p
        className="text-sm text-muted-foreground max-w-xs italic"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        "{adversary.lore}"
      </motion.p>

      {/* Stats preview */}
      <motion.div
        className="flex gap-6 text-sm"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        <div className="text-center">
          <p className="text-muted-foreground">Phases</p>
          <p className="font-bold text-primary">{adversary.phases}</p>
        </div>
        <div className="text-center">
          <p className="text-muted-foreground">Essence</p>
          <p className="font-bold text-primary">{formatDisplayLabel(adversary.statType)}</p>
        </div>
        <div className="text-center">
          <p className="text-muted-foreground">Boost</p>
          <p className="font-bold text-primary">+{adversary.statBoost}</p>
        </div>
      </motion.div>

      {/* Begin button */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.9 }}
      >
        <Button
          onClick={onBeginBattle}
          size="lg"
          className="px-8 bg-gradient-to-r from-primary to-accent hover:opacity-90"
        >
          <Zap className="w-5 h-5 mr-2" />
          Begin Harmonization
        </Button>
      </motion.div>
    </div>
  );
};
