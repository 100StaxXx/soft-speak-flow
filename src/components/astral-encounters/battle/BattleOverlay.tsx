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
      
      {/* HP Bars Container */}
      <div className="px-4 py-2 flex items-center justify-between gap-4 bg-background/80 backdrop-blur-sm border-b border-border/50">
        {/* Player/Companion Side */}
        <div className="flex items-center gap-2 flex-1">
          {/* Companion Portrait */}
          <div className="w-10 h-10 rounded-lg overflow-hidden border border-primary/50 flex-shrink-0">
            {companionImageUrl ? (
              <img
                src={companionImageUrl}
                alt={companionName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                <span className="text-lg">✨</span>
              </div>
            )}
          </div>
          
          {/* Player HP Bar */}
          <div className="flex-1 min-w-0">
            <BattleHPBar
              currentHP={battleState.playerHP}
              maxHP={battleState.playerMaxHP}
              isPlayer={true}
              label={companionName}
              showNumbers={true}
            />
          </div>
        </div>
        
        {/* VS Divider */}
        <div className="flex-shrink-0 px-1">
          <span className="text-xs font-bold text-muted-foreground">VS</span>
        </div>
        
        {/* Adversary Side */}
        <div className="flex items-center gap-2 flex-1">
          {/* Adversary HP Bar */}
          <div className="flex-1 min-w-0">
            <BattleHPBar
              currentHP={battleState.adversaryHP}
              maxHP={battleState.adversaryMaxHP}
              isPlayer={false}
              label={adversaryName}
              showNumbers={true}
            />
          </div>
          
          {/* Adversary Portrait with Cracks */}
          <AdversaryPortraitWithCracks
            imageUrl={adversaryImageUrl}
            name={adversaryName}
            hpPercent={battleState.adversaryHPPercent}
            isDefeated={battleState.isAdversaryDefeated}
            size="sm"
          />
        </div>
      </div>
    </motion.div>
  );
});
