import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { getZodiacInfo, type ZodiacSign } from "@/utils/zodiacCalculator";
import ariesImg from "@/assets/zodiac-aries.png";
import taurusImg from "@/assets/zodiac-taurus.png";
import geminiImg from "@/assets/zodiac-gemini.png";
import cancerImg from "@/assets/zodiac-cancer.png";
import leoImg from "@/assets/zodiac-leo.png";
import virgoImg from "@/assets/zodiac-virgo.png";
import libraImg from "@/assets/zodiac-libra.png";
import scorpioImg from "@/assets/zodiac-scorpio.png";
import sagittariusImg from "@/assets/zodiac-sagittarius.png";
import capricornImg from "@/assets/zodiac-capricorn.png";
import aquariusImg from "@/assets/zodiac-aquarius.png";
import piscesImg from "@/assets/zodiac-pisces.png";

const zodiacImages: Record<ZodiacSign, string> = {
  aries: ariesImg,
  taurus: taurusImg,
  gemini: geminiImg,
  cancer: cancerImg,
  leo: leoImg,
  virgo: virgoImg,
  libra: libraImg,
  scorpio: scorpioImg,
  sagittarius: sagittariusImg,
  capricorn: capricornImg,
  aquarius: aquariusImg,
  pisces: piscesImg,
};

interface ZodiacRevealProps {
  zodiacSign: ZodiacSign;
  mentorName: string;
  onComplete: () => void;
}

export const ZodiacReveal = ({ zodiacSign, mentorName, onComplete }: ZodiacRevealProps) => {
  const [stage, setStage] = useState<'constellation' | 'symbol' | 'reading' | 'complete'>('constellation');
  const zodiacInfo = getZodiacInfo(zodiacSign);

  useEffect(() => {
    const timer1 = setTimeout(() => setStage('symbol'), 3000);
    const timer2 = setTimeout(() => setStage('reading'), 6000);
    const timer3 = setTimeout(() => setStage('complete'), 9000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [zodiacSign]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-purple-950 via-indigo-950 to-slate-950">
      {/* Enhanced cosmic background with multiple star layers */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Large glowing stars */}
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={`star-${i}`}
            className="absolute w-2 h-2 bg-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              opacity: [0.2, 1, 0.2],
              scale: [0.8, 1.3, 0.8],
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
        
        {/* Small twinkling stars */}
        {[...Array(100)].map((_, i) => (
          <motion.div
            key={`twinkle-${i}`}
            className="absolute w-px h-px bg-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: Math.random() * 2 + 1,
              repeat: Infinity,
              delay: Math.random() * 3,
            }}
          />
        ))}

        {/* Shooting stars */}
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={`shooting-${i}`}
            className="absolute h-px w-20 bg-gradient-to-r from-transparent via-yellow-200 to-transparent"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 50}%`,
            }}
            animate={{
              x: [-100, 300],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: i * 3 + Math.random() * 5,
              repeatDelay: 10,
            }}
          />
        ))}

        {/* Cosmic dust particles */}
        {[...Array(40)].map((_, i) => (
          <motion.div
            key={`dust-${i}`}
            className="absolute w-1 h-1 rounded-full bg-purple-300/30"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [-20, 20],
              x: [-10, 10],
              opacity: [0.1, 0.4, 0.1],
            }}
            transition={{
              duration: Math.random() * 5 + 3,
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
            {/* Mystical circle with image */}
            <motion.div
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 1.8, ease: "easeOut" }}
              className="relative mb-6 mx-auto w-80 h-80"
            >
              {/* Outer glowing ring */}
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-yellow-400/40"
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.4, 0.8, 0.4],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                }}
              />
              
              {/* Middle ring with particles */}
              <div className="absolute inset-0 rounded-full">
                {[...Array(12)].map((_, i) => {
                  const angle = (i * 360) / 12;
                  const radius = 160;
                  const x = radius * Math.cos((angle * Math.PI) / 180);
                  const y = radius * Math.sin((angle * Math.PI) / 180);
                  
                  return (
                    <motion.div
                      key={i}
                      className="absolute w-2 h-2 bg-yellow-300 rounded-full"
                      style={{
                        left: '50%',
                        top: '50%',
                      }}
                      animate={{
                        x: [0, x, 0],
                        y: [0, y, 0],
                        opacity: [0, 1, 0],
                        scale: [0, 1.5, 0],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        delay: i * 0.25,
                      }}
                    />
                  );
                })}
              </div>

              {/* Central image with glow */}
              <div className="absolute inset-8 rounded-full overflow-hidden">
                <motion.div
                  className="absolute inset-0 bg-gradient-to-br from-purple-600/30 to-indigo-600/30 blur-2xl"
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.3, 0.6, 0.3],
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                  }}
                />
                
                <img 
                  src={zodiacImages[zodiacSign]} 
                  alt={zodiacInfo.symbol}
                  className="relative w-full h-full object-cover opacity-90"
                />
              </div>

              {/* Sparkle effects around the circle */}
              {[...Array(20)].map((_, i) => {
                const angle = (i * 360) / 20;
                const radius = 160;
                const x = radius * Math.cos((angle * Math.PI) / 180);
                const y = radius * Math.sin((angle * Math.PI) / 180);
                
                return (
                  <motion.div
                    key={`sparkle-${i}`}
                    className="absolute w-1 h-1 bg-yellow-200 rounded-full"
                    style={{
                      left: '50%',
                      top: '50%',
                    }}
                    animate={{
                      x: [x * 0.8, x, x * 0.8],
                      y: [y * 0.8, y, y * 0.8],
                      opacity: [0, 1, 0],
                      scale: [0, 2, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: i * 0.1,
                    }}
                  />
                );
              })}
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              className="text-2xl font-bold text-purple-300 uppercase tracking-wider"
            >
              Awakening...
            </motion.p>
          </motion.div>
        )}

        {stage === 'symbol' && (
          <motion.div
            key="symbol"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            className="text-center z-10 max-w-2xl px-4"
          >
            {/* Large Image Display */}
            <div className="relative mb-8 mx-auto max-w-sm">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative"
              >
                {/* Glowing aura */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-br from-purple-500/40 to-yellow-500/40 rounded-full blur-3xl"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.4, 0.7, 0.4],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                  }}
                />
                
                <div className="relative w-80 h-80 mx-auto rounded-full overflow-hidden border-4 border-yellow-400/50 shadow-[0_0_60px_rgba(234,179,8,0.4)]">
                  <img 
                    src={zodiacImages[zodiacSign]} 
                    alt={zodiacInfo.symbol}
                    className="w-full h-full object-cover"
                  />
                </div>
              </motion.div>
            </div>

            {/* Zodiac name with elegant styling */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-6"
            >
              <h2 className="text-5xl md:text-6xl font-bold capitalize text-white mb-2 tracking-tight">
                {zodiacInfo.sign}
              </h2>
              <p className="text-purple-300 text-lg">{zodiacInfo.dates}</p>
            </motion.div>

            {/* Strength traits with enhanced styling */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-wrap justify-center gap-3 mb-4"
            >
              {zodiacInfo.strengths.map((strength, i) => (
                <motion.span
                  key={strength}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 + i * 0.15 }}
                  className="px-6 py-2 rounded-full bg-gradient-to-r from-purple-600/30 to-indigo-600/30 border border-yellow-400/40 text-sm font-medium text-white backdrop-blur-sm"
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
            {/* Smaller image with glow ring */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="mx-auto mb-6 relative w-40 h-40"
            >
              {/* Rotating glow ring */}
              <motion.div
                className="absolute inset-0 border-2 border-yellow-400/50 rounded-full"
                animate={{
                  rotate: 360,
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                  scale: { duration: 2, repeat: Infinity },
                }}
              />
              
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-yellow-600/20 rounded-full blur-xl" />
              
              <div className="absolute inset-4 rounded-full overflow-hidden border-2 border-purple-400/50">
                <img 
                  src={zodiacImages[zodiacSign]} 
                  alt={zodiacInfo.symbol}
                  className="w-full h-full object-cover"
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mb-8"
            >
              <h3 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-purple-300 via-yellow-300 to-purple-300 bg-clip-text text-transparent uppercase tracking-wide">
                The Stars Have Aligned
              </h3>
              
              <div className="space-y-6 text-lg text-white/90">
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  Born under the sign of <span className="text-yellow-300 font-bold capitalize">{zodiacInfo.sign}</span>, you carry the energy of {zodiacInfo.element}.
                </motion.p>
                
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="text-white/80"
                >
                  Your {zodiacInfo.strengths.join(", ")} nature resonates perfectly with <span className="text-purple-300 font-bold">{mentorName}</span>'s guidance.
                </motion.p>
                
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1 }}
                  className="text-base italic text-purple-200/80"
                >
                  Together, you'll forge a path of growth and transformation.
                </motion.p>
              </div>
            </motion.div>

            {stage === 'complete' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 }}
              >
                <Button
                  onClick={onComplete}
                  size="lg"
                  className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-bold px-10 py-6 text-lg rounded-full shadow-[0_0_30px_rgba(168,85,247,0.5)] hover:shadow-[0_0_40px_rgba(168,85,247,0.7)] transition-all duration-300 group border border-purple-400/30"
                >
                  <Sparkles className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
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