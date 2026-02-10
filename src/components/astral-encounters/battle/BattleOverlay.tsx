import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BattleState } from '@/types/battleSystem';
import { BattleHPBar } from './BattleHPBar';
import { BossPortraitWidescreen } from './BossPortraitWidescreen';

interface BattleOverlayProps {
  battleState: BattleState;
  adversaryImageUrl?: string;
  adversaryName: string;
  showScreenShake?: boolean;
  battleTimeLeft?: number;
  battleTimeTotal?: number;
}

export const BattleOverlay = memo(function BattleOverlay({
  battleState,
  adversaryImageUrl,
  adversaryName,
  showScreenShake = false,
  battleTimeLeft,
  battleTimeTotal,
}: BattleOverlayProps) {
  const isLowHP = battleState.playerHPPercent < 25;
  
  return (
    <motion.div
      className="relative w-full"
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
            className="fixed inset-0 pointer-events-none z-40"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 40%, rgba(220,38,38,0.4) 100%)',
            }}
          />
        )}
      </AnimatePresence>
      
      {/* Boss Fight Header - iPhone Safe Area */}
      <div 
        className="w-full bg-gradient-to-b from-background via-background/95 to-transparent"
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 0px), 8px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)',
        }}
      >
        <div className="px-2 pt-0.5 pb-1">
          {/* Large Widescreen Adversary Image */}
          <BossPortraitWidescreen
            imageUrl={adversaryImageUrl}
            name={adversaryName}
            hpPercent={battleState.adversaryHPPercent}
            isDefeated={battleState.isAdversaryDefeated}
          />
          
          {/* Adversary Name - Compact */}
          <motion.div 
            className="flex items-center justify-center gap-1.5 mt-1 mb-0.5"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <span className="text-purple-400 text-xs">⚔️</span>
            <h2 className="text-sm font-bold text-purple-300 tracking-wide uppercase truncate max-w-[200px]">
              {adversaryName}
            </h2>
            <span className="text-purple-400 text-xs">⚔️</span>
          </motion.div>
          
          {/* Full-Width Adversary HP Bar */}
          <div className="w-full px-1">
            <BattleHPBar
              currentHP={battleState.adversaryHP}
              maxHP={battleState.adversaryMaxHP}
              isPlayer={false}
              showNumbers={true}
            />
          </div>
          
          {/* Battle Timer */}
          {battleTimeLeft !== undefined && battleTimeTotal !== undefined && (
            <div className="w-full px-1 mt-1">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      width: `${(battleTimeLeft / battleTimeTotal) * 100}%`,
                      background: battleTimeLeft <= 10 
                        ? 'linear-gradient(90deg, #ef4444, #f87171)' 
                        : 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))',
                    }}
                    animate={battleTimeLeft <= 10 ? { opacity: [1, 0.6, 1] } : {}}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  />
                </div>
                <span className={`text-xs font-mono font-bold min-w-[32px] text-right ${
                  battleTimeLeft <= 10 ? 'text-red-400' : 'text-muted-foreground'
                }`}>
                  {battleTimeLeft}s
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});
