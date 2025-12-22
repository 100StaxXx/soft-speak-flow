// Battle Results Screen

import { motion } from 'framer-motion';
import { Trophy, Star, Zap, Clock, Target, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BattleRewards } from '@/types/cardBattle';
import { Button } from '@/components/ui/button';

interface BattleResultsProps {
  result: 'win' | 'lose';
  rewards: BattleRewards;
  turnsPlayed: number;
  onContinue: () => void;
  onRematch?: () => void;
}

export function BattleResults({
  result,
  rewards,
  turnsPlayed,
  onContinue,
  onRematch,
}: BattleResultsProps) {
  const isWin = result === 'win';
  
  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className="w-full max-w-sm"
        initial={{ scale: 0.8, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20 }}
      >
        {/* Result Header */}
        <motion.div
          className={cn(
            'text-center mb-6',
            isWin ? 'text-yellow-400' : 'text-red-400'
          )}
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <motion.div
            className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-3"
            style={{
              background: isWin 
                ? 'radial-gradient(circle, rgba(234,179,8,0.3) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(239,68,68,0.3) 0%, transparent 70%)',
            }}
            animate={isWin ? { 
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {isWin ? (
              <Trophy className="w-12 h-12" />
            ) : (
              <XCircle className="w-12 h-12" />
            )}
          </motion.div>
          
          <h2 className="text-3xl font-bold">
            {isWin ? 'VICTORY!' : 'DEFEAT'}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Battle completed in {turnsPlayed} turns
          </p>
        </motion.div>
        
        {/* Rewards Card */}
        <motion.div
          className="bg-card/90 backdrop-blur rounded-xl border border-border p-4 mb-4"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <h3 className="text-sm font-medium text-muted-foreground mb-3 text-center">
            Battle Rewards
          </h3>
          
          {/* XP Display */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <motion.div
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/20"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.6, type: 'spring' }}
            >
              <Star className="w-5 h-5 text-primary" />
              <span className="text-2xl font-bold text-primary">
                +{rewards.totalXP}
              </span>
              <span className="text-sm text-primary/80">XP</span>
            </motion.div>
          </div>
          
          {/* XP Breakdown */}
          <div className="space-y-2">
            <XPBreakdownItem
              label="Base XP"
              value={rewards.baseXP}
              delay={0.7}
            />
            
            {rewards.perfectBonus && (
              <XPBreakdownItem
                icon={<Target className="w-3 h-3 text-green-400" />}
                label="Perfect Battle"
                value={Math.floor(rewards.baseXP * 0.5)}
                delay={0.8}
                highlight
              />
            )}
            
            {rewards.speedBonus && (
              <XPBreakdownItem
                icon={<Clock className="w-3 h-3 text-blue-400" />}
                label="Speed Bonus"
                value={Math.floor(rewards.baseXP * 0.25)}
                delay={0.9}
                highlight
              />
            )}
            
            {rewards.typeBonus && (
              <XPBreakdownItem
                icon={<Zap className="w-3 h-3 text-yellow-400" />}
                label="Type Mastery"
                value={rewards.bonusXP - (rewards.perfectBonus ? Math.floor(rewards.baseXP * 0.5) : 0) - (rewards.speedBonus ? Math.floor(rewards.baseXP * 0.25) : 0)}
                delay={1.0}
                highlight
              />
            )}
          </div>
        </motion.div>
        
        {/* Action Buttons */}
        <motion.div
          className="space-y-2"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.1 }}
        >
          <Button
            className="w-full"
            size="lg"
            onClick={onContinue}
          >
            Continue
          </Button>
          
          {onRematch && (
            <Button
              variant="outline"
              className="w-full"
              onClick={onRematch}
            >
              Rematch
            </Button>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

interface XPBreakdownItemProps {
  icon?: React.ReactNode;
  label: string;
  value: number;
  delay: number;
  highlight?: boolean;
}

function XPBreakdownItem({ icon, label, value, delay, highlight }: XPBreakdownItemProps) {
  if (value <= 0) return null;
  
  return (
    <motion.div
      className={cn(
        'flex items-center justify-between px-3 py-1.5 rounded',
        highlight ? 'bg-primary/10' : 'bg-muted/50'
      )}
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay }}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <span className={cn(
        'text-xs font-medium',
        highlight ? 'text-primary' : 'text-muted-foreground'
      )}>
        +{value}
      </span>
    </motion.div>
  );
}
