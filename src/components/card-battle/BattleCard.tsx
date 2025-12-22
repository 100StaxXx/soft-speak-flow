// Battle Card Display Component

import { motion } from 'framer-motion';
import { Heart, Zap, Shield, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BattleCard as BattleCardType, BattleElement } from '@/types/cardBattle';

interface BattleCardProps {
  card: BattleCardType;
  isActive?: boolean;
  isEnemy?: boolean;
  showHP?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
}

const ELEMENT_CONFIG: Record<BattleElement, { color: string; icon: typeof Zap; label: string }> = {
  body: { color: 'from-red-500 to-orange-500', icon: Zap, label: 'Body' },
  mind: { color: 'from-blue-500 to-purple-500', icon: Sparkles, label: 'Mind' },
  soul: { color: 'from-emerald-500 to-teal-500', icon: Heart, label: 'Soul' },
};

const SIZE_CONFIG = {
  sm: { width: 'w-20', height: 'h-28', text: 'text-xs' },
  md: { width: 'w-32', height: 'h-44', text: 'text-sm' },
  lg: { width: 'w-40', height: 'h-56', text: 'text-base' },
};

export function BattleCardComponent({
  card,
  isActive = false,
  isEnemy = false,
  showHP = true,
  size = 'md',
  onClick,
  disabled = false,
}: BattleCardProps) {
  const elementConfig = ELEMENT_CONFIG[card.element];
  const sizeConfig = SIZE_CONFIG[size];
  const ElementIcon = elementConfig.icon;
  
  const hpPercent = (card.currentHP / card.maxHP) * 100;
  const hpColor = hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500';
  
  return (
    <motion.div
      className={cn(
        'relative rounded-lg overflow-hidden cursor-pointer transition-all',
        sizeConfig.width,
        sizeConfig.height,
        isActive && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
        card.isKnockedOut && 'opacity-40 grayscale',
        disabled && 'pointer-events-none',
        onClick && !disabled && 'hover:scale-105'
      )}
      onClick={onClick}
      whileHover={onClick && !disabled ? { y: -4 } : undefined}
      whileTap={onClick && !disabled ? { scale: 0.98 } : undefined}
      animate={card.isKnockedOut ? { rotateZ: isEnemy ? -10 : 10 } : { rotateZ: 0 }}
    >
      {/* Card Background */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-br',
        elementConfig.color,
        'opacity-80'
      )} />
      
      {/* Card Frame */}
      <div className="absolute inset-0.5 rounded-md bg-card/90 backdrop-blur-sm" />
      
      {/* Content */}
      <div className="relative h-full flex flex-col p-1.5">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className={cn(
            'flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-gradient-to-r',
            elementConfig.color
          )}>
            <ElementIcon className="w-2.5 h-2.5 text-white" />
            <span className="text-[8px] text-white font-bold">{card.evolutionStage}</span>
          </div>
          
          {isEnemy && (
            <span className="text-[8px] text-muted-foreground">AI</span>
          )}
        </div>
        
        {/* Image Area */}
        <div className="flex-1 relative rounded overflow-hidden bg-black/20 mb-1">
          {card.imageUrl ? (
            <img 
              src={card.imageUrl} 
              alt={card.creatureName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ElementIcon className={cn('w-8 h-8 text-white/50')} />
            </div>
          )}
          
          {/* KO Overlay */}
          {card.isKnockedOut && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-red-500 font-bold text-lg">KO</span>
            </div>
          )}
        </div>
        
        {/* Name */}
        <p className={cn(
          'font-semibold text-center truncate',
          size === 'sm' ? 'text-[9px]' : 'text-xs'
        )}>
          {card.creatureName}
        </p>
        
        {/* HP Bar */}
        {showHP && (
          <div className="mt-1">
            <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
              <motion.div
                className={cn('h-full rounded-full', hpColor)}
                initial={{ width: '100%' }}
                animate={{ width: `${hpPercent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[8px] text-muted-foreground">HP</span>
              <span className="text-[8px] font-medium">
                {card.currentHP}/{card.maxHP}
              </span>
            </div>
          </div>
        )}
        
        {/* Stats (for larger cards) */}
        {size === 'lg' && (
          <div className="flex justify-around mt-1 pt-1 border-t border-border/50">
            <div className="flex items-center gap-0.5">
              <Zap className="w-2.5 h-2.5 text-red-400" />
              <span className="text-[9px]">{card.stats.attack}</span>
            </div>
            <div className="flex items-center gap-0.5">
              <Shield className="w-2.5 h-2.5 text-blue-400" />
              <span className="text-[9px]">{card.stats.defense}</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Active Glow */}
      {isActive && !card.isKnockedOut && (
        <motion.div
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            boxShadow: `0 0 20px ${isEnemy ? 'rgba(239, 68, 68, 0.5)' : 'rgba(34, 197, 94, 0.5)'}`,
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
}
