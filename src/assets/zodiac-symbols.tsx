import { type ZodiacSign } from "@/utils/zodiacCalculator";

// Import zodiac images
import ariesImage from "@/assets/zodiac-aries.png";
import taurusImage from "@/assets/zodiac-taurus.png";
import geminiImage from "@/assets/zodiac-gemini.png";
import cancerImage from "@/assets/zodiac-cancer.png";
import leoImage from "@/assets/zodiac-leo.png";
import virgoImage from "@/assets/zodiac-virgo.png";
import libraImage from "@/assets/zodiac-libra.png";
import scorpioImage from "@/assets/zodiac-scorpio.png";
import sagittariusImage from "@/assets/zodiac-sagittarius.png";
import capricornImage from "@/assets/zodiac-capricorn.png";
import aquariusImage from "@/assets/zodiac-aquarius.png";
import piscesImage from "@/assets/zodiac-pisces.png";

// Artistic zodiac images showing the actual animals/symbols
export const ZodiacSymbols: Record<ZodiacSign, JSX.Element> = {
  aries: <img src={ariesImage} alt="Aries Ram" className="w-full h-full object-contain" />,
  taurus: <img src={taurusImage} alt="Taurus Bull" className="w-full h-full object-contain" />,
  gemini: <img src={geminiImage} alt="Gemini Twins" className="w-full h-full object-contain" />,
  cancer: <img src={cancerImage} alt="Cancer Crab" className="w-full h-full object-contain" />,
  leo: <img src={leoImage} alt="Leo Lion" className="w-full h-full object-contain" />,
  virgo: <img src={virgoImage} alt="Virgo Maiden" className="w-full h-full object-contain" />,
  libra: <img src={libraImage} alt="Libra Scales" className="w-full h-full object-contain" />,
  scorpio: <img src={scorpioImage} alt="Scorpio Scorpion" className="w-full h-full object-contain" />,
  sagittarius: <img src={sagittariusImage} alt="Sagittarius Archer" className="w-full h-full object-contain" />,
  capricorn: <img src={capricornImage} alt="Capricorn Goat" className="w-full h-full object-contain" />,
  aquarius: <img src={aquariusImage} alt="Aquarius Water Bearer" className="w-full h-full object-contain" />,
  pisces: <img src={piscesImage} alt="Pisces Fish" className="w-full h-full object-contain" />,
};
