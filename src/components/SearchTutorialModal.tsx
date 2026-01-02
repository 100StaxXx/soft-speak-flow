import { TutorialModal } from "@/components/ui/TutorialModal";
import { Search, FileSearch, Quote, Mic } from "lucide-react";

interface SearchTutorialModalProps {
  open: boolean;
  onClose: () => void;
}

const features = [
  { icon: FileSearch, text: "Search for quests, quotes, and pep talks" },
  { icon: Quote, text: "Browse featured quotes for daily inspiration" },
  { icon: Mic, text: "Discover pep talks from your mentor" },
];

export function SearchTutorialModal({ open, onClose }: SearchTutorialModalProps) {
  return (
    <TutorialModal
      open={open}
      onClose={onClose}
      icon={Search}
      title="Discover & Explore"
      subtitle="Your discovery hub for content, quotes, and pep talks to fuel your journey."
      features={features}
      footerHint="Start typing to search or explore featured content!"
      buttonText="Continue"
    />
  );
}
