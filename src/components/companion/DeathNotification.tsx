import { memo, useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Heart, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DeathNotificationProps {
  isOpen: boolean;
  onClose: () => void;
  companionName?: string;
  spiritAnimal: string;
  daysTogether: number;
}

export const DeathNotification = memo(({
  isOpen,
  onClose,
  companionName,
  spiritAnimal,
  daysTogether,
}: DeathNotificationProps) => {
  const [showContent, setShowContent] = useState(false);
  const displayName = companionName || `Your ${spiritAnimal}`;

  useEffect(() => {
    if (isOpen) {
      // Delay content appearance for dramatic effect
      const timer = setTimeout(() => setShowContent(true), 500);
      return () => clearTimeout(timer);
    } else {
      setShowContent(false);
    }
  }, [isOpen]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent 
        className="max-w-md bg-background/95 backdrop-blur-xl border-muted/30 p-0 overflow-hidden"
        hideCloseButton
      >
        {/* Dark overlay with particles */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/10 to-background" />
        
        {/* Ascending soul particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1.5 h-1.5 bg-primary/30 rounded-full blur-sm"
              initial={{ 
                x: `${20 + Math.random() * 60}%`, 
                y: '100%',
                opacity: 0,
                scale: 0,
              }}
              animate={{ 
                y: '-10%',
                opacity: [0, 0.8, 0],
                scale: [0, 1, 0.5],
              }}
              transition={{
                duration: 5 + Math.random() * 3,
                repeat: Infinity,
                delay: i * 0.6,
                ease: 'easeOut',
              }}
            />
          ))}
        </div>

        <AnimatePresence>
          {showContent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1 }}
              className="relative p-8 space-y-6 text-center"
            >
              {/* Broken Heart Icon */}
              <motion.div
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
                className="mx-auto w-20 h-20 rounded-full bg-muted/20 flex items-center justify-center"
              >
                <Heart className="w-10 h-10 text-destructive/60 fill-destructive/20" />
              </motion.div>

              {/* Title */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="space-y-2"
              >
                <h2 className="text-xl font-heading font-medium text-muted-foreground">
                  A bond has been broken
                </h2>
                <p className="text-2xl font-heading font-bold text-foreground">
                  {displayName} has passed away
                </p>
              </motion.div>

              {/* Message */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="space-y-3"
              >
                <p className="text-muted-foreground leading-relaxed">
                  After {daysTogether} days together, your companion could no longer wait.
                  The neglect was too much to bear.
                </p>
                <p className="text-sm text-muted-foreground/70 italic">
                  "I waited... but you never came back."
                </p>
              </motion.div>

              {/* Continue Button */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
              >
                <Button
                  onClick={onClose}
                  variant="ghost"
                  className="w-full text-muted-foreground hover:text-foreground hover:bg-muted/20"
                >
                  <Sparkles className="w-4 h-4 mr-2 opacity-50" />
                  Continue
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
});

DeathNotification.displayName = 'DeathNotification';
