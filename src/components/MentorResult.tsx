import { Button } from "@/components/ui/button";
import { Check, ArrowRight } from "lucide-react";
import { MentorAvatar } from "@/components/MentorAvatar";

interface Mentor {
  id: string;
  slug: string;
  name: string;
  short_title: string;
  avatar_url?: string;
  primary_color: string;
}

interface MentorResultProps {
  mentor: Mentor;
  explanation: {
    title: string;
    subtitle: string;
    paragraph: string;
    bullets: string[];
  };
  compatibilityScore?: number | null;
  onConfirm: () => void;
  onSeeAll: () => void;
  isConfirming?: boolean;
}

export const MentorResult = ({
  mentor,
  explanation,
  compatibilityScore: _compatibilityScore,
  onConfirm,
  onSeeAll,
  isConfirming = false
}: MentorResultProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 pt-safe-top safe-area-bottom relative z-10">
      <div className="max-w-3xl w-full space-y-12 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="h-1 w-24 bg-royal-purple mx-auto animate-scale-in" />
          <h1 className="text-4xl md:text-5xl font-black text-pure-white uppercase tracking-tight">
            We've Found Your Mentor
          </h1>
        </div>

        {/* Mentor Card */}
        <div className="bg-midnight border-2 border-charcoal rounded-2xl p-8 md:p-12 space-y-8">
          {/* Avatar */}
          <div className="flex justify-center">
            <MentorAvatar
              mentorSlug={mentor.slug}
              mentorName={mentor.name}
              primaryColor={mentor.primary_color}
              avatarUrl={mentor.avatar_url}
              size="lg"
              showGlow
              className="animate-scale-in"
            />
          </div>


          {/* Name & Title */}
          <div className="text-center space-y-3">
            <h2 className="text-4xl md:text-5xl font-black text-pure-white uppercase">
              {mentor.name}
            </h2>
            <p className="text-2xl font-bold text-royal-purple">
              {explanation.subtitle}
            </p>
          </div>

          {/* Explanation */}
          <div className="space-y-6">
            <p className="text-lg text-steel leading-relaxed text-center max-w-2xl mx-auto">
              {explanation.paragraph}
            </p>

            {/* Bullets */}
            <div className="space-y-4 pt-4">
              <h3 className="text-sm font-bold text-royal-purple uppercase tracking-wide text-center">
                How they'll help you
              </h3>
              <div className="space-y-3">
                {explanation.bullets.map((bullet, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-4 bg-charcoal/50 rounded-lg border border-steel/20"
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
                      style={{ backgroundColor: mentor.primary_color }}
                    />
                    <p className="text-base text-pure-white">{bullet}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col md:flex-row gap-4 pt-6">
            <Button
              onClick={onConfirm}
              disabled={isConfirming}
              className="flex-1 h-16 font-black uppercase tracking-wider bg-transparent border-2 border-royal-purple text-pure-white hover:bg-royal-purple/10 shadow-[0_0_20px_rgba(137,81,204,0.5)] hover:shadow-[0_0_30px_rgba(137,81,204,0.7)] transition-all duration-300"
            >
              {isConfirming ? (
                <>Confirming...</>
              ) : (
                <>
                  <Check className="mr-2 h-5 w-5" />
                  Choose {mentor.name} as My Mentor
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={onSeeAll}
              className="md:w-56 h-16 border-steel/50 text-pure-white hover:bg-charcoal/50"
            >
              See All Mentors
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
