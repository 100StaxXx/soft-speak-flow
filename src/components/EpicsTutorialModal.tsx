import { TutorialModal } from "@/components/ui/TutorialModal";
import { Compass, Sparkles, Milestone, Users, Trophy } from "lucide-react";

interface EpicsTutorialModalProps {
  open: boolean;
  onClose: () => void;
}

const features = [
  { icon: Sparkles, text: "Build adventures with custom rituals" },
  { icon: Milestone, text: "Track progress with milestones along the way" },
  { icon: Users, text: "Join guilds to adventure alongside others" },
  { icon: Trophy, text: "Celebrate victories and earn bonus XP" },
];

export function EpicsTutorialModal({ open, onClose }: EpicsTutorialModalProps) {
  return (
    <TutorialModal
      open={open}
      onClose={onClose}
      icon={Compass}
      title="Your Adventure Awaits"
      subtitle="Turn your big goals into daily adventures—complete rituals, track progress, and watch your story unfold."
      features={features}
      footerHint="Your first adventure is just a tap away!"
      buttonText="Let's Begin"
    />
  );
}
