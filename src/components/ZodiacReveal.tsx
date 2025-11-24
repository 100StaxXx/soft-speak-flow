import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { getZodiacInfo, type ZodiacSign } from "@/utils/zodiacCalculator";

interface ZodiacRevealProps {
  zodiacSign: ZodiacSign;
  mentorName: string;
  onComplete: () => void;
}

export const ZodiacReveal = ({ zodiacSign, mentorName, onComplete }: ZodiacRevealProps) => {
  const [stage, setStage] = useState<'constellation' | 'symbol' | 'reading' | 'complete'>('constellation');
  const zodiacInfo = getZodiacInfo(zodiacSign);

  useEffect(() => {
    const timer1 = setTimeout(() => setStage('symbol'), 2000);
    const timer2 = setTimeout(() => setStage('reading'), 4000);
    const timer3 = setTimeout(() => setStage('complete'), 7000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-background via-primary/5 to-accent/10">
      {/* Cosmic background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(50)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-primary/30 rounded-full"
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
              opacity: 0
            }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0, 1, 0],
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {stage === 'constellation' && (
          <motion.div
            key="constellation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center z-10"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="relative"
            >
              <div className={`text-9xl ${zodiacInfo.gradient} bg-gradient-to-br bg-clip-text text-transparent`}>
                {zodiacInfo.symbol}
              </div>
              {/* Pulsing glow effect */}
              <motion.div
                className={`absolute inset-0 blur-3xl ${zodiacInfo.gradient} bg-gradient-to-br opacity-30`}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.5, 0.3],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                }}
              />
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="text-xl text-muted-foreground mt-6"
            >
              {zodiacInfo.constellation}
            </motion.p>
          </motion.div>
        )}

        {stage === 'symbol' && (
          <motion.div
            key="symbol"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            className="text-center z-10 max-w-2xl"
          >
            <motion.div
              animate={{
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
              }}
              className="mb-8"
            >
              <div className={`text-8xl ${zodiacInfo.gradient} bg-gradient-to-br bg-clip-text text-transparent mb-4`}>
                {zodiacInfo.symbol}
              </div>
              <h2 className="text-4xl font-bold capitalize bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {zodiacInfo.sign}
              </h2>
              <p className="text-muted-foreground mt-2">{zodiacInfo.dates}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-wrap justify-center gap-3"
            >
              {zodiacInfo.strengths.map((strength, i) => (
                <motion.span
                  key={strength}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 + i * 0.1 }}
                  className="px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium"
                >
                  {strength}
                </motion.span>
              ))}
            </motion.div>
          </motion.div>
        )}

        {(stage === 'reading' || stage === 'complete') && (
          <motion.div
            key="reading"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center z-10 max-w-2xl px-4"
          >
            <div className={`text-6xl ${zodiacInfo.gradient} bg-gradient-to-br bg-clip-text text-transparent mb-6`}>
              {zodiacInfo.symbol}
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mb-8"
            >
              <h3 className="text-3xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                The Stars Have Aligned
              </h3>
              <div className="space-y-4 text-lg text-muted-foreground">
                <p>
                  Born under the sign of <span className="text-primary font-semibold capitalize">{zodiacInfo.sign}</span>, 
                  you carry the energy of {zodiacInfo.element}.
                </p>
                <p>
                  Your {zodiacInfo.strengths.join(", ")} nature resonates perfectly 
                  with <span className="text-accent font-semibold">{mentorName}</span>'s guidance.
                </p>
                <p className="text-sm italic">
                  Together, you'll forge a path of growth and transformation.
                </p>
              </div>
            </motion.div>

            {stage === 'complete' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Button
                  onClick={onComplete}
                  size="lg"
                  className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity group"
                >
                  <Sparkles className="w-4 h-4 mr-2 group-hover:rotate-12 transition-transform" />
                  Begin Your Journey
                </Button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};