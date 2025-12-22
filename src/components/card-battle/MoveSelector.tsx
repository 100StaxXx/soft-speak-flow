// Move Selection UI

import { motion } from 'framer-motion';
import { Zap, Shield, Heart, Sparkles, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Move, MoveType, BattleElement } from '@/types/cardBattle';
import { Button } from '@/components/ui/button';

interface MoveSelectorProps {
  moves: Move[];
  onSelectMove: (moveId: string) => void;
  onSwitchCard: () => void;
  canSwitch: boolean;
  disabled?: boolean;
}

const MOVE_TYPE_ICONS: Record<MoveType, typeof Zap> = {
  attack: Zap,
  defend: Shield,
  heal: Heart,
  buff: ArrowUp,
  debuff: Sparkles,
};

const ELEMENT_COLORS: Record<BattleElement, string> = {
  body: 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600',
  mind: 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600',
  soul: 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600',
};

const ELEMENT_BORDERS: Record<BattleElement, string> = {
  body: 'border-red-500/50',
  mind: 'border-blue-500/50',
  soul: 'border-emerald-500/50',
};

export function MoveSelector({
  moves,
  onSelectMove,
  onSwitchCard,
  canSwitch,
  disabled = false,
}: MoveSelectorProps) {
  return (
    <div className="w-full space-y-3">
      <p className="text-sm text-muted-foreground text-center">Choose your action</p>
      
      {/* Move Buttons */}
      <div className="grid grid-cols-2 gap-2">
        {moves.map((move, index) => {
          const Icon = MOVE_TYPE_ICONS[move.moveType];
          
          return (
            <motion.button
              key={move.id}
              className={cn(
                'relative p-3 rounded-lg border-2 text-left transition-all',
                'bg-card/80 backdrop-blur',
                ELEMENT_BORDERS[move.element],
                disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-card cursor-pointer'
              )}
              onClick={() => !disabled && onSelectMove(move.id)}
              whileHover={!disabled ? { scale: 1.02 } : undefined}
              whileTap={!disabled ? { scale: 0.98 } : undefined}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              disabled={disabled}
            >
              {/* Element indicator */}
              <div className={cn(
                'absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center',
                ELEMENT_COLORS[move.element]
              )}>
                <Icon className="w-3 h-3 text-white" />
              </div>
              
              {/* Move name */}
              <p className="font-medium text-sm pr-6">{move.name}</p>
              
              {/* Move details */}
              <div className="flex items-center gap-2 mt-1">
                {move.basePower > 0 && (
                  <span className="text-xs text-muted-foreground">
                    PWR: {move.basePower}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  ACC: {move.accuracy}%
                </span>
              </div>
              
              {/* Description */}
              {move.description && (
                <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">
                  {move.description}
                </p>
              )}
            </motion.button>
          );
        })}
      </div>
      
      {/* Switch Button */}
      <div className="flex justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={onSwitchCard}
          disabled={disabled || !canSwitch}
          className="gap-2"
        >
          <ArrowUp className="w-3 h-3 rotate-180" />
          Switch Card
        </Button>
      </div>
    </div>
  );
}

interface CardSwitchModalProps {
  cards: { card: { id: string; creatureName: string; element: BattleElement; currentHP: number; maxHP: number; isKnockedOut: boolean }; index: number }[];
  onSelect: (index: number) => void;
  onCancel: () => void;
}

export function CardSwitchModal({ cards, onSelect, onCancel }: CardSwitchModalProps) {
  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        className="bg-card rounded-xl p-4 max-w-sm w-full border border-border"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-3 text-center">Choose a card to switch</h3>
        
        <div className="space-y-2">
          {cards.map(({ card, index }) => (
            <button
              key={card.id}
              className={cn(
                'w-full p-3 rounded-lg border-2 flex items-center gap-3 transition-all',
                ELEMENT_BORDERS[card.element],
                card.isKnockedOut 
                  ? 'opacity-40 cursor-not-allowed' 
                  : 'hover:bg-accent cursor-pointer'
              )}
              onClick={() => !card.isKnockedOut && onSelect(index)}
              disabled={card.isKnockedOut}
            >
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center',
                ELEMENT_COLORS[card.element]
              )}>
                {card.element === 'body' && <Zap className="w-4 h-4 text-white" />}
                {card.element === 'mind' && <Shield className="w-4 h-4 text-white" />}
                {card.element === 'soul' && <Heart className="w-4 h-4 text-white" />}
              </div>
              
              <div className="flex-1 text-left">
                <p className="font-medium text-sm">{card.creatureName}</p>
                <p className="text-xs text-muted-foreground">
                  HP: {card.currentHP}/{card.maxHP}
                </p>
              </div>
              
              {card.isKnockedOut && (
                <span className="text-xs text-red-500 font-medium">KO</span>
              )}
            </button>
          ))}
        </div>
        
        <Button
          variant="ghost"
          className="w-full mt-3"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </motion.div>
    </motion.div>
  );
}
