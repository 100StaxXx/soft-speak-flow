import { useState } from "react";
import { motion } from "framer-motion";
import { type ZodiacSign } from "@/utils/zodiacCalculator";
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

interface ZodiacSelectorProps {
  onComplete: (zodiacSign: ZodiacSign) => void;
}

const zodiacSigns = [
  { sign: "aries" as ZodiacSign, name: "Aries", dates: "March 21 - April 19" },
  { sign: "taurus" as ZodiacSign, name: "Taurus", dates: "April 20 - May 20" },
  { sign: "gemini" as ZodiacSign, name: "Gemini", dates: "May 21 - June 20" },
  { sign: "cancer" as ZodiacSign, name: "Cancer", dates: "June 21 - July 22" },
  { sign: "leo" as ZodiacSign, name: "Leo", dates: "July 23 - Aug 22" },
  { sign: "virgo" as ZodiacSign, name: "Virgo", dates: "Aug 23 - Sep 22" },
  { sign: "libra" as ZodiacSign, name: "Libra", dates: "Sep 23 - Oct 22" },
  { sign: "scorpio" as ZodiacSign, name: "Scorpio", dates: "Oct 23 - Nov 21" },
  { sign: "sagittarius" as ZodiacSign, name: "Sagittarius", dates: "Nov 22 - Dec 21" },
  { sign: "capricorn" as ZodiacSign, name: "Capricorn", dates: "Dec 22 - Jan 19" },
  { sign: "aquarius" as ZodiacSign, name: "Aquarius", dates: "Jan 20 - Feb 18" },
  { sign: "pisces" as ZodiacSign, name: "Pisces", dates: "Feb 19 - March 20" },
];

export const ZodiacSelector = ({ onComplete }: ZodiacSelectorProps) => {
  const [selectedZodiac, setSelectedZodiac] = useState<ZodiacSign | null>(null);

  const handleSelect = (sign: ZodiacSign) => {
    setSelectedZodiac(sign);
    // Auto-progress after selection
    setTimeout(() => {
      onComplete(sign);
    }, 600); // Small delay for visual feedback
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4 md:p-8 z-10">

      <div className="relative z-10 w-full max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8 md:mb-12"
        >
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-3 tracking-tight">
            The 12 Astrological Zodiac Signs
          </h1>
          <p className="text-purple-200/80 text-base md:text-lg">
            Select your celestial constellation
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6 mb-8">
          {zodiacSigns.map((zodiac, index) => (
            <motion.button
              key={zodiac.sign}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelect(zodiac.sign)}
              className={`group relative h-48 md:h-64 rounded-2xl overflow-hidden transition-all duration-300 ${
                selectedZodiac === zodiac.sign
                  ? 'ring-4 ring-yellow-400 shadow-[0_0_40px_rgba(234,179,8,0.6)]'
                  : 'ring-2 ring-white/20 hover:ring-white/40'
              }`}
            >
              {/* Background Image */}
              <div className="absolute inset-0">
                <img 
                  src={zodiacImages[zodiac.sign]} 
                  alt={zodiac.name}
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              
              {/* Glow effect on selection */}
              {selectedZodiac === zodiac.sign && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-br from-yellow-400/30 to-purple-500/30"
                  animate={{
                    opacity: [0.3, 0.6, 0.3],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                  }}
                />
              )}

              <div className="relative z-10 h-full flex flex-col justify-end p-4">
                {/* Sign name */}
                <h3 className={`text-xl md:text-2xl font-bold mb-1 transition-colors duration-300 ${
                  selectedZodiac === zodiac.sign ? 'text-yellow-300' : 'text-white'
                }`}>
                  {zodiac.name}
                </h3>
                
                {/* Dates */}
                <p className="text-xs md:text-sm text-white/90">
                  {zodiac.dates}
                </p>
              </div>

              {/* Sparkle animations on selection */}
              {selectedZodiac === zodiac.sign && (
                <>
                  {[...Array(12)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-1.5 h-1.5 bg-yellow-300 rounded-full"
                      style={{
                        left: `${15 + Math.random() * 70}%`,
                        top: `${15 + Math.random() * 70}%`,
                      }}
                      animate={{
                        opacity: [0, 1, 0],
                        scale: [0, 2.5, 0],
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        delay: i * 0.1,
                      }}
                    />
                  ))}
                </>
              )}
            </motion.button>
          ))}
        </div>

      </div>
    </div>
  );
};
