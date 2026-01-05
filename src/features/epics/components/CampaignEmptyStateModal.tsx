import { memo, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Rocket, Sparkles, ChevronRight } from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useWelcomeImage } from '../hooks/useWelcomeImage';
import { useDeviceOrientation } from '@/hooks/useDeviceOrientation';
import campaignWelcomeFallback from '@/assets/campaign-welcome-fallback.webp';

interface CampaignEmptyStateModalProps {
  open: boolean;
  onLaunch: () => void;
}

export const CampaignEmptyStateModal = memo(function CampaignEmptyStateModal({ open, onLaunch }: CampaignEmptyStateModalProps) {
  const { imageUrl, isLoading } = useWelcomeImage();
  const { gamma, beta, permitted, available, requestPermission } = useDeviceOrientation();
  
  const backgroundImage = imageUrl || campaignWelcomeFallback;
  
  // Skip animation if image is already cached (instant load)
  const isCached = !isLoading && !!imageUrl;
  
  // Calculate parallax offset from device orientation
  const gyroX = permitted ? (gamma / 45) * 15 : 0; // Max 15px X movement
  const gyroY = permitted ? ((beta - 45) / 45) * 10 : 0; // Max 10px Y movement
  
  // Request gyroscope permission on touch (required for iOS)
  const handleInteraction = useCallback(() => {
    if (available && !permitted) {
      requestPermission();
    }
  }, [available, permitted, requestPermission]);
  
  // Track drag position for reactive effects
  const dragX = useMotionValue(0);
  
  // Create reactive transforms based on drag position
  const rocketRotation = useTransform(dragX, [0, 200], [-22, 45]); // Rotate as it moves right
  const trailWidth = useTransform(dragX, [0, 200], [0, 180]); // Trail grows behind rocket
  const trailOpacity = useTransform(dragX, [0, 50, 200], [0, 0.6, 0.9]); // Trail fades in
  const rocketGlow = useTransform(
    dragX, 
    [0, 100, 200], 
    [
      '0 0 15px rgba(168, 85, 247, 0.5)',
      '0 0 25px rgba(168, 85, 247, 0.7)',
      '0 0 40px rgba(168, 85, 247, 0.9), 0 0 60px rgba(236, 72, 153, 0.5)'
    ]
  );
  
  // Sparkle effects - each appears progressively
  const sparkleOpacities = [
    useTransform(dragX, [30, 60], [0, 0.8]),
    useTransform(dragX, [50, 80], [0, 0.8]),
    useTransform(dragX, [70, 100], [0, 0.8]),
    useTransform(dragX, [90, 120], [0, 0.8]),
    useTransform(dragX, [110, 140], [0, 0.8]),
  ];
  const sparkleScales = [
    useTransform(dragX, [30, 60, 120], [0, 1, 0.5]),
    useTransform(dragX, [50, 80, 140], [0, 1, 0.5]),
    useTransform(dragX, [70, 100, 160], [0, 1, 0.5]),
    useTransform(dragX, [90, 120, 180], [0, 1, 0.5]),
    useTransform(dragX, [110, 140, 200], [0, 1, 0.5]),
  ];

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
          onTouchStart={handleInteraction}
          onClick={handleInteraction}
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
            
            {/* Background image with parallax - skip animation if cached */}
            <motion.img
              src={backgroundImage}
              alt="Your journey awaits"
              className="w-full h-full object-cover"
              initial={isCached ? false : { scale: 1.15, opacity: 0 }}
              animate={{ 
                scale: 1.1, // Slight overscale for parallax room
                opacity: 1,
                x: gyroX,
                y: gyroY,
              }}
              transition={{ 
                scale: { duration: 0.8, ease: 'easeOut' },
                opacity: { duration: 0.8, ease: 'easeOut' },
                x: { type: "spring", stiffness: 100, damping: 30, mass: 0.5 },
                y: { type: "spring", stiffness: 100, damping: 30, mass: 0.5 },
              }}
            />
            
            {/* Top gradient overlay for text readability */}
            <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-background/90 via-background/60 to-transparent" />
            
            {/* Bottom gradient overlay for slider */}
            <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-background via-background/80 to-transparent" />
          </div>
          
          {/* Floating particles - reduced from 12 to 6 */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 rounded-full bg-primary/40"
                initial={{ 
                  x: `${(i * 16.66) + 8}%`, 
                  y: '110%',
                  opacity: 0 
                }}
                animate={{ 
                  y: '-10%',
                  opacity: [0, 0.7, 0],
                }}
                transition={{
                  duration: 6 + (i % 3),
                  repeat: Infinity,
                  delay: i * 1.2,
                  ease: 'easeOut'
                }}
              />
            ))}
          </div>
          
          {/* Content container with safe areas */}
          <div className="relative flex flex-col h-full pt-safe-top pb-safe-bottom">
            {/* Header text */}
            <motion.div 
              className="flex-shrink-0 pt-24 px-6 text-center"
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
              className="flex-shrink-0 px-6 pb-40"
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
                  
                  {/* Trail behind rocket */}
                  <motion.div 
                    className="absolute left-1.5 top-1/2 -translate-y-1/2 h-10 rounded-full bg-gradient-to-r from-primary/60 via-purple-500/40 to-transparent"
                    style={{ 
                      width: trailWidth,
                      opacity: trailOpacity,
                    }}
                  />
                  
                  {/* Position-based sparkles */}
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-1.5 h-1.5 rounded-full bg-primary"
                      style={{
                        left: 56 + (i * 28),
                        top: `${50 + (i % 2 === 0 ? -8 : 8)}%`,
                        opacity: sparkleOpacities[i],
                        scale: sparkleScales[i],
                      }}
                    />
                  ))}
                  
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
                    className="relative w-13 h-13 rounded-full bg-gradient-to-br from-primary via-purple-500 to-pink-500 flex items-center justify-center cursor-grab active:cursor-grabbing z-10"
                    style={{ 
                      x: dragX, 
                      width: 52, 
                      height: 52,
                      boxShadow: rocketGlow,
                    }}
                  >
                    <motion.div style={{ rotate: rocketRotation }}>
                      <Rocket className="w-6 h-6 text-white" />
                    </motion.div>
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
});