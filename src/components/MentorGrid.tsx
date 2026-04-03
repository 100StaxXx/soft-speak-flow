import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, ArrowLeft } from "lucide-react";
import { MentorAvatar } from "@/components/MentorAvatar";
import { cn } from "@/lib/utils";

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
  appearance?: "default" | "onboarding";
}

// Preferred display order - active mentors only
const MENTOR_ORDER = ['atlas', 'eli', 'sienna', 'stryker', 'carmen', 'reign', 'solace'];

export const MentorGrid = ({
  mentors,
  onSelectMentor,
  currentMentorId,
  recommendedMentorId,
  isSelecting = false,
  appearance = "default",
}: MentorGridProps) => {
  const [selectedMentor, setSelectedMentor] = useState<string | null>(null);
  const topControlOffset = 'calc(env(safe-area-inset-top, 0px) + 1rem)';
  const isOnboardingAppearance = appearance === "onboarding";

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
    <div
      className="relative w-full max-w-6xl mx-auto"
      data-appearance={appearance}
      data-testid="mentor-grid-root"
    >
      {/* Full Screen Mentor View */}
      {activeMentor && (
        <div
          className={cn(
            "fixed inset-0 z-50 overflow-y-auto ios-scroll-container",
            isOnboardingAppearance
              ? "bg-[linear-gradient(180deg,rgba(7,7,16,0.9),rgba(7,7,16,0.98))]"
              : "bg-obsidian animate-fade-in",
          )}
        >
          {/* Full Size Mentor Image */}
          <div className="absolute inset-0">
            <MentorAvatar
              mentorSlug={activeMentor.slug}
              mentorName={activeMentor.name}
              primaryColor={activeMentor.primary_color}
              avatarUrl={activeMentor.avatar_url}
              size="xl"
              showBorder={false}
              className={cn(
                "!w-full !h-full !rounded-none",
                isOnboardingAppearance ? "opacity-45" : "opacity-60",
              )}
            />
            {/* Gradient Overlay */}
            <div
              className={cn(
                "absolute inset-0",
                isOnboardingAppearance
                  ? "bg-[linear-gradient(180deg,rgba(7,7,12,0.18),rgba(7,7,12,0.6),rgba(5,5,8,0.96))]"
                  : "bg-gradient-to-t from-obsidian via-obsidian/60 to-transparent",
              )}
            />
          </div>

          {/* Back Button */}
          <button
            onClick={handleBack}
            className={cn(
              "absolute left-8 z-50 group cursor-pointer transition-colors",
              isOnboardingAppearance
                ? "flex h-12 items-center gap-2 rounded-full border border-white/12 bg-black/35 px-4 text-white backdrop-blur-md hover:bg-black/50"
                : "flex items-center justify-center w-12 h-12 text-pure-white hover:text-royal-gold",
            )}
            style={{ top: topControlOffset }}
            aria-label="Back to guide grid"
          >
            <ArrowLeft className="h-6 w-6 group-hover:-translate-x-1 transition-transform" />
            {isOnboardingAppearance ? <span className="text-sm font-medium">Back</span> : null}
          </button>

          {/* Current Mentor Indicator */}
          {currentMentorId === activeMentor.id && (
            <div 
              className={cn(
                "absolute right-8 z-10 flex items-center gap-2 px-4 py-2 rounded-full",
                isOnboardingAppearance
                  ? "border border-white/12 bg-black/35 text-white backdrop-blur-md"
                  : "bg-royal-gold/20 border border-royal-gold",
              )}
              style={{ top: topControlOffset }}
            >
              <Check className="h-4 w-4 text-royal-gold" />
              <span className={cn("font-bold text-sm", isOnboardingAppearance ? "text-white" : "text-royal-gold")}>
                Current Guide
              </span>
            </div>
          )}

          {/* Overlayed Content */}
          <div
            className={cn(
              "relative z-10 min-h-[100svh] w-full flex flex-col justify-end px-6 py-8 md:px-16 md:py-12 max-w-5xl mx-auto",
              isOnboardingAppearance ? "max-w-6xl" : "",
            )}
            style={{
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4rem)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)',
            }}
          >
            <div
              className={cn(
                "space-y-8 animate-velocity-fade-in",
                isOnboardingAppearance ? "onb-stage-panel p-6 md:p-8" : "",
              )}
            >
              {/* Name & Title */}
              <div className="space-y-4">
                {isOnboardingAppearance ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/25 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-white/72 backdrop-blur-md">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: activeMentor.primary_color }}
                    />
                    Guide Preview
                  </div>
                ) : (
                  <div className="h-1 w-32 bg-royal-gold animate-scale-in" />
                )}
                <h1 className="text-[clamp(2.75rem,12vw,5rem)] md:text-9xl font-black text-pure-white uppercase tracking-tighter leading-none">
                  {activeMentor.name}
                </h1>
                <p 
                  className="text-3xl md:text-4xl font-bold uppercase tracking-wide"
                  style={{ color: activeMentor.primary_color }}
                >
                  {activeMentor.short_title}
                </p>
                <p className={cn("max-w-2xl text-xl italic", isOnboardingAppearance ? "text-white/70" : "text-steel")}>
                  {activeMentor.archetype}
                </p>
              </div>

              {/* Signature Line */}
              <div 
                className={cn(
                  "max-w-3xl py-2",
                  isOnboardingAppearance ? "rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-6" : "border-l-4 pl-6",
                )}
                style={{ borderColor: activeMentor.primary_color }}
              >
                <p className="text-2xl md:text-3xl text-pure-white italic leading-relaxed">
                  "{activeMentor.signature_line}"
                </p>
              </div>

              {/* Key Info */}
              <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
                <div className={cn(
                  "space-y-3 rounded-lg p-6 backdrop-blur-sm",
                  isOnboardingAppearance
                    ? "border border-white/10 bg-white/[0.04]"
                    : "border border-steel/20 bg-charcoal/80",
                )}>
                  <h3 className={cn(
                    "text-sm font-bold uppercase tracking-wide",
                    isOnboardingAppearance ? "text-white/62" : "text-royal-gold",
                  )}>
                    How they guide
                  </h3>
                  <p className={cn("leading-relaxed", isOnboardingAppearance ? "text-white/74" : "text-steel")}>
                    {activeMentor.tone_description}
                  </p>
                </div>
                
                <div className={cn(
                  "space-y-3 rounded-lg p-6 backdrop-blur-sm",
                  isOnboardingAppearance
                    ? "border border-white/10 bg-white/[0.04]"
                    : "border border-steel/20 bg-charcoal/80",
                )}>
                  <h3 className={cn(
                    "text-sm font-bold uppercase tracking-wide",
                    isOnboardingAppearance ? "text-white/62" : "text-royal-gold",
                  )}>
                    Best for
                  </h3>
                  <p className={cn("leading-relaxed", isOnboardingAppearance ? "text-white/74" : "text-steel")}>
                    {activeMentor.target_user}
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4">
                <Button
                  onClick={() => onSelectMentor(activeMentor.id)}
                  disabled={isSelecting}
                  variant={isOnboardingAppearance ? "default" : "default"}
                  className={cn(
                    "h-16 px-12 font-black uppercase tracking-wider transition-all duration-300",
                    isOnboardingAppearance
                      ? "onb-stage-cta rounded-full shadow-[0_18px_50px_rgba(0,0,0,0.28)]"
                      : "bg-transparent border-2 border-royal-purple text-pure-white hover:bg-royal-purple/10 shadow-[0_0_20px_rgba(137,81,204,0.5)] hover:shadow-[0_0_30px_rgba(137,81,204,0.7)]",
                  )}
                  style={isOnboardingAppearance ? {
                    background: `linear-gradient(135deg, ${activeMentor.primary_color}, rgba(137,81,204,0.92))`,
                  } : undefined}
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
        <div
          className={cn(
            "animate-fade-in",
            isOnboardingAppearance
              ? "grid gap-4 md:grid-cols-2 xl:grid-cols-3"
              : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 md:gap-8",
          )}
        >
          {orderedMentors.map((mentor) => (
            <div
              key={mentor.id}
              className={cn(
                "group relative cursor-pointer",
                isOnboardingAppearance
                  ? "onb-stage-card overflow-hidden p-5 text-left"
                  : `flex flex-col items-center space-y-3 ${recommendedMentorId === mentor.id ? 'animate-pulse-slow' : ''}`,
              )}
              onClick={() => handleMentorClick(mentor.id)}
            >
              {/* Recommended Badge */}
              {recommendedMentorId === mentor.id && (
                <div className={cn("absolute z-10", isOnboardingAppearance ? "right-4 top-4" : "-top-3 left-1/2 -translate-x-1/2")}>
                  <div className={cn(
                    "rounded-full border shadow-lg",
                    isOnboardingAppearance
                      ? "border-white/12 bg-white/8 px-3 py-1.5 backdrop-blur-md"
                      : "bg-gradient-to-r from-royal-purple to-accent-purple border-royal-purple/30 px-3 py-1",
                  )}>
                    <span className="text-xs font-black uppercase tracking-wide text-pure-white">Recommended</span>
                  </div>
                </div>
              )}
              {isOnboardingAppearance ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="relative">
                      {currentMentorId === mentor.id && (
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/75 backdrop-blur-md">
                          Current
                        </div>
                      )}
                      <MentorAvatar
                        mentorSlug={mentor.slug}
                        mentorName={mentor.name}
                        primaryColor={mentor.primary_color}
                        avatarUrl={mentor.avatar_url}
                        size="md"
                        className="transition-all duration-300 group-hover:scale-105"
                        style={{ boxShadow: `0 0 24px ${mentor.primary_color}50` }}
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <h3 className="text-2xl font-semibold text-white">{mentor.name}</h3>
                      <p className="text-sm uppercase tracking-[0.18em]" style={{ color: mentor.primary_color }}>
                        {mentor.short_title}
                      </p>
                      <p className="text-sm leading-6 text-white/62">{mentor.tone_description}</p>
                    </div>
                  </div>

                  <p className="text-sm leading-6 text-white/76">{mentor.signature_line}</p>

                  <div className="flex flex-wrap gap-2">
                    {mentor.themes.slice(0, 3).map((theme) => (
                      <span
                        key={theme}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/68"
                      >
                        {theme}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <>
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

                  <div className="text-center space-y-1">
                    <h3 className="text-pure-white font-bold text-lg md:text-xl group-hover:text-royal-purple transition-colors">
                      {mentor.name}
                    </h3>
                    <p className="text-steel text-xs md:text-sm" style={{ color: mentor.primary_color }}>
                      {mentor.short_title}
                    </p>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
