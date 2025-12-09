import { motion } from 'framer-motion';
import { Trophy, Star, Sparkles, XCircle, RefreshCw } from 'lucide-react';
import { Adversary, EncounterResult as ResultType } from '@/types/astralEncounters';
import { Button } from '@/components/ui/button';

interface EncounterResultProps {
  adversary: Adversary;
  result: ResultType;
  accuracy: number;
  xpEarned: number;
  onClose: () => void;
  retryAvailableAt?: string;
}

const RESULT_CONFIG: Record<ResultType, {
  title: string;
  icon: typeof Trophy;
  color: string;
  bgColor: string;
}> = {
  perfect: {
    title: 'Perfect Victory!',
    icon: Trophy,
    color: 'text-amber-400',
    bgColor: 'from-amber-500/20 to-orange-500/20',
  },
  good: {
    title: 'Victory!',
    icon: Star,
    color: 'text-primary',
    bgColor: 'from-primary/20 to-accent/20',
  },
  partial: {
    title: 'Partial Success',
    icon: Sparkles,
    color: 'text-blue-400',
    bgColor: 'from-blue-500/20 to-cyan-500/20',
  },
  fail: {
    title: 'Adversary Escaped',
    icon: XCircle,
    color: 'text-red-400',
    bgColor: 'from-red-500/20 to-rose-500/20',
  },
};

export const EncounterResultScreen = ({ 
  adversary, 
  result, 
  accuracy, 
  xpEarned, 
  onClose,
  retryAvailableAt 
}: EncounterResultProps) => {
  const config = RESULT_CONFIG[result];
  const Icon = config.icon;
  const isSuccess = result !== 'fail';

  const formatRetryTime = () => {
    if (!retryAvailableAt) return '';
    const retryDate = new Date(retryAvailableAt);
    const now = new Date();
    const hoursLeft = Math.ceil((retryDate.getTime() - now.getTime()) / (1000 * 60 * 60));
    return `Retry in ${hoursLeft}h`;
  };

  return (
    <div className={`flex flex-col items-center gap-6 p-6 text-center bg-gradient-to-br ${config.bgColor} rounded-2xl`}>
      {/* Result icon */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', duration: 0.8 }}
      >
        <Icon className={`w-20 h-20 ${config.color}`} />
      </motion.div>

      {/* Result title */}
      <motion.h2
        className={`text-3xl font-bold ${config.color}`}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {config.title}
      </motion.h2>

      {/* Accuracy */}
      <motion.div
        className="text-lg text-foreground"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        Accuracy: <span className="font-bold">{accuracy}%</span>
      </motion.div>

      {/* Rewards */}
      {isSuccess && (
        <motion.div
          className="space-y-4"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {/* XP */}
          <div className="flex items-center justify-center gap-2 text-xl">
            <Sparkles className="w-6 h-6 text-primary" />
            <span className="font-bold text-primary">+{xpEarned} XP</span>
          </div>

          {/* Essence absorbed */}
          <div className="p-4 rounded-xl bg-background/50 border border-border">
            <p className="text-sm text-muted-foreground mb-2">Essence Absorbed</p>
            <p className="font-bold text-lg text-foreground">{adversary.essenceName}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {adversary.essenceDescription}
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="text-sm text-muted-foreground capitalize">{adversary.statType}</span>
              <span className="font-bold text-green-500">+{adversary.statBoost}</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Fail message */}
      {!isSuccess && (
        <motion.div
          className="space-y-2"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <p className="text-muted-foreground">
            The {adversary.name} has retreated into the void...
          </p>
          {retryAvailableAt && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="w-4 h-4" />
              {formatRetryTime()}
            </div>
          )}
        </motion.div>
      )}

      {/* Companion reaction placeholder */}
      <motion.div
        className="mt-4 p-4 rounded-xl bg-muted/30 border border-border"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        <p className="text-sm italic text-muted-foreground">
          {isSuccess 
            ? "Your companion glows with newfound energy!" 
            : "Your companion looks determined to try again."}
        </p>
      </motion.div>

      {/* Close button */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.9 }}
      >
        <Button onClick={onClose} variant="outline" size="lg">
          Continue
        </Button>
      </motion.div>
    </div>
  );
};
