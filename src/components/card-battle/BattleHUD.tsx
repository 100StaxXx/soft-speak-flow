// Battle HUD - Health bars, turn indicator, status

import { motion, AnimatePresence } from 'framer-motion';
import { Swords, RefreshCw, Zap, Shield, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BattleCard, BattleElement, TurnResult } from '@/types/cardBattle';

interface BattleHUDProps {
  playerCard: BattleCard | null;
  aiCard: BattleCard | null;
  turnNumber: number;
  lastTurnResult: TurnResult | null;
  isProcessing: boolean;
}

const ELEMENT_COLORS: Record<BattleElement, string> = {
  body: 'from-red-500 to-orange-500',
  mind: 'from-blue-500 to-purple-500',
  soul: 'from-emerald-500 to-teal-500',
};

export function BattleHUD({
  playerCard,
  aiCard,
  turnNumber,
  lastTurnResult,
  isProcessing,
}: BattleHUDProps) {
  return (
    <div className="w-full space-y-4">
      {/* Turn Indicator */}
      <div className="flex items-center justify-center gap-2">
        <motion.div
          className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-card/80 backdrop-blur border border-border"
          animate={isProcessing ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 0.5, repeat: isProcessing ? Infinity : 0 }}
        >
          <Swords className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Turn {turnNumber}</span>
          {isProcessing && (
            <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground" />
          )}
        </motion.div>
      </div>
      
      {/* Health Bars */}
      <div className="flex items-center justify-between gap-4">
        {/* Player Card Info */}
        {playerCard && (
          <HealthBar
            card={playerCard}
            isPlayer={true}
          />
        )}
        
        {/* VS */}
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">VS</span>
          </div>
        </div>
        
        {/* AI Card Info */}
        {aiCard && (
          <HealthBar
            card={aiCard}
            isPlayer={false}
          />
        )}
      </div>
      
      {/* Turn Narration */}
      <AnimatePresence mode="wait">
        {lastTurnResult && (
          <motion.div
            key={lastTurnResult.turnNumber}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-center"
          >
            <div className="inline-block px-4 py-2 rounded-lg bg-card/60 backdrop-blur border border-border">
              <p className="text-sm">{lastTurnResult.narration}</p>
              
              {/* Damage indicators */}
              <div className="flex items-center justify-center gap-4 mt-1">
                {lastTurnResult.playerDamageDealt > 0 && (
                  <span className="text-xs text-green-400">
                    You dealt {lastTurnResult.playerDamageDealt} damage
                    {lastTurnResult.criticalHit && ' (CRIT!)'}
                  </span>
                )}
                {lastTurnResult.aiDamageDealt > 0 && (
                  <span className="text-xs text-red-400">
                    Took {lastTurnResult.aiDamageDealt} damage
                  </span>
                )}
              </div>
              
              {/* Type advantage indicator */}
              {lastTurnResult.typeAdvantage !== 'neutral' && (
                <div className={cn(
                  'text-xs mt-1',
                  lastTurnResult.typeAdvantage === 'player' ? 'text-green-400' : 'text-red-400'
                )}>
                  {lastTurnResult.typeAdvantage === 'player' 
                    ? '✨ Type advantage!' 
                    : '⚠️ Type disadvantage'}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface HealthBarProps {
  card: BattleCard;
  isPlayer: boolean;
}

function HealthBar({ card, isPlayer }: HealthBarProps) {
  const hpPercent = (card.currentHP / card.maxHP) * 100;
  const hpColor = hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500';
  
  return (
    <div className={cn('flex-1 max-w-[200px]', !isPlayer && 'order-1')}>
      <div className={cn(
        'flex items-center gap-2 mb-1',
        isPlayer ? 'justify-start' : 'justify-end'
      )}>
        <div className={cn(
          'w-6 h-6 rounded-full bg-gradient-to-br flex items-center justify-center',
          ELEMENT_COLORS[card.element]
        )}>
          {card.element === 'body' && <Zap className="w-3 h-3 text-white" />}
          {card.element === 'mind' && <Shield className="w-3 h-3 text-white" />}
          {card.element === 'soul' && <Heart className="w-3 h-3 text-white" />}
        </div>
        
        <div className={cn(isPlayer ? 'text-left' : 'text-right')}>
          <p className="text-xs font-medium truncate max-w-[120px]">
            {card.creatureName}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Lv.{card.evolutionStage} {isPlayer ? 'You' : 'AI'}
          </p>
        </div>
      </div>
      
      {/* HP Bar */}
      <div className="relative h-3 bg-black/30 rounded-full overflow-hidden">
        <motion.div
          className={cn('absolute inset-y-0 left-0 rounded-full', hpColor)}
          initial={{ width: '100%' }}
          animate={{ width: `${hpPercent}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[9px] font-bold text-white drop-shadow-md">
            {card.currentHP} / {card.maxHP}
          </span>
        </div>
      </div>
      
      {/* Status Effects */}
      {card.statusEffects.length > 0 && (
        <div className={cn(
          'flex gap-1 mt-1',
          isPlayer ? 'justify-start' : 'justify-end'
        )}>
          {card.statusEffects.map((status, i) => (
            <div
              key={i}
              className="px-1.5 py-0.5 rounded text-[8px] bg-primary/20 text-primary"
            >
              {status.effect} ({status.turnsRemaining})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
