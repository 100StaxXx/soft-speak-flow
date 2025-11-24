import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { type ZodiacSign } from "@/utils/zodiacCalculator";

interface ZodiacSelectorProps {
  onComplete: (zodiacSign: ZodiacSign) => void;
}

const zodiacSigns = [
  { sign: "aries" as ZodiacSign, symbol: "♈", name: "Aries", dates: "Mar 21 - Apr 19", gradient: "from-red-500 to-orange-500", element: "Fire" },
  { sign: "taurus" as ZodiacSign, symbol: "♉", name: "Taurus", dates: "Apr 20 - May 20", gradient: "from-green-600 to-emerald-500", element: "Earth" },
  { sign: "gemini" as ZodiacSign, symbol: "♊", name: "Gemini", dates: "May 21 - Jun 20", gradient: "from-yellow-500 to-amber-400", element: "Air" },
  { sign: "cancer" as ZodiacSign, symbol: "♋", name: "Cancer", dates: "Jun 21 - Jul 22", gradient: "from-blue-400 to-cyan-400", element: "Water" },
  { sign: "leo" as ZodiacSign, symbol: "♌", name: "Leo", dates: "Jul 23 - Aug 22", gradient: "from-orange-500 to-yellow-500", element: "Fire" },
  { sign: "virgo" as ZodiacSign, symbol: "♍", name: "Virgo", dates: "Aug 23 - Sep 22", gradient: "from-emerald-500 to-teal-500", element: "Earth" },
  { sign: "libra" as ZodiacSign, symbol: "♎", name: "Libra", dates: "Sep 23 - Oct 22", gradient: "from-pink-400 to-rose-400", element: "Air" },
  { sign: "scorpio" as ZodiacSign, symbol: "♏", name: "Scorpio", dates: "Oct 23 - Nov 21", gradient: "from-purple-600 to-indigo-600", element: "Water" },
  { sign: "sagittarius" as ZodiacSign, symbol: "♐", name: "Sagittarius", dates: "Nov 22 - Dec 21", gradient: "from-purple-500 to-violet-500", element: "Fire" },
  { sign: "capricorn" as ZodiacSign, symbol: "♑", name: "Capricorn", dates: "Dec 22 - Jan 19", gradient: "from-slate-600 to-gray-600", element: "Earth" },
  { sign: "aquarius" as ZodiacSign, symbol: "♒", name: "Aquarius", dates: "Jan 20 - Feb 18", gradient: "from-cyan-500 to-blue-500", element: "Air" },
  { sign: "pisces" as ZodiacSign, symbol: "♓", name: "Pisces", dates: "Feb 19 - Mar 20", gradient: "from-indigo-400 to-purple-400", element: "Water" },
];

export const ZodiacSelector = ({ onComplete }: ZodiacSelectorProps) => {
  const [selectedZodiac, setSelectedZodiac] = useState<ZodiacSign | null>(null);
  const [hoveredZodiac, setHoveredZodiac] = useState<string | null>(null);

  const handleSelect = (sign: ZodiacSign) => {
    setSelectedZodiac(sign);
  };

  const handleContinue = () => {
    if (selectedZodiac) {
      onComplete(selectedZodiac);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5 relative overflow-hidden">
      {/* Cosmic background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-primary/20 rounded-full"
            initial={{
              x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1920),
              y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1080),
              opacity: 0
            }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0, 1.5, 0],
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-5xl relative z-10"
      >
        <Card className="p-8 bg-card/80 backdrop-blur-xl border-primary/20 shadow-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 mb-6">
              <Sparkles className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-3">
              Choose Your Zodiac Sign
            </h2>
            <p className="text-muted-foreground text-lg">
              The stars have aligned—select your celestial guide
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-8"
          >
            {zodiacSigns.map((zodiac, index) => (
              <motion.div
                key={zodiac.sign}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + index * 0.05 }}
                onHoverStart={() => setHoveredZodiac(zodiac.sign)}
                onHoverEnd={() => setHoveredZodiac(null)}
                onClick={() => handleSelect(zodiac.sign)}
                className="relative cursor-pointer group"
              >
                <div
                  className={`
                    relative p-6 rounded-2xl border-2 transition-all duration-300
                    ${selectedZodiac === zodiac.sign 
                      ? `border-transparent bg-gradient-to-br ${zodiac.gradient} shadow-lg scale-105` 
                      : 'border-primary/20 bg-card/50 hover:border-primary/40 hover:scale-105'
                    }
                  `}
                >
                  {/* Glow effect on hover and selection */}
                  {(hoveredZodiac === zodiac.sign || selectedZodiac === zodiac.sign) && (
                    <motion.div
                      className={`absolute inset-0 blur-xl bg-gradient-to-br ${zodiac.gradient} opacity-30 rounded-2xl`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.3 }}
                      transition={{ duration: 0.3 }}
                    />
                  )}

                  <div className="relative z-10 text-center">
                    <div className={`
                      text-5xl mb-2 transition-all duration-300
                      ${selectedZodiac === zodiac.sign 
                        ? 'text-white' 
                        : `bg-gradient-to-br ${zodiac.gradient} bg-clip-text text-transparent`
                      }
                    `}>
                      {zodiac.symbol}
                    </div>
                    <h3 className={`
                      font-semibold mb-1 transition-all duration-300
                      ${selectedZodiac === zodiac.sign ? 'text-white' : 'text-foreground'}
                    `}>
                      {zodiac.name}
                    </h3>
                    <p className={`
                      text-xs transition-all duration-300
                      ${selectedZodiac === zodiac.sign ? 'text-white/80' : 'text-muted-foreground'}
                    `}>
                      {zodiac.dates}
                    </p>
                    <div className={`
                      mt-2 text-xs font-medium transition-all duration-300
                      ${selectedZodiac === zodiac.sign ? 'text-white/90' : 'text-muted-foreground'}
                    `}>
                      {zodiac.element}
                    </div>
                  </div>

                  {/* Selection indicator */}
                  {selectedZodiac === zodiac.sign && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center"
                    >
                      <Sparkles className="w-4 h-4 text-primary" />
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>

          {selectedZodiac && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <Button
                onClick={handleContinue}
                className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity px-8"
                size="lg"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Continue
              </Button>
            </motion.div>
          )}
        </Card>
      </motion.div>
    </div>
  );
};