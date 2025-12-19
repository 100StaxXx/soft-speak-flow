import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BattleState } from '@/types/battleSystem';
import { BattleHPBar } from './BattleHPBar';
import { AdversaryPortraitWithCracks } from './AdversaryPortraitWithCracks';

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
  companionImageUrl,
  companionName,
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
      {/* Red vignette for low HP */}
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
      
      {/* Battle Header with iPhone Safe Area */}
      <div className="safe-area-top">
        <div className="px-4 py-3 bg-gradient-to-b from-background via-background/95 to-background/80 backdrop-blur-md border-b border-border/50">
          {/* Portraits Row with Names */}
          <div className="flex items-center justify-between mb-3">
            {/* Companion Side */}
            <div className="flex items-center gap-3">
              {/* Companion Portrait - Larger with glow */}
              <div className="w-14 h-14 rounded-xl overflow-hidden border-2 border-primary/50 shadow-lg shadow-primary/20 flex-shrink-0">
                {companionImageUrl ? (
                  <img
                    src={companionImageUrl}
                    alt={companionName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                    <span className="text-2xl">✨</span>
                  </div>
                )}
              </div>
              <span className="text-sm font-semibold text-primary truncate max-w-[80px]">
                {companionName}
              </span>
            </div>
            
            {/* VS Badge - Centered */}
            <div className="px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 flex-shrink-0">
              <span className="text-sm font-bold text-purple-400">VS</span>
            </div>
            
            {/* Adversary Side */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-purple-400 truncate max-w-[80px]">
                {adversaryName}
              </span>
              {/* Adversary Portrait - Larger with glow */}
              <AdversaryPortraitWithCracks
                imageUrl={adversaryImageUrl}
                name={adversaryName}
                hpPercent={battleState.adversaryHPPercent}
                isDefeated={battleState.isAdversaryDefeated}
                size="md"
              />
            </div>
          </div>
          
          {/* HP Bars Row - Below Portraits */}
          <div className="flex items-center gap-4">
            {/* Player HP Bar */}
            <div className="flex-1 min-w-0">
              <BattleHPBar
                currentHP={battleState.playerHP}
                maxHP={battleState.playerMaxHP}
                isPlayer={true}
                showNumbers={true}
              />
            </div>
            
            {/* Spacer for VS alignment */}
            <div className="w-14 flex-shrink-0" />
            
            {/* Adversary HP Bar */}
            <div className="flex-1 min-w-0">
              <BattleHPBar
                currentHP={battleState.adversaryHP}
                maxHP={battleState.adversaryMaxHP}
                isPlayer={false}
                showNumbers={true}
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});
