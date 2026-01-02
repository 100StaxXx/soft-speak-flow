import { TutorialModal } from "@/components/ui/TutorialModal";
import { Users, UserPlus, Trophy, Megaphone } from "lucide-react";

interface CommunityTutorialModalProps {
  open: boolean;
  onClose: () => void;
}

const features = [
  { icon: UserPlus, text: "Create your own guild or join with an invite code" },
  { icon: Trophy, text: "Compete on leaderboards and track your XP" },
  { icon: Megaphone, text: "Send shouts to encourage your guild" },
];

export function CommunityTutorialModal({ open, onClose }: CommunityTutorialModalProps) {
  return (
    <TutorialModal
      open={open}
      onClose={onClose}
      icon={Users}
      title="Welcome to Guilds"
      subtitle="Connect with others on their growth journey! Share progress and encourage each other."
      features={features}
      footerHint="Discover public guilds or create your own!"
      buttonText="Let's go!"
    />
  );
}
