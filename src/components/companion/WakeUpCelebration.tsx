import { memo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Heart, Sun, Star } from 'lucide-react';
import confetti from 'canvas-confetti';

interface WakeUpCelebrationProps {
  isOpen: boolean;
  onClose: () => void;
  companionName: string;
  companionImageUrl: string;
  dormantImageUrl?: string | null;
  bondLevel: number;
}

const WAKE_UP_MESSAGES = [
  "I... I can see you again! You came back for me...",
  "You didn't give up on me... I'll never forget this.",
  "The darkness is fading... because of you.",
  "I dreamed of this moment. You're really here.",
  "My heart feels warm again. Thank you for believing in me.",
];

const BOND_MILESTONE_MESSAGES: Record<number, string> = {
  1: "A bond has been renewed.",
  2: "Your connection deepens through adversity.",
  3: "Trust restored through dedication.",
  4: "An unbreakable bond forged through care.",
  5: "A legendary bond — you never abandoned them.",
};

export const WakeUpCelebration = memo(({
  isOpen,
  onClose,
  companionName,
  companionImageUrl,
  dormantImageUrl,
  bondLevel,
}: WakeUpCelebrationProps) => {
  const [showAwakeImage, setShowAwakeImage] = useState(false);
  const [animationStage, setAnimationStage] = useState(0);

  const message = WAKE_UP_MESSAGES[Math.floor(Math.random() * WAKE_UP_MESSAGES.length)];
  const bondMessage = BOND_MILESTONE_MESSAGES[Math.min(5, bondLevel)] || BOND_MILESTONE_MESSAGES[1];

  // Trigger confetti and animation sequence
  useEffect(() => {
    if (!isOpen) {
      setShowAwakeImage(false);
      setAnimationStage(0);
      return;
    }

    // Stage 1: Initial reveal
    const stage1Timer = setTimeout(() => setAnimationStage(1), 500);
    
    // Stage 2: Image transition
    const stage2Timer = setTimeout(() => {
      setShowAwakeImage(true);
      setAnimationStage(2);
      
      // Trigger confetti burst
      const duration = 3000;
      const end = Date.now() + duration;
      
      const colors = ['#FFD700', '#FF69B4', '#00CED1', '#9370DB'];
      
      (function frame() {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors,
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors,
        });
        
        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      })();
    }, 2000);
    
    // Stage 3: Message reveal
    const stage3Timer = setTimeout(() => setAnimationStage(3), 3500);

    return () => {
      clearTimeout(stage1Timer);
      clearTimeout(stage2Timer);
      clearTimeout(stage3Timer);
    };
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="sm:max-w-md bg-gradient-to-br from-slate-900 via-purple-900/50 to-slate-900 border-amber-500/30"
        hideCloseButton
      >
        <div className="flex flex-col items-center py-6 space-y-6">
          {/* Sun rays animation */}
          <motion.div
            className="absolute inset-0 overflow-hidden rounded-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: animationStage >= 1 ? 1 : 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-gradient-radial from-amber-500/20 via-transparent to-transparent"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </motion.div>

          {/* Title */}
          <motion.div
            className="text-center z-10"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: animationStage >= 1 ? 1 : 0, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Sun className="w-8 h-8 text-amber-400 mx-auto mb-2 animate-pulse" />
            <h2 className="text-2xl font-heading font-bold bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent">
              Awakening
            </h2>
          </motion.div>

          {/* Companion Image Transition */}
          <div className="relative w-48 h-48 z-10">
            {/* Dormant image (fades out) */}
            <AnimatePresence>
              {!showAwakeImage && dormantImageUrl && (
                <motion.img
                  src={dormantImageUrl}
                  alt={`Sleeping ${companionName}`}
                  className="absolute inset-0 w-full h-full object-cover rounded-2xl"
                  style={{ filter: 'grayscale(0.5) brightness(0.6)' }}
                  initial={{ opacity: 1, scale: 0.95 }}
                  exit={{ 
                    opacity: 0, 
                    scale: 0.8,
                    filter: 'grayscale(0) brightness(1.5)',
                  }}
                  transition={{ duration: 1 }}
                />
              )}
            </AnimatePresence>

            {/* Awake image (fades in with glow) */}
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ 
                opacity: showAwakeImage ? 1 : 0, 
                scale: showAwakeImage ? 1 : 0.8 
              }}
              transition={{ duration: 1, delay: 0.5 }}
            >
              {/* Glow effect */}
              <motion.div
                className="absolute inset-0 rounded-2xl"
                animate={{
                  boxShadow: [
                    '0 0 20px rgba(255, 215, 0, 0.3)',
                    '0 0 40px rgba(255, 215, 0, 0.5)',
                    '0 0 20px rgba(255, 215, 0, 0.3)',
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <img
                src={companionImageUrl}
                alt={`Awakened ${companionName}`}
                className="w-full h-full object-cover rounded-2xl ring-4 ring-amber-400/50"
              />
              
              {/* Sparkles around the awakened companion */}
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute"
                  style={{
                    top: `${20 + Math.random() * 60}%`,
                    left: `${10 + Math.random() * 80}%`,
                  }}
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0.5, 1, 0.5],
                    y: [0, -10, 0],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.3,
                  }}
                >
                  <Star className="w-4 h-4 text-amber-300" />
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Dialogue */}
          <AnimatePresence>
            {animationStage >= 3 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center space-y-4 z-10 px-4"
              >
                <div className="p-4 rounded-xl bg-muted/20 border border-amber-500/20">
                  <p className="text-foreground/90 italic">"{message}"</p>
                </div>
                
                {/* Bond milestone */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="flex items-center justify-center gap-2 text-amber-400"
                >
                  <Heart className="w-4 h-4" />
                  <span className="text-sm font-medium">{bondMessage}</span>
                </motion.div>

                {/* Memory notification */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                  className="flex items-center justify-center gap-2 text-purple-400 text-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Your companion will remember this moment</span>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Close button */}
          <AnimatePresence>
            {animationStage >= 3 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.5 }}
              >
                <Button
                  onClick={onClose}
                  className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-900 font-bold px-8"
                >
                  Welcome Back
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
});

WakeUpCelebration.displayName = 'WakeUpCelebration';
