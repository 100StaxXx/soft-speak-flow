import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { ChevronRight, Sparkles } from "lucide-react";
import { calculateZodiacSign, getZodiacInfo, type ZodiacSign } from "@/utils/zodiacCalculator";
import { type FactionType } from "./FactionSelector";
import { format } from "date-fns";

// Zodiac images
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

const zodiacTraits: Record<ZodiacSign, string> = {
  aries: "Bold pioneer with unstoppable drive",
  taurus: "Grounded soul with unwavering strength",
  gemini: "Curious mind with endless adaptability",
  cancer: "Intuitive heart with deep emotional wisdom",
  leo: "Radiant leader with magnetic presence",
  virgo: "Precise thinker with healing purpose",
  libra: "Harmonious spirit seeking cosmic balance",
  scorpio: "Intense transformer of hidden depths",
  sagittarius: "Adventurous seeker of universal truth",
  capricorn: "Ambitious builder of lasting legacies",
  aquarius: "Visionary rebel changing the world",
  pisces: "Dreamy mystic connected to all realms",
};

const factionColors: Record<FactionType, string> = {
  starfall: "#FF6600",
  void: "#7F26D9",
  stellar: "#3DB8F5",
};

interface CosmicBirthRevealProps {
  faction: FactionType;
  onComplete: (birthdate: string, zodiacSign: ZodiacSign) => void;
}

export const CosmicBirthReveal = ({ faction, onComplete }: CosmicBirthRevealProps) => {
  const [stage, setStage] = useState<"input" | "revealing" | "revealed">("input");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [zodiacSign, setZodiacSign] = useState<ZodiacSign | null>(null);

  const factionColor = factionColors[faction];

  const handleBirthdateSubmit = () => {
    if (!selectedDate) return;
    
    const sign = calculateZodiacSign(selectedDate);
    setZodiacSign(sign);
    setStage("revealing");
  };

  useEffect(() => {
    if (stage === "revealing") {
      // Auto-progress to revealed after animation
      const timer = setTimeout(() => {
        setStage("revealed");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [stage]);

  const handleContinue = () => {
    if (zodiacSign && selectedDate) {
      onComplete(format(selectedDate, "yyyy-MM-dd"), zodiacSign);
    }
  };

  const zodiacInfo = zodiacSign ? getZodiacInfo(zodiacSign) : null;

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center p-6">
      {/* Animated Background Stars */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(50)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              opacity: [0.2, 1, 0.2],
              scale: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 2 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Input Stage */}
        {stage === "input" && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md z-10"
          >
            <div className="text-center mb-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${factionColor}30` }}
              >
                <Sparkles size={40} style={{ color: factionColor }} />
              </motion.div>
              <motion.h1 
                className="text-3xl font-bold mb-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <span className="bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent">
                  When Did Your Story Begin?
                </span>
              </motion.h1>
              <motion.p 
                className="text-white/70"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                The stars remember the day you arrived
              </motion.p>
            </div>

            <div className="bg-card/60 backdrop-blur-md rounded-2xl p-6 border border-white/15">
              <div className="flex justify-center mb-4">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                  className="rounded-lg pointer-events-auto"
                  captionLayout="dropdown-buttons"
                  fromYear={1930}
                  toYear={new Date().getFullYear()}
                />
              </div>

              {selectedDate && (
                <p className="text-center text-white/70 text-sm mb-4">
                  Your birthdate: <span className="text-white font-semibold">{format(selectedDate, "MMMM d, yyyy")}</span>
                </p>
              )}

              <Button
                onClick={handleBirthdateSubmit}
                disabled={!selectedDate}
                className="w-full py-6 text-lg font-semibold"
                style={{
                  background: selectedDate 
                    ? `linear-gradient(135deg, ${factionColor}, ${factionColor}80)` 
                    : undefined,
                }}
              >
                Reveal My Cosmic Sign
                <ChevronRight className="ml-2" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Revealing Animation */}
        {stage === "revealing" && zodiacSign && (
          <motion.div
            key="revealing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center z-10"
          >
            {/* Constellation Animation */}
            <motion.div
              className="relative w-64 h-64 mx-auto"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1 }}
            >
              {/* Outer Ring */}
              <motion.div
                className="absolute inset-0 rounded-full border-2"
                style={{ borderColor: factionColor }}
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              />
              
              {/* Inner Ring */}
              <motion.div
                className="absolute inset-4 rounded-full border"
                style={{ borderColor: `${factionColor}60` }}
                animate={{ rotate: -360 }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              />

              {/* Zodiac Image */}
              <motion.div
                className="absolute inset-8 rounded-full overflow-hidden"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
              >
                <img
                  src={zodiacImages[zodiacSign]}
                  alt={zodiacSign}
                  className="w-full h-full object-cover"
                />
              </motion.div>

              {/* Sparkle Particles */}
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: factionColor,
                    left: "50%",
                    top: "50%",
                  }}
                  animate={{
                    x: Math.cos((i / 12) * Math.PI * 2) * 140,
                    y: Math.sin((i / 12) * Math.PI * 2) * 140,
                    opacity: [0, 1, 0],
                    scale: [0, 1.5, 0],
                  }}
                  transition={{
                    duration: 2,
                    delay: 1 + i * 0.1,
                    repeat: Infinity,
                  }}
                />
              ))}
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              className="text-white/70 mt-8 text-lg"
            >
              The stars align to reveal...
            </motion.p>
          </motion.div>
        )}

        {/* Revealed State */}
        {stage === "revealed" && zodiacSign && zodiacInfo && (
          <motion.div
            key="revealed"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md z-10 text-center"
          >
            {/* Zodiac Image */}
            <motion.div
              initial={{ y: -20 }}
              animate={{ y: 0 }}
              className="relative w-48 h-48 mx-auto mb-6"
            >
              <div 
                className="absolute inset-0 rounded-full blur-2xl opacity-50"
                style={{ backgroundColor: factionColor }}
              />
              <div className="relative w-full h-full rounded-full overflow-hidden border-4"
                style={{ borderColor: factionColor }}
              >
                <img
                  src={zodiacImages[zodiacSign]}
                  alt={zodiacSign}
                  className="w-full h-full object-cover"
                />
              </div>
            </motion.div>

            {/* Sign Name */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-5xl font-bold text-white mb-2 capitalize"
            >
              {zodiacSign}
            </motion.h1>

            {/* Element & Symbol */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-white/60 text-lg mb-4"
            >
              {zodiacInfo.symbol} • {zodiacInfo.element} Element
            </motion.p>

            {/* Trait Summary */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-card/50 backdrop-blur-sm rounded-xl p-4 mb-8 border border-white/10"
            >
              <p className="text-white text-lg italic">
                "{zodiacTraits[zodiacSign]}"
              </p>
            </motion.div>

            {/* Strengths */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex flex-wrap justify-center gap-2 mb-8"
            >
              {zodiacInfo.strengths.map((strength, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-full text-sm text-white/90"
                  style={{ backgroundColor: `${factionColor}40` }}
                >
                  {strength}
                </span>
              ))}
            </motion.div>

            {/* Continue Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Button
                onClick={handleContinue}
                className="w-full py-6 text-lg font-semibold"
                style={{
                  background: `linear-gradient(135deg, ${factionColor}, ${factionColor}80)`,
                }}
              >
                Continue Your Journey
                <ChevronRight className="ml-2" />
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
