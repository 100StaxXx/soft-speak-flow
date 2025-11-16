import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import atlasSage from "@/assets/atlas-sage.png";
import dariusSage from "@/assets/darius-sage.png";
import kaiSage from "@/assets/kai-sage.png";
import eliSage from "@/assets/eli-sage.png";
import novaSage from "@/assets/nova-sage.png";
import siennaSage from "@/assets/sienna-sage.png";
import lumiSage from "@/assets/lumi-sage.png";
import strykerSage from "@/assets/stryker-sage.png";
import solaceSage from "@/assets/solace-sage.png";

interface Mentor {
  id: string;
  name: string;
  slug: string;
  description: string;
  short_title?: string;
  identity_description?: string;
  welcome_message?: string;
  primary_color: string;
  avatar_url?: string;
}

interface MentorRevealProps {
  mentor: Mentor;
  onEnter: () => void;
}

const MENTOR_IMAGES: Record<string, string> = {
  atlas: atlasSage,
  darius: dariusSage,
  kai: kaiSage,
  eli: eliSage,
  nova: novaSage,
  sienna: siennaSage,
  lumi: lumiSage,
  stryker: strykerSage,
  solace: solaceSage,
};

const POSITION_MAP: Record<string, string> = {
  atlas: 'center 20%',
  darius: 'center 15%',
  kai: 'center 25%',
  eli: 'center 30%',
  nova: 'center 20%',
  sienna: 'center 30%',
  lumi: 'center 20%',
  stryker: 'center 25%',
  solace: 'center 25%',
};

export const MentorReveal = ({ mentor, onEnter }: MentorRevealProps) => {
  const [stage, setStage] = useState(0);
  const mentorImage = MENTOR_IMAGES[mentor.slug] || mentor.avatar_url;
  const imagePosition = POSITION_MAP[mentor.slug] || 'center 25%';
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), 300),
      setTimeout(() => setStage(2), 1000),
      setTimeout(() => setStage(3), 1800),
      setTimeout(() => setStage(4), 2600),
    ];

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-obsidian overflow-hidden">
      {/* Animated Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-obsidian via-midnight to-obsidian" />
      
      {stage >= 1 && (
        <div 
          className="absolute inset-0 opacity-20 animate-pulse"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${mentor.primary_color}40, transparent 70%)`
          }}
        />
      )}

      {/* Radial Glow Effect */}
      {stage >= 2 && (
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl opacity-30 animate-pulse"
          style={{ backgroundColor: mentor.primary_color }}
        />
      )}

      {/* Content Container */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 text-center">
        
        {/* Stage 1: Introduction Text */}
        {stage >= 1 && (
          <div className="mb-8 animate-fade-in">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-royal-gold animate-pulse" />
              <p className="text-steel text-lg tracking-wider uppercase">
                Your Guide Has Arrived
              </p>
              <Sparkles className="h-5 w-5 text-royal-gold animate-pulse" />
            </div>
            <div className="h-0.5 w-32 bg-gradient-to-r from-transparent via-royal-gold to-transparent mx-auto" />
          </div>
        )}

        {/* Stage 2: Mentor Avatar with Glow */}
        {stage >= 2 && (
          <div className="mb-8 animate-scale-in">
            <div className="relative">
              {/* Outer Glow Ring */}
              <div 
                className="absolute -inset-4 rounded-full blur-xl opacity-60 animate-pulse"
                style={{ backgroundColor: mentor.primary_color }}
              />
              
              {/* Middle Ring */}
              <div 
                className="absolute -inset-2 rounded-full animate-pulse"
                style={{ 
                  boxShadow: `0 0 60px ${mentor.primary_color}80`,
                  border: `2px solid ${mentor.primary_color}40`
                }}
              />
              
              {/* Avatar Container */}
              <div
                className="relative w-48 h-48 md:w-56 md:h-56 rounded-full overflow-hidden animate-scale-in"
                style={{
                  border: `4px solid ${mentor.primary_color}`,
                  boxShadow: `0 0 80px ${mentor.primary_color}90, inset 0 0 40px ${mentor.primary_color}20`
                }}
              >
                {mentorImage ? (
                  <img
                    src={mentorImage}
                    alt={mentor.name}
                    className="w-full h-full object-cover"
                    style={{ objectPosition: imagePosition }}
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-pure-white text-6xl font-black"
                    style={{ backgroundColor: mentor.primary_color }}
                  >
                    {getInitials(mentor.name)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stage 3: Mentor Name & Title */}
        {stage >= 3 && (
          <div className="mb-8 space-y-4 animate-fade-in">
            <h1 className="text-6xl md:text-7xl font-black text-pure-white tracking-tight uppercase">
              {mentor.name}
            </h1>
            <p 
              className="text-2xl md:text-3xl font-bold tracking-wide"
              style={{ color: mentor.primary_color }}
            >
              {mentor.short_title || mentor.identity_description}
            </p>
            <div 
              className="h-1 w-40 mx-auto rounded-full"
              style={{ 
                background: `linear-gradient(90deg, transparent, ${mentor.primary_color}, transparent)`,
                boxShadow: `0 0 20px ${mentor.primary_color}60`
              }}
            />
          </div>
        )}

        {/* Stage 4: Welcome Message & CTA */}
        {stage >= 4 && (
          <div className="max-w-2xl animate-fade-in">
            {/* Welcome Message */}
            <div 
              className="mb-12 p-6 rounded-lg border backdrop-blur-sm"
              style={{ 
                borderColor: `${mentor.primary_color}40`,
                background: `linear-gradient(135deg, ${mentor.primary_color}10, transparent)`
              }}
            >
              <p className="text-xl md:text-2xl text-pure-white leading-relaxed italic">
                "{mentor.welcome_message || "Together, we'll unlock your potential and push beyond your limits. Your journey to greatness starts now."}"
              </p>
            </div>

            {/* CTA Button */}
            <Button
              onClick={onEnter}
              className="h-16 px-12 text-lg font-black uppercase tracking-wider rounded-full transition-all duration-300 hover:scale-105 border-2"
              style={{
                backgroundColor: 'transparent',
                borderColor: mentor.primary_color,
                color: '#FFFFFF',
                boxShadow: `0 0 30px ${mentor.primary_color}50`
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = mentor.primary_color;
                e.currentTarget.style.boxShadow = `0 0 50px ${mentor.primary_color}80`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.boxShadow = `0 0 30px ${mentor.primary_color}50`;
              }}
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Begin Your Journey
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
