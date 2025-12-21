import { motion } from 'framer-motion';
import { Trophy, Star, Sparkles, XCircle, RefreshCw, Brain, Heart, Dumbbell, Skull, Shield } from 'lucide-react';
import { Adversary, EncounterResult as ResultType } from '@/types/astralEncounters';
import { Button } from '@/components/ui/button';
import { useEffect, useMemo } from 'react';
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
    title: 'Overcome by Shadow',
    icon: Skull,
    color: 'text-slate-400',
    textGradient: 'from-slate-400 via-purple-400 to-slate-500',
    confettiColors: [],
  },
};

// Companion defeat messages
const DEFEAT_MESSAGES = [
  'steadies their resolve beside you',
  'refuses to give up',
  'gathers strength for the next attempt',
  'stands ready to try again',
  'believes in your strength',
];

// Falling ember particle component
const FallingEmbers = () => {
  const embers = useMemo(() => 
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 3,
      duration: 4 + Math.random() * 3,
      size: 2 + Math.random() * 3,
    })), []
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {embers.map((ember) => (
        <motion.div
          key={ember.id}
          className="absolute rounded-full"
          style={{
            left: `${ember.left}%`,
            top: '-5%',
            width: ember.size,
            height: ember.size,
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.8), rgba(100, 50, 150, 0.4))',
            boxShadow: '0 0 6px rgba(168, 85, 247, 0.5)',
          }}
          animate={{
            y: ['0vh', '110vh'],
            opacity: [0, 0.8, 0.6, 0],
            x: [0, Math.sin(ember.id) * 20, Math.cos(ember.id) * 15, 0],
          }}
          transition={{
            duration: ember.duration,
            delay: ember.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  );
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

  // Get random defeat message
  const defeatMessage = useMemo(() => 
    DEFEAT_MESSAGES[Math.floor(Math.random() * DEFEAT_MESSAGES.length)], 
    []
  );

  // Trigger celebration effects
  useEffect(() => {
    if (isSuccess) {
      // Haptic feedback - may fail on non-native platforms
      Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {
        // Haptics not available on web - silently ignore
      });
      
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
    } else {
      // Somber haptic for defeat - may fail on non-native platforms
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {
        // Haptics not available on web - silently ignore
      });
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
    <div className="flex flex-col items-center gap-4 p-6 text-center overflow-hidden relative">
      {/* Animated background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className={`absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl ${isSuccess ? 'bg-primary/20' : 'bg-purple-900/30'}`}
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
        
        {/* Dark vignette for defeat */}
        {!isSuccess && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              background: 'radial-gradient(ellipse at center, transparent 20%, rgba(15, 10, 30, 0.6) 80%)',
            }}
          />
        )}
      </div>

      {/* Falling embers for defeat */}
      {!isSuccess && <FallingEmbers />}

      {/* Result Icon with Glow */}
      <motion.div
        className="relative"
        initial={{ scale: 0, rotate: isSuccess ? -180 : 0 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', duration: 0.8 }}
      >
        <div className={`absolute inset-0 blur-xl ${isSuccess ? config.color : 'text-purple-500'} opacity-50`} />
        <Icon className={`w-16 h-16 ${config.color} relative z-10 drop-shadow-lg`} />
        
        {/* Pulse effect for defeat */}
        {!isSuccess && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-purple-500/30"
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
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

      {/* Companion Display - Shows for BOTH success and defeat */}
      {companionImageUrl && (
        <motion.div
          className="relative my-2"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: 'spring' }}
        >
          {/* Glow ring - different color for defeat vs success */}
          <motion.div
            className={`absolute inset-0 rounded-full bg-gradient-to-r ${isSuccess ? statConfig.bg : 'from-slate-600/30 to-purple-900/30'} blur-xl`}
            animate={{ 
              scale: [1, 1.3, 1], 
              opacity: isSuccess ? [0.5, 0.8, 0.5] : [0.3, 0.5, 0.3] 
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          
          {/* Companion image */}
          <div className={`relative w-28 h-28 rounded-full overflow-hidden border-2 ${isSuccess ? 'border-primary/50 shadow-lg shadow-primary/30' : 'border-slate-500/40 shadow-lg shadow-purple-900/30'}`}>
            <img 
              src={companionImageUrl} 
              alt={companionName || 'Companion'} 
              className={`w-full h-full object-cover ${!isSuccess ? 'saturate-75' : ''}`}
            />
            
            {/* Overlay for defeat - subtle darkening */}
            {!isSuccess && (
              <div className="absolute inset-0 bg-gradient-to-t from-purple-900/30 to-transparent" />
            )}
          </div>
          
          {/* Floating sparkles for success */}
          {isSuccess && (
            <motion.div
              className="absolute -top-1 -right-1"
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
            >
              <Sparkles className={`w-5 h-5 ${statConfig.color}`} />
            </motion.div>
          )}
          
          {/* Shield icon for defeat - showing determination */}
          {!isSuccess && (
            <motion.div
              className="absolute -bottom-1 -right-1"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5 }}
            >
              <div className="w-8 h-8 rounded-full bg-slate-800/80 border border-purple-500/40 flex items-center justify-center">
                <Shield className="w-4 h-4 text-purple-400" />
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Companion Reaction Message */}
      <motion.p
        className={`text-sm italic ${isSuccess ? 'text-muted-foreground' : 'text-purple-300/80'}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {isSuccess 
          ? `${companionName || 'Your companion'} radiates with newfound power!` 
          : `${companionName || 'Your companion'} ${defeatMessage}`}
      </motion.p>

      {/* Essence Card - Success shows absorbed, Defeat shows lost */}
      <motion.div
        className="w-full"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <div className={`relative p-4 rounded-xl ${isSuccess ? `bg-gradient-to-br ${statConfig.bg}` : 'bg-gradient-to-br from-slate-800/50 to-purple-900/30'} border ${isSuccess ? 'border-white/10' : 'border-slate-600/30'} backdrop-blur-sm overflow-hidden`}>
          {/* Animated border glow */}
          <motion.div
            className={`absolute inset-0 rounded-xl border-2 ${isSuccess ? statConfig.color.replace('text', 'border') : 'border-slate-500/30'} opacity-50`}
            animate={{ opacity: isSuccess ? [0.3, 0.7, 0.3] : [0.1, 0.3, 0.1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          
          {/* Content */}
          <div className="relative z-10">
            <div className="flex items-center justify-center gap-2 mb-2">
              {isSuccess ? (
                <>
                  <Sparkles className={`w-4 h-4 ${statConfig.color}`} />
                  <p className={`text-sm font-bold uppercase tracking-wider ${statConfig.color}`}>
                    Essence Absorbed
                  </p>
                  <Sparkles className={`w-4 h-4 ${statConfig.color}`} />
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-slate-400" />
                  <p className="text-sm font-bold uppercase tracking-wider text-slate-400">
                    Essence Slipped Away
                  </p>
                  <XCircle className="w-4 h-4 text-slate-400" />
                </>
              )}
            </div>
            
            <h3 className={`text-xl font-bold ${isSuccess ? 'text-foreground' : 'text-slate-400'} mb-1`}>
              {adversary.essenceName}
            </h3>
            
            <p className={`text-sm ${isSuccess ? 'text-muted-foreground' : 'text-slate-500'} mb-3 line-clamp-2`}>
              "{adversary.essenceDescription}"
            </p>
            
            {/* Stat boost badge */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${isSuccess ? 'bg-background/50' : 'bg-slate-800/50'} border ${isSuccess ? 'border-white/10' : 'border-slate-600/30'}`}>
              <StatIcon className={`w-5 h-5 ${isSuccess ? statConfig.color : 'text-slate-500'}`} />
              <span className={`text-sm font-medium ${isSuccess ? 'text-muted-foreground' : 'text-slate-500'} capitalize`}>
                {adversary.statType}
              </span>
              <span className={`text-lg font-bold ${isSuccess ? statConfig.color : 'text-slate-500 line-through'}`}>
                +{adversary.statBoost}
              </span>
              {!isSuccess && (
                <span className="text-xs text-slate-500 ml-1">(Not earned)</span>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* XP Earned - Only show on success */}
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
          <span className={`font-bold ${isSuccess ? 'text-foreground' : 'text-slate-400'}`}>{accuracy}%</span>
        </div>
        <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${isSuccess ? 'bg-gradient-to-r from-primary to-accent' : 'bg-gradient-to-r from-slate-600 to-purple-700/50'}`}
            initial={{ width: 0 }}
            animate={{ width: `${accuracy}%` }}
            transition={{ delay: 0.9, duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </motion.div>

      {/* Retry info - Only for defeat */}
      {!isSuccess && retryAvailableAt && (
        <motion.div
          className="flex items-center justify-center gap-2 text-sm text-purple-300/70"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          >
            <RefreshCw className="w-4 h-4" />
          </motion.div>
          <span>{formatRetryTime()}</span>
        </motion.div>
      )}

      {/* Continue/Return button */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1.1 }}
        className="mt-2"
      >
        <Button 
          onClick={onClose} 
          className={`px-8 ${isSuccess ? 'bg-gradient-to-r from-primary to-accent hover:opacity-90' : 'bg-gradient-to-r from-slate-700 to-purple-800 hover:from-slate-600 hover:to-purple-700 border border-purple-500/30'}`}
          variant={isSuccess ? 'default' : 'outline'}
          size="lg"
        >
          {isSuccess ? 'Continue' : 'Return to Safety'}
        </Button>
      </motion.div>
    </div>
  );
};
