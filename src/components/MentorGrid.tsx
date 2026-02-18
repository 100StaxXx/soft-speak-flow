import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, ArrowLeft } from "lucide-react";
import { MentorAvatar } from "@/components/MentorAvatar";

interface Mentor {
  id: string;
  name: string;
  slug: string;
  archetype: string;
  short_title: string;
  tone_description: string;
  style_description: string;
  target_user: string;
  signature_line: string;
  primary_color: string;
  avatar_url?: string;
  themes: string[];
}

interface MentorGridProps {
  mentors: Mentor[];
  onSelectMentor: (mentorId: string) => void;
  currentMentorId?: string | null;
  recommendedMentorId?: string | null;
  isSelecting?: boolean;
}

// Preferred display order - active mentors only
const MENTOR_ORDER = ['atlas', 'eli', 'sienna', 'stryker', 'carmen', 'reign', 'solace'];

export const MentorGrid = ({ mentors, onSelectMentor, currentMentorId, recommendedMentorId, isSelecting = false }: MentorGridProps) => {
  const [selectedMentor, setSelectedMentor] = useState<string | null>(null);
  const topControlOffset = 'calc(env(safe-area-inset-top, 0px) + 1rem)';

  // Order mentors: first by MENTOR_ORDER, then any unlisted mentors alphabetically
  const orderedMentors = (() => {
    const orderedBySlug = MENTOR_ORDER.map(slug => 
      mentors.find(m => m.slug === slug)
    ).filter(Boolean) as Mentor[];
    
    // Find any mentors not in MENTOR_ORDER and add them at the end
    const unlistedMentors = mentors
      .filter(m => !MENTOR_ORDER.includes(m.slug))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    return [...orderedBySlug, ...unlistedMentors];
  })();

  const handleMentorClick = (mentorId: string) => {
    setSelectedMentor(mentorId);
  };

  const handleBack = () => {
    setSelectedMentor(null);
  };

  const activeMentor = orderedMentors.find(m => m.id === selectedMentor);

  return (
    <div className="relative w-full max-w-6xl mx-auto">
      {/* Full Screen Mentor View */}
      {activeMentor && (
        <div className="fixed inset-0 z-50 bg-obsidian animate-fade-in overflow-y-auto ios-scroll-container">
          {/* Full Size Mentor Image */}
          <div className="absolute inset-0">
            <MentorAvatar
              mentorSlug={activeMentor.slug}
              mentorName={activeMentor.name}
              primaryColor={activeMentor.primary_color}
              avatarUrl={activeMentor.avatar_url}
              size="xl"
              showBorder={false}
              className="!w-full !h-full !rounded-none opacity-60"
            />
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/60 to-transparent" />
          </div>

          {/* Back Button */}
          <button
            onClick={handleBack}
            className="absolute left-8 z-50 flex items-center justify-center w-12 h-12 text-pure-white hover:text-royal-gold transition-colors group cursor-pointer"
            style={{ top: topControlOffset }}
            aria-label="Back to mentor grid"
          >
            <ArrowLeft className="h-6 w-6 group-hover:-translate-x-1 transition-transform" />
          </button>

          {/* Current Mentor Indicator */}
          {currentMentorId === activeMentor.id && (
            <div 
              className="absolute right-8 z-10 flex items-center gap-2 px-4 py-2 bg-royal-gold/20 border border-royal-gold rounded-full"
              style={{ top: topControlOffset }}
            >
              <Check className="h-4 w-4 text-royal-gold" />
              <span className="text-royal-gold font-bold text-sm">Current Mentor</span>
            </div>
          )}

          {/* Overlayed Content */}
          <div
            className="relative z-10 min-h-[100svh] w-full flex flex-col justify-end px-6 py-8 md:px-16 md:py-12 max-w-5xl mx-auto"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4rem)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)',
            }}
          >
            <div className="space-y-8 animate-velocity-fade-in">
              {/* Name & Title */}
              <div className="space-y-4">
                <div className="h-1 w-32 bg-royal-gold animate-scale-in" />
                <h1 className="text-[clamp(2.75rem,12vw,5rem)] md:text-9xl font-black text-pure-white uppercase tracking-tighter leading-none">
                  {activeMentor.name}
                </h1>
                <p 
                  className="text-3xl md:text-4xl font-bold uppercase tracking-wide"
                  style={{ color: activeMentor.primary_color }}
                >
                  {activeMentor.short_title}
                </p>
                <p className="text-xl text-steel italic max-w-2xl">
                  {activeMentor.archetype}
                </p>
              </div>

              {/* Signature Line */}
              <div 
                className="max-w-3xl border-l-4 pl-6 py-2"
                style={{ borderColor: activeMentor.primary_color }}
              >
                <p className="text-2xl md:text-3xl text-pure-white italic leading-relaxed">
                  "{activeMentor.signature_line}"
                </p>
              </div>

              {/* Key Info */}
              <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
                <div className="space-y-3 p-6 bg-charcoal/80 backdrop-blur-sm rounded-lg border border-steel/20">
                  <h3 className="text-sm font-bold text-royal-gold uppercase tracking-wide">
                    How they guide
                  </h3>
                  <p className="text-steel leading-relaxed">
                    {activeMentor.tone_description}
                  </p>
                </div>
                
                <div className="space-y-3 p-6 bg-charcoal/80 backdrop-blur-sm rounded-lg border border-steel/20">
                  <h3 className="text-sm font-bold text-royal-gold uppercase tracking-wide">
                    Best for
                  </h3>
                  <p className="text-steel leading-relaxed">
                    {activeMentor.target_user}
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4">
                <Button
                  onClick={() => onSelectMentor(activeMentor.id)}
                  disabled={isSelecting}
                  className="h-16 px-12 font-black uppercase tracking-wider bg-transparent border-2 border-royal-purple text-pure-white hover:bg-royal-purple/10 shadow-[0_0_20px_rgba(137,81,204,0.5)] hover:shadow-[0_0_30px_rgba(137,81,204,0.7)] transition-all duration-300"
                >
                  {isSelecting ? (
                    <>Selecting...</>
                  ) : currentMentorId === activeMentor.id ? (
                    <>
                      <Check className="mr-2 h-5 w-5" />
                      Confirm {activeMentor.name}
                    </>
                  ) : (
                    <>Choose {activeMentor.name}</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid View - Fades out when mentor selected */}
      <div 
        className={`w-full transition-all duration-500 ${
          selectedMentor ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 md:gap-8 animate-fade-in">
          {orderedMentors.map((mentor) => (
            <div
              key={mentor.id}
              className={`flex flex-col items-center space-y-3 cursor-pointer group relative ${
                recommendedMentorId === mentor.id ? 'animate-pulse-slow' : ''
              }`}
              onClick={() => handleMentorClick(mentor.id)}
            >
              {/* Recommended Badge */}
              {recommendedMentorId === mentor.id && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <div className="px-3 py-1 bg-gradient-to-r from-royal-purple to-accent-purple rounded-full border border-royal-purple/30 shadow-lg">
                    <span className="text-xs font-black text-pure-white uppercase tracking-wide">Recommended</span>
                  </div>
                </div>
              )}
              {/* Avatar Circle */}
              <div className="relative">
                {currentMentorId === mentor.id && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs font-bold text-royal-purple whitespace-nowrap z-10">
                    Current
                  </div>
                )}
                <MentorAvatar
                  mentorSlug={mentor.slug}
                  mentorName={mentor.name}
                  primaryColor={mentor.primary_color}
                  avatarUrl={mentor.avatar_url}
                  size="md"
                  className={`transition-all duration-300 group-hover:scale-110 ${
                    recommendedMentorId === mentor.id ? 'ring-2 ring-royal-purple ring-offset-4 ring-offset-obsidian' : ''
                  }`}
                  style={{ 
                    boxShadow: recommendedMentorId === mentor.id 
                      ? `0 0 30px ${mentor.primary_color}60, 0 0 50px rgba(137,81,204,0.3)` 
                      : `0 0 20px ${mentor.primary_color}40`
                  }}
                />
              </div>

              {/* Name */}
              <div className="text-center space-y-1">
                <h3 className="text-pure-white font-bold text-lg md:text-xl group-hover:text-royal-purple transition-colors">
                  {mentor.name}
                </h3>
                <p className="text-steel text-xs md:text-sm" style={{ color: mentor.primary_color }}>
                  {mentor.short_title}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
