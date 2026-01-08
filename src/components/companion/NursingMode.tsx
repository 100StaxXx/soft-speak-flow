import { memo } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Heart, Sparkles, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface NursingModeProps {
  companionImageUrl: string;
  recoveryProgress: number;
  daysInactive: number;
  spiritAnimal: string;
}

const RECOVERY_MESSAGES = [
  { threshold: 25, message: "I'm still feeling weak... but you came back." },
  { threshold: 50, message: "I'm starting to feel a little better..." },
  { threshold: 75, message: "Thank you for taking care of me..." },
  { threshold: 100, message: "I'm feeling much better! Thank you for not giving up on me." },
];

export const NursingMode = memo(({
  companionImageUrl,
  recoveryProgress,
  daysInactive,
  spiritAnimal,
}: NursingModeProps) => {
  // Get appropriate message based on recovery progress
  const message = RECOVERY_MESSAGES.find(m => recoveryProgress <= m.threshold)?.message 
    || RECOVERY_MESSAGES[RECOVERY_MESSAGES.length - 1].message;

  // Calculate days until full recovery
  const daysToRecover = Math.ceil((100 - recoveryProgress) / 25);

  return (
    <Card className="relative overflow-hidden bg-card/30 backdrop-blur-xl border-amber-500/20">
      {/* Warning gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-destructive/5" />
      
      <div className="relative p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-foreground">
              Nursing Mode
            </h3>
            <p className="text-sm text-muted-foreground">
              Your {spiritAnimal} needs care to recover
            </p>
          </div>
        </div>

        {/* Companion Image with sick overlay */}
        <div className="flex justify-center">
          <div className="relative">
            <motion.img
              src={companionImageUrl}
              alt={`Sick ${spiritAnimal}`}
              className="w-40 h-40 object-cover rounded-2xl ring-4 ring-amber-500/30"
              style={{
                filter: `saturate(${0.4 + (recoveryProgress / 100) * 0.6}) brightness(${0.7 + (recoveryProgress / 100) * 0.3})`,
              }}
              animate={{
                scale: [1, 1.01, 1],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            {/* Healing particles */}
            <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full bg-amber-500/40"
                  initial={{ 
                    x: `${30 + Math.random() * 40}%`, 
                    y: '100%',
                    opacity: 0,
                  }}
                  animate={{ 
                    y: '0%',
                    opacity: [0, 0.8, 0],
                  }}
                  transition={{
                    duration: 2 + Math.random(),
                    repeat: Infinity,
                    delay: i * 0.7,
                    ease: 'easeOut',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Recovery Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-amber-500" />
              Recovery Progress
            </span>
            <span className="font-medium text-amber-500">
              {recoveryProgress}%
            </span>
          </div>
          <Progress 
            value={recoveryProgress} 
            className="h-2 [&>div]:bg-gradient-to-r [&>div]:from-amber-500 [&>div]:to-emerald-500"
          />
          <p className="text-xs text-muted-foreground text-center">
            {daysToRecover > 0 
              ? `~${daysToRecover} more day${daysToRecover > 1 ? 's' : ''} of care needed`
              : 'Almost fully recovered!'
            }
          </p>
        </div>

        {/* Companion Message */}
        <motion.div
          key={message}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-muted/30 border border-muted/50"
        >
          <div className="flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-primary/50 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground italic leading-relaxed">
              "{message}"
            </p>
          </div>
        </motion.div>

        {/* Care Tips */}
        <div className="text-xs text-muted-foreground/70 text-center space-y-1">
          <p>Complete habits and tasks daily to help your companion heal.</p>
          <p className="text-primary/60">
            Each day of activity adds +25% recovery progress.
          </p>
        </div>
      </div>
    </Card>
  );
});

NursingMode.displayName = 'NursingMode';
