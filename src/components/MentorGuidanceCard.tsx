import { Card } from "@/components/ui/card";
import { useMentorPersonality } from "@/hooks/useMentorPersonality";
import { usePostOnboardingMentorGuidance } from "@/hooks/usePostOnboardingMentorGuidance";
import { useLocation } from "react-router-dom";

interface MentorGuidanceCardProps {
  route: "/journeys" | "/companion" | "/mentor";
}

export const MentorGuidanceCard = ({ route }: MentorGuidanceCardProps) => {
  const location = useLocation();
  const personality = useMentorPersonality();
  const {
    isActive,
    stepRoute,
    progressText,
    mentorInstructionLines,
  } = usePostOnboardingMentorGuidance();

  if (
    !isActive ||
    location.pathname !== route ||
    stepRoute !== route ||
    mentorInstructionLines.length === 0
  ) {
    return null;
  }

  return (
    <Card className="mb-4 rounded-2xl border border-primary/30 bg-card/40 p-4 backdrop-blur-2xl shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/90">
        {progressText}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">
        {personality?.name ?? "Your mentor"}
      </p>
      <div className="mt-2 space-y-1.5">
        {mentorInstructionLines.map((line) => (
          <p key={line} className="text-sm leading-relaxed text-foreground/90">
            {line}
          </p>
        ))}
      </div>
    </Card>
  );
};
