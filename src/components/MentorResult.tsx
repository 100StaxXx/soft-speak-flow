import { Button } from "@/components/ui/button";
import { Check, ArrowRight } from "lucide-react";
import { MentorAvatar } from "@/components/MentorAvatar";
import { cn } from "@/lib/utils";

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
  seeAllLabel?: string;
  appearance?: "default" | "onboarding";
}

export const MentorResult = ({
  mentor,
  explanation,
  compatibilityScore: _compatibilityScore,
  onConfirm,
  onSeeAll,
  isConfirming = false,
  seeAllLabel = "See All Guides",
  appearance = "default",
}: MentorResultProps) => {
  if (appearance === "onboarding") {
    return (
      <div
        className="min-h-screen px-4 pt-safe-top pb-safe-lg relative z-10 flex items-center justify-center"
        data-appearance="onboarding"
        data-testid="mentor-result-root"
      >
        <div className="w-full max-w-4xl space-y-6">
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-white/12 bg-black/25 px-4 py-2 text-[11px] uppercase tracking-[0.32em] text-white/72 backdrop-blur-md">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: mentor.primary_color, boxShadow: `0 0 16px ${mentor.primary_color}` }}
            />
            Guide Found
          </div>

          <div className="onb-stage-panel overflow-hidden p-6 sm:p-8 md:p-10">
            <div className="grid gap-8 md:grid-cols-[0.95fr_1.05fr] md:items-center">
              <div className="space-y-5 text-center md:text-left">
                <div className="flex justify-center md:justify-start">
                  <MentorAvatar
                    mentorSlug={mentor.slug}
                    mentorName={mentor.name}
                    primaryColor={mentor.primary_color}
                    avatarUrl={mentor.avatar_url}
                    size="lg"
                    showGlow
                    className="shadow-[0_0_60px_rgba(255,255,255,0.08)]"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.28em] text-white/56">
                    Your Guide Match
                  </p>
                  <h1 className="text-4xl font-semibold text-white md:text-5xl">
                    {mentor.name}
                  </h1>
                  <p className="text-base uppercase tracking-[0.22em] text-white/64">
                    {explanation.subtitle}
                  </p>
                </div>
                <p className="text-base leading-7 text-white/72 md:text-lg">
                  {explanation.paragraph}
                </p>
              </div>

              <div className="space-y-4">
                <div className="rounded-[1.6rem] border border-white/10 bg-black/18 p-5 backdrop-blur-xl">
                  <h2 className="mb-4 text-xs uppercase tracking-[0.3em] text-white/56">
                    How They&apos;ll Help You
                  </h2>
                  <div className="space-y-3">
                    {explanation.bullets.map((bullet, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 rounded-[1.15rem] border border-white/8 bg-black/18 p-4"
                      >
                        <div
                          className="mt-2 h-2 w-2 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: mentor.primary_color }}
                        />
                        <p className="text-sm leading-6 text-white/80">{bullet}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    onClick={onConfirm}
                    disabled={isConfirming}
                    size="lg"
                    className="onb-stage-cta h-14 flex-1 rounded-full text-base font-semibold"
                    style={{
                      background: `linear-gradient(135deg, ${mentor.primary_color}, rgba(137,81,204,0.92))`,
                    }}
                  >
                    {isConfirming ? (
                      <>Confirming...</>
                    ) : (
                      <>
                        <Check className="h-5 w-5" />
                        Continue with {mentor.name}
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={onSeeAll}
                    className="h-14 rounded-full border-white/12 bg-black/20 px-6 text-white hover:bg-black/30"
                  >
                    {seeAllLabel}
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 pt-safe pb-safe-lg relative z-10"
      data-appearance={appearance}
      data-testid="mentor-result-root"
    >
      <div className="max-w-3xl w-full space-y-12 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="h-1 w-24 bg-royal-purple mx-auto animate-scale-in" />
          <h1 className="text-4xl md:text-5xl font-black text-pure-white uppercase tracking-tight">
            We've Found Your Guide
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
              className={cn("animate-scale-in")}
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
                  Choose {mentor.name} as My Guide
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={onSeeAll}
              className="md:w-56 h-16 border-steel/50 text-pure-white hover:bg-charcoal/50"
            >
              {seeAllLabel}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
