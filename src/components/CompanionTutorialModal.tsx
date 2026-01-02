import { TutorialModal } from "@/components/ui/TutorialModal";
import { Sparkles, Target, BarChart3, Flame, Heart } from "lucide-react";

interface CompanionTutorialModalProps {
  open: boolean;
  onClose: () => void;
}

const features = [
  { icon: Target, text: "Complete quests to earn XP and level up" },
  { icon: BarChart3, text: "Stats reflect your Mind, Body, and Soul focus" },
  { icon: Flame, text: "Keep streaks going to boost evolution speed" },
  { icon: Heart, text: "Don't neglect them—they'll miss you!" },
];

export function CompanionTutorialModal({ open, onClose }: CompanionTutorialModalProps) {
  return (
    <TutorialModal
      open={open}
      onClose={onClose}
      icon={Sparkles}
      title="Your Companion Awaits"
      subtitle="A magical creature that evolves through 21 stages as you grow and complete quests."
      features={features}
      footerHint="View your companion's stats, cards, and story below!"
      buttonText="Continue"
    />
  );
}
