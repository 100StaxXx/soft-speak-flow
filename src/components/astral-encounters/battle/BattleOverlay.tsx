import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BattleState } from '@/types/battleSystem';
import { BattleHPBar } from './BattleHPBar';
import { BossPortraitWidescreen } from './BossPortraitWidescreen';

interface BattleOverlayProps {
  battleState: BattleState;
  companionImageUrl?: string;
  companionName: string;
  adversaryImageUrl?: string;
  adversaryName: string;
  showScreenShake?: boolean;
}

export const BattleOverlay = memo(function BattleOverlay({
  battleState,
  adversaryImageUrl,
  adversaryName,
  showScreenShake = false,
}: BattleOverlayProps) {
  const isLowHP = battleState.playerHPPercent < 25;
  
  return (
    <motion.div
      className="relative"
      animate={showScreenShake ? {
        x: [0, -3, 3, -2, 2, 0],
        y: [0, 2, -2, 1, -1, 0],
      } : {}}
      transition={{ duration: 0.3 }}
    >
      {/* Red vignette for low player HP - warning effect */}
      <AnimatePresence>
        {isLowHP && !battleState.isPlayerDefeated && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.3, 0.5, 0.3] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 pointer-events-none z-40"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 40%, rgba(220,38,38,0.4) 100%)',
            }}
          />
        )}
      </AnimatePresence>
      
      {/* Boss Fight Header with iPhone Safe Area */}
      <div className="safe-area-top">
        <div className="px-3 pt-3 pb-2 bg-gradient-to-b from-background via-background/95 to-transparent">
          {/* Large Widescreen Adversary Image */}
          <BossPortraitWidescreen
            imageUrl={adversaryImageUrl}
            name={adversaryName}
            hpPercent={battleState.adversaryHPPercent}
            isDefeated={battleState.isAdversaryDefeated}
          />
          
          {/* Adversary Name - Prominent & Centered */}
          <motion.div 
            className="flex items-center justify-center gap-2 mt-3 mb-2"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <span className="text-purple-400">⚔️</span>
            <h2 className="text-lg font-bold text-purple-300 tracking-wide uppercase">
              {adversaryName}
            </h2>
            <span className="text-purple-400">⚔️</span>
          </motion.div>
          
          {/* Full-Width Adversary HP Bar */}
          <div className="w-full">
            <BattleHPBar
              currentHP={battleState.adversaryHP}
              maxHP={battleState.adversaryMaxHP}
              isPlayer={false}
              showNumbers={true}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
});
