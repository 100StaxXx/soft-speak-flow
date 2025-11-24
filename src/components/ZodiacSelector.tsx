import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { type ZodiacSign } from "@/utils/zodiacCalculator";

interface ZodiacSelectorProps {
  onComplete: (zodiacSign: ZodiacSign) => void;
}

const zodiacSigns = [
  { sign: "aries" as ZodiacSign, symbol: "♈", name: "Aries", dates: "March 21 - April 20" },
  { sign: "taurus" as ZodiacSign, symbol: "♉", name: "Taurus", dates: "April 21 - May 20" },
  { sign: "gemini" as ZodiacSign, symbol: "♊", name: "Gemini", dates: "May 21 - June 20" },
  { sign: "cancer" as ZodiacSign, symbol: "♋", name: "Cancer", dates: "June 21 - July 22" },
  { sign: "leo" as ZodiacSign, symbol: "♌", name: "Leo", dates: "July 23 - Aug 22" },
  { sign: "virgo" as ZodiacSign, symbol: "♍", name: "Virgo", dates: "Aug 23 - Sep 22" },
  { sign: "libra" as ZodiacSign, symbol: "♎", name: "Libra", dates: "Sep 23 - Nov 22" },
  { sign: "scorpio" as ZodiacSign, symbol: "♏", name: "Scorpio", dates: "Oct 23 - Nov 22" },
  { sign: "sagittarius" as ZodiacSign, symbol: "♐", name: "Sagittarius", dates: "Nov 23 - Dec 21" },
  { sign: "capricorn" as ZodiacSign, symbol: "♑", name: "Capricorn", dates: "Dec 22 - Jan 19" },
  { sign: "aquarius" as ZodiacSign, symbol: "♒", name: "Aquarius", dates: "Jan 20 - Feb 19" },
  { sign: "pisces" as ZodiacSign, symbol: "♓", name: "Pisces", dates: "Feb 20 - March 20" },
];

export const ZodiacSelector = ({ onComplete }: ZodiacSelectorProps) => {
  const [selectedZodiac, setSelectedZodiac] = useState<ZodiacSign | null>(null);

  const handleSelect = (sign: ZodiacSign) => {
    setSelectedZodiac(sign);
  };

  const handleContinue = () => {
    if (selectedZodiac) {
      onComplete(selectedZodiac);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-950 to-slate-900 relative overflow-hidden flex items-center justify-center p-4 md:p-8">
      {/* Cosmic stars background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(100)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.7 + 0.3,
            }}
            animate={{
              opacity: [0.3, 1, 0.3],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 2 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

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
              className={`relative p-4 md:p-6 rounded-xl backdrop-blur-sm transition-all duration-300 ${
                selectedZodiac === zodiac.sign
                  ? 'bg-purple-500/30 border-2 border-yellow-400 shadow-[0_0_30px_rgba(234,179,8,0.5)]'
                  : 'bg-white/5 border border-white/20 hover:bg-white/10 hover:border-white/40'
              }`}
            >
              {/* Glow effect on selection */}
              {selectedZodiac === zodiac.sign && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 to-purple-500/20 rounded-xl"
                  animate={{
                    opacity: [0.3, 0.6, 0.3],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                  }}
                />
              )}

              <div className="relative z-10 flex flex-col items-center gap-2">
                {/* Symbol */}
                <div className={`text-5xl md:text-7xl transition-all duration-300 ${
                  selectedZodiac === zodiac.sign ? 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]' : 'text-white/90'
                }`}>
                  {zodiac.symbol}
                </div>
                
                {/* Sign name */}
                <h3 className={`text-lg md:text-xl font-bold transition-colors duration-300 ${
                  selectedZodiac === zodiac.sign ? 'text-yellow-300' : 'text-white'
                }`}>
                  {zodiac.name}
                </h3>
                
                {/* Dates */}
                <p className="text-xs md:text-sm text-white/80">
                  {zodiac.dates}
                </p>
              </div>

              {/* Sparkle animations on selection */}
              {selectedZodiac === zodiac.sign && (
                <>
                  {[...Array(8)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-1 h-1 bg-yellow-300 rounded-full"
                      style={{
                        left: `${15 + Math.random() * 70}%`,
                        top: `${15 + Math.random() * 70}%`,
                      }}
                      animate={{
                        opacity: [0, 1, 0],
                        scale: [0, 2, 0],
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        delay: i * 0.15,
                      }}
                    />
                  ))}
                </>
              )}
            </motion.button>
          ))}
        </div>

        {selectedZodiac && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <Button
              onClick={handleContinue}
              size="lg"
              className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-purple-950 font-bold px-10 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Continue Your Journey ✨
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
};