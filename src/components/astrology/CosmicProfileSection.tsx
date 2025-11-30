import { BigThreeCard } from "./BigThreeCard";
import { PlanetaryCard } from "./PlanetaryCard";
import { Sparkles } from "lucide-react";

interface CosmiqProfileSectionProps {
  profile: {
    zodiac_sign: string;
    moon_sign: string;
    rising_sign: string;
    mercury_sign: string;
    mars_sign: string;
    venus_sign: string;
  };
}

// AI-generated descriptions (can be enhanced with actual generation later)
const getDescription = (planet: string, sign: string) => {
  const descriptions: Record<string, string> = {
    sun: `Your ${sign} Sun radiates your core essence - the authentic self you're growing into through every quest and challenge.`,
    moon: `Your ${sign} Moon guides your emotional world, shaping how you process feelings and nurture your inner companion.`,
    rising: `Your ${sign} Rising is the mask you wear - how others perceive your energy before they know your depths.`,
    mercury: `With Mercury in ${sign}, your mind processes ideas and communication through this lens, influencing how you tackle mental quests.`,
    mars: `Mars in ${sign} drives your physical energy and determination - the fuel behind every habit you build.`,
    venus: `Venus in ${sign} colors your values and connections, guiding what brings you joy and fulfillment on your journey.`,
  };
  return descriptions[planet] || `Your ${sign} placement shapes this aspect of your cosmiq identity.`;
};

export const CosmiqProfileSection = ({ profile }: CosmiqProfileSectionProps) => {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Sparkles className="w-6 h-6 text-accent-purple" />
          <h2 className="text-3xl font-bold text-pure-white">Your Cosmiq Profile</h2>
          <Sparkles className="w-6 h-6 text-accent-purple" />
        </div>
        <p className="text-cloud-white text-sm max-w-2xl mx-auto">
          The celestial map of your soul - six cosmiq forces that shape your journey through the stars
        </p>
        <p className="text-xs text-accent-purple font-medium mt-2">
          💫 Tap any card to dive deeper into what it means for you
        </p>
      </div>

      {/* Big Three - Prominent Display */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <BigThreeCard
          type="sun"
          sign={profile.zodiac_sign}
          description={getDescription('sun', profile.zodiac_sign)}
          delay={0.1}
        />
        <BigThreeCard
          type="moon"
          sign={profile.moon_sign}
          description={getDescription('moon', profile.moon_sign)}
          delay={0.2}
        />
        <BigThreeCard
          type="rising"
          sign={profile.rising_sign}
          description={getDescription('rising', profile.rising_sign)}
          delay={0.3}
        />
      </div>

      {/* Divider */}
      <div className="relative py-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-royal-purple/30"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="bg-obsidian px-4 text-xs text-steel uppercase tracking-wider">
            Planetary Influences
          </span>
        </div>
      </div>

      {/* Planetary Placements - Secondary Display */}
      <div className="space-y-4">
        <PlanetaryCard
          planet="mercury"
          sign={profile.mercury_sign}
          description={getDescription('mercury', profile.mercury_sign)}
          delay={0.4}
        />
        <PlanetaryCard
          planet="mars"
          sign={profile.mars_sign}
          description={getDescription('mars', profile.mars_sign)}
          delay={0.5}
        />
        <PlanetaryCard
          planet="venus"
          sign={profile.venus_sign}
          description={getDescription('venus', profile.venus_sign)}
          delay={0.6}
        />
      </div>
    </div>
  );
};