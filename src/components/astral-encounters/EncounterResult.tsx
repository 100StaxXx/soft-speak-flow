import { motion } from 'framer-motion';
import { Trophy, Star, Sparkles, XCircle, RefreshCw, Brain, Heart, Dumbbell } from 'lucide-react';
import { Adversary, EncounterResult as ResultType } from '@/types/astralEncounters';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

interface EncounterResultProps {
  adversary: Adversary;
  result: ResultType;
  accuracy: number;
  xpEarned: number;
  onClose: () => void;
  retryAvailableAt?: string;
  tiltBonus?: boolean;
  companionImageUrl?: string;
  companionName?: string;
}

const STAT_CONFIG = {
  mind: { icon: Brain, color: 'text-cyan-400', bg: 'from-cyan-500/30 to-blue-500/30', glow: 'shadow-cyan-500/50' },
  body: { icon: Dumbbell, color: 'text-amber-400', bg: 'from-amber-500/30 to-orange-500/30', glow: 'shadow-amber-500/50' },
  soul: { icon: Heart, color: 'text-purple-400', bg: 'from-purple-500/30 to-pink-500/30', glow: 'shadow-purple-500/50' },
};

const RESULT_CONFIG: Record<ResultType, {
  title: string;
  icon: typeof Trophy;
  color: string;
  textGradient: string;
  confettiColors: string[];
}> = {
  perfect: {
    title: 'Perfect Victory!',
    icon: Trophy,
    color: 'text-amber-400',
    textGradient: 'from-amber-300 via-yellow-400 to-orange-400',
    confettiColors: ['#fbbf24', '#f59e0b', '#d97706', '#fcd34d'],
  },
  good: {
    title: 'Victory!',
    icon: Star,
    color: 'text-primary',
    textGradient: 'from-primary via-accent to-primary',
    confettiColors: ['#8b5cf6', '#a855f7', '#c084fc', '#6366f1'],
  },
  fail: {
    title: 'Defeated',
    icon: XCircle,
    color: 'text-red-400',
    textGradient: 'from-red-400 to-rose-500',
    confettiColors: [],
  },
};

export const EncounterResultScreen = ({ 
  adversary, 
  result, 
  accuracy, 
  xpEarned, 
  onClose,
  retryAvailableAt,
  tiltBonus,
  companionImageUrl,
  companionName,
}: EncounterResultProps) => {
  const config = RESULT_CONFIG[result];
  const Icon = config.icon;
  const isSuccess = result !== 'fail';
  const statConfig = STAT_CONFIG[adversary.statType as keyof typeof STAT_CONFIG] || STAT_CONFIG.soul;
  const StatIcon = statConfig.icon;

  // Trigger celebration effects
  useEffect(() => {
    if (isSuccess) {
      // Haptic feedback
      Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
      
      // Confetti burst
      const duration = 2000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors: config.confettiColors,
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
          colors: config.confettiColors,
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();

      // Center burst
      setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 100,
          origin: { y: 0.5 },
          colors: config.confettiColors,
        });
      }, 300);
    }
  }, [isSuccess, config.confettiColors]);

  const formatRetryTime = () => {
    if (!retryAvailableAt) return '';
    const retryDate = new Date(retryAvailableAt);
    const now = new Date();
    const hoursLeft = Math.ceil((retryDate.getTime() - now.getTime()) / (1000 * 60 * 60));
    return `Retry in ${hoursLeft}h`;
  };

  return (
    <div className="flex flex-col items-center gap-4 p-6 text-center overflow-hidden">
      {/* Animated background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className={`absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl ${isSuccess ? 'bg-primary/20' : 'bg-red-500/10'}`}
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
      </div>

      {/* Result Icon with Glow */}
      <motion.div
        className="relative"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', duration: 0.8 }}
      >
        <div className={`absolute inset-0 blur-xl ${config.color} opacity-50`} />
        <Icon className={`w-16 h-16 ${config.color} relative z-10 drop-shadow-lg`} />
      </motion.div>

      {/* Result Title with Gradient */}
      <motion.h2
        className={`text-3xl font-black bg-gradient-to-r ${config.textGradient} bg-clip-text text-transparent`}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {config.title}
      </motion.h2>

      {/* Companion with Essence Absorption */}
      {isSuccess && companionImageUrl && (
        <motion.div
          className="relative my-2"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: 'spring' }}
        >
          {/* Glow ring */}
          <motion.div
            className={`absolute inset-0 rounded-full bg-gradient-to-r ${statConfig.bg} blur-xl`}
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          
          {/* Companion image */}
          <div className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-primary/50 shadow-lg shadow-primary/30">
            <img 
              src={companionImageUrl} 
              alt={companionName || 'Companion'} 
              className="w-full h-full object-cover"
            />
          </div>
          
          {/* Floating sparkles */}
          <motion.div
            className="absolute -top-1 -right-1"
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          >
            <Sparkles className={`w-5 h-5 ${statConfig.color}`} />
          </motion.div>
        </motion.div>
      )}

      {/* Essence Card - Cosmic Design */}
      {isSuccess && (
        <motion.div
          className="w-full"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className={`relative p-4 rounded-xl bg-gradient-to-br ${statConfig.bg} border border-white/10 backdrop-blur-sm overflow-hidden`}>
            {/* Animated border glow */}
            <motion.div
              className={`absolute inset-0 rounded-xl border-2 ${statConfig.color.replace('text', 'border')} opacity-50`}
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            
            {/* Content */}
            <div className="relative z-10">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Sparkles className={`w-4 h-4 ${statConfig.color}`} />
                <p className={`text-sm font-bold uppercase tracking-wider ${statConfig.color}`}>
                  Essence Absorbed
                </p>
                <Sparkles className={`w-4 h-4 ${statConfig.color}`} />
              </div>
              
              <h3 className="text-xl font-bold text-foreground mb-1">
                {adversary.essenceName}
              </h3>
              
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                "{adversary.essenceDescription}"
              </p>
              
              {/* Stat boost badge */}
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-background/50 border border-white/10`}>
                <StatIcon className={`w-5 h-5 ${statConfig.color}`} />
                <span className="text-sm font-medium text-muted-foreground capitalize">
                  {adversary.statType}
                </span>
                <span className={`text-lg font-bold ${statConfig.color}`}>
                  +{adversary.statBoost}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* XP Earned */}
      {isSuccess && (
        <motion.div
          className="flex flex-col items-center gap-1"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.7, type: 'spring' }}
        >
          <div className="flex items-center gap-2 text-xl">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="font-bold text-primary">+{xpEarned} XP</span>
          </div>
          {tiltBonus && (
            <motion.div 
              className="flex items-center gap-1 text-xs text-cyan-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              <span>📱</span>
              <span>+25% Tilt Bonus!</span>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Accuracy Bar */}
      <motion.div
        className="w-full mt-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <div className="flex justify-between text-sm mb-1">
          <span className="text-muted-foreground">Accuracy</span>
          <span className="font-bold text-foreground">{accuracy}%</span>
        </div>
        <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${isSuccess ? 'bg-gradient-to-r from-primary to-accent' : 'bg-red-500/50'}`}
            initial={{ width: 0 }}
            animate={{ width: `${accuracy}%` }}
            transition={{ delay: 0.9, duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </motion.div>

      {/* Fail state */}
      {!isSuccess && (
        <motion.div
          className="space-y-2 mt-2"
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

      {/* Companion reaction */}
      <motion.p
        className="text-sm italic text-muted-foreground mt-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1 }}
      >
        {isSuccess 
          ? `${companionName || 'Your companion'} radiates with newfound power!` 
          : `${companionName || 'Your companion'} looks ready to try again.`}
      </motion.p>

      {/* Continue button */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="mt-2"
      >
        <Button 
          onClick={onClose} 
          className={`px-8 ${isSuccess ? 'bg-gradient-to-r from-primary to-accent hover:opacity-90' : ''}`}
          variant={isSuccess ? 'default' : 'outline'}
          size="lg"
        >
          Continue
        </Button>
      </motion.div>
    </div>
  );
};