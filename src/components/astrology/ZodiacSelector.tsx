import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";

const ZODIAC_SIGNS = [
  { name: "aries", symbol: "♈", dates: "Mar 21 - Apr 19" },
  { name: "taurus", symbol: "♉", dates: "Apr 20 - May 20" },
  { name: "gemini", symbol: "♊", dates: "May 21 - Jun 20" },
  { name: "cancer", symbol: "♋", dates: "Jun 21 - Jul 22" },
  { name: "leo", symbol: "♌", dates: "Jul 23 - Aug 22" },
  { name: "virgo", symbol: "♍", dates: "Aug 23 - Sep 22" },
  { name: "libra", symbol: "♎", dates: "Sep 23 - Oct 22" },
  { name: "scorpio", symbol: "♏", dates: "Oct 23 - Nov 21" },
  { name: "sagittarius", symbol: "♐", dates: "Nov 22 - Dec 21" },
  { name: "capricorn", symbol: "♑", dates: "Dec 22 - Jan 19" },
  { name: "aquarius", symbol: "♒", dates: "Jan 20 - Feb 18" },
  { name: "pisces", symbol: "♓", dates: "Feb 19 - Mar 20" },
];

interface ZodiacSelectorProps {
  onSelect: (sign: string) => Promise<void>;
}

export const ZodiacSelector = ({ onSelect }: ZodiacSelectorProps) => {
  const [selectedSign, setSelectedSign] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!selectedSign) return;
    setSaving(true);
    try {
      await onSelect(selectedSign);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-gray-900/80 border-purple-500/30 backdrop-blur-xl p-6 shadow-2xl">
      <div className="text-center space-y-4 mb-6">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Sparkles className="w-12 h-12 text-purple-400 mx-auto" />
        </motion.div>
        <div>
          <h2 className="text-2xl font-black text-white mb-2">
            What's Your Zodiac Sign?
          </h2>
          <p className="text-gray-300 text-sm">
            Select your sign to unlock your daily cosmiq reading
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-6">
        {ZODIAC_SIGNS.map((sign) => (
          <motion.button
            key={sign.name}
            onClick={() => setSelectedSign(sign.name)}
            className={`p-3 rounded-lg border transition-all ${
              selectedSign === sign.name
                ? "bg-purple-600/50 border-purple-400 ring-2 ring-purple-400/50"
                : "bg-gray-800/50 border-gray-700 hover:border-purple-500/50 hover:bg-gray-800"
            }`}
            whileTap={{ scale: 0.95 }}
          >
            <span className="text-2xl block mb-1">{sign.symbol}</span>
            <span className="text-xs text-white capitalize font-medium">{sign.name}</span>
            <span className="text-[10px] text-gray-400 block">{sign.dates}</span>
          </motion.button>
        ))}
      </div>

      <Button
        onClick={handleConfirm}
        disabled={!selectedSign || saving}
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
      >
        {saving ? "Loading..." : selectedSign ? `Continue as ${selectedSign.charAt(0).toUpperCase() + selectedSign.slice(1)}` : "Select Your Sign"}
      </Button>
    </Card>
  );
};
