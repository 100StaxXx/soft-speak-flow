import { motion, AnimatePresence } from 'framer-motion';
import { Rocket, Sparkles, ChevronRight } from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useWelcomeImage } from '../hooks/useWelcomeImage';
import campaignWelcomeFallback from '@/assets/campaign-welcome-fallback.webp';

interface CampaignEmptyStateModalProps {
  open: boolean;
  onLaunch: () => void;
}

export function CampaignEmptyStateModal({ open, onLaunch }: CampaignEmptyStateModalProps) {
  const { imageUrl, isLoading } = useWelcomeImage();
  
  const backgroundImage = imageUrl || campaignWelcomeFallback;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-50 flex flex-col"
          style={{ height: '100dvh' }}
        >
          {/* Full-screen background image */}
          <div className="absolute inset-0">
            {/* Loading shimmer effect */}
            {isLoading && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-primary/20 via-purple-500/10 to-pink-500/20"
                animate={{ opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
            
            {/* Background image */}
            <motion.img
              src={backgroundImage}
              alt="Your journey awaits"
              className="w-full h-full object-cover"
              initial={{ scale: 1.1, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
            
            {/* Top gradient overlay for text readability */}
            <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-background/90 via-background/60 to-transparent" />
            
            {/* Bottom gradient overlay for slider */}
            <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-background via-background/80 to-transparent" />
          </div>
          
          {/* Floating particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 rounded-full bg-primary/40"
                initial={{ 
                  x: `${Math.random() * 100}%`, 
                  y: '110%',
                  opacity: 0 
                }}
                animate={{ 
                  y: '-10%',
                  opacity: [0, 0.7, 0],
                }}
                transition={{
                  duration: 5 + Math.random() * 3,
                  repeat: Infinity,
                  delay: i * 0.6,
                  ease: 'easeOut'
                }}
              />
            ))}
          </div>
          
          {/* Content container with safe areas */}
          <div className="relative flex flex-col h-full pt-safe-top pb-safe-bottom">
            {/* Header text */}
            <motion.div 
              className="flex-shrink-0 pt-16 px-6 text-center"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <motion.h1 
                className="text-3xl font-bold text-foreground tracking-wide"
                animate={{ opacity: [0.85, 1, 0.85] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                Your Journey Awaits...
              </motion.h1>
              <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                Forge your path through personalized adventures and transform your goals into epic quests
              </p>
            </motion.div>
            
            {/* Spacer to push slider to bottom */}
            <div className="flex-1" />
            
            {/* Drag-to-Launch slider */}
            <motion.div 
              className="flex-shrink-0 px-6 pb-28"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <div className="relative w-full max-w-xs mx-auto">
                <div className="relative h-16 rounded-full bg-gradient-to-r from-muted/60 via-primary/15 to-primary/40 border border-primary/30 overflow-hidden flex items-center px-1.5 backdrop-blur-sm">
                  {/* Shimmer animation */}
                  <motion.div 
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/15 to-transparent"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  
                  {/* Draggable rocket */}
                  <motion.div
                    drag="x"
                    dragConstraints={{ left: 0, right: 200 }}
                    dragElastic={0.1}
                    onDragStart={() => {
                      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
                    }}
                    onDragEnd={(_, info) => {
                      if (info.offset.x > 140) {
                        Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
                        onLaunch();
                      }
                    }}
                    whileDrag={{ scale: 1.15 }}
                    whileHover={{ scale: 1.05 }}
                    className="relative w-13 h-13 rounded-full bg-gradient-to-br from-primary via-purple-500 to-pink-500 flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg shadow-primary/50 z-10"
                    style={{ width: 52, height: 52 }}
                  >
                    <Rocket className="w-6 h-6 text-white -rotate-[22deg]" />
                  </motion.div>
                  
                  {/* Destination indicator */}
                  <motion.div 
                    className="ml-auto pr-3 flex items-center gap-1.5 text-primary/60"
                    animate={{ opacity: [0.4, 0.9, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <ChevronRight className="w-5 h-5" />
                    <Sparkles className="w-5 h-5" />
                  </motion.div>
                </div>
                
                <motion.p 
                  className="text-xs text-muted-foreground/70 text-center mt-3"
                  animate={{ opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  Drag to launch your adventure
                </motion.p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}