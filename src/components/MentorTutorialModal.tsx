import { TutorialModal } from "@/components/ui/TutorialModal";
import { MessageCircle, Mic, Sun, HelpCircle, Sparkles } from "lucide-react";

interface MentorTutorialModalProps {
  open: boolean;
  onClose: () => void;
}

const features = [
  { icon: Mic, text: "Listen to daily pep talks for motivation" },
  { icon: Sun, text: "Morning & evening check-ins to track your mood" },
  { icon: HelpCircle, text: "Ask questions anytime for personalized guidance" },
  { icon: Sparkles, text: "Unlock unique mentor personalities and styles" },
];

export function MentorTutorialModal({ open, onClose }: MentorTutorialModalProps) {
  return (
    <TutorialModal
      open={open}
      onClose={onClose}
      icon={MessageCircle}
      title="Meet Your Mentor"
      subtitle="Your personal guide to motivate and help you stay on track with your goals."
      features={features}
      footerHint="Chat with your mentor below to get started!"
      buttonText="Continue"
    />
  );
}
