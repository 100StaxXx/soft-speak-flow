import { Flame, Moon, Sparkles, type LucideIcon } from "lucide-react";
import starfallImg from "@/assets/faction-starfall.png";
import voidImg from "@/assets/faction-void.png";
import stellarImg from "@/assets/faction-stellar.png";

export type FactionType = "starfall" | "void" | "stellar";

export interface Faction {
  id: FactionType;
  name: string;
  subtitle: string;
  description: string;
  motto: string;
  philosophy: string[];
  traits: string[];
  idealFor: string;
  image: string;
  color: string;
  fontClass: string;
  nameStyle: React.CSSProperties;
  icon: LucideIcon;
}

export const factions: Faction[] = [
  {
    id: "starfall",
    name: "STARFALL FLEET",
    subtitle: "Blazing Through the Unknown",
    description: "Warriors of momentum who believe that action is the ultimate teacher. The Fleet charges forward, turning obstacles into fuel and doubt into determination.",
    motto: "We don't follow paths, we burn new ones.",
    philosophy: [
      "Action over hesitation",
      "Bold moves create breakthroughs",
      "Fear is fuel for the fearless",
      "Progress beats perfection",
    ],
    traits: ["Courageous", "Driven", "Resilient", "Bold"],
    idealFor: "Those who thrive on challenge and want to build unstoppable momentum in their growth journey.",
    image: starfallImg,
    color: "#FF6600",
    fontClass: "font-bebas",
    nameStyle: {
      fontFamily: "'Bebas Neue', sans-serif",
      letterSpacing: "0.15em",
      textShadow: "0 0 40px rgba(255, 150, 50, 0.8), 0 0 80px rgba(255, 100, 0, 0.4)",
    },
    icon: Flame,
  },
  {
    id: "void",
    name: "Void Collective",
    subtitle: "Masters of the In Between",
    description: "Seekers of depth who find power in pause. The Collective understands that true transformation happens in moments of stillness, where clarity emerges from chaos.",
    motto: "In stillness, we find infinite power.",
    philosophy: [
      "Depth over speed",
      "Reflection reveals truth",
      "The void holds all answers",
      "Patience is strength",
    ],
    traits: ["Introspective", "Wise", "Centered", "Mysterious"],
    idealFor: "Those who value mindfulness and want to cultivate inner wisdom alongside outer achievement.",
    image: voidImg,
    color: "#7F26D9",
    fontClass: "font-cinzel",
    nameStyle: {
      fontFamily: "'Cinzel', serif",
      letterSpacing: "0.2em",
      fontWeight: 400,
      textShadow: "0 0 30px rgba(180, 100, 255, 0.7), 0 0 60px rgba(130, 50, 200, 0.4)",
    },
    icon: Moon,
  },
  {
    id: "stellar",
    name: "Stellar Voyagers",
    subtitle: "Dreamers Among the Stars",
    description: "Visionaries who see possibility in every constellation. The Voyagers chart courses through imagination, turning dreams into maps and wonder into wisdom.",
    motto: "Every star was once a dream.",
    philosophy: [
      "Vision shapes reality",
      "Wonder fuels discovery",
      "Dreams are destinations",
      "Imagination is power",
    ],
    traits: ["Creative", "Optimistic", "Curious", "Inspiring"],
    idealFor: "Those who dream big and want to transform their aspirations into reality through wonder and creativity.",
    image: stellarImg,
    color: "#3DB8F5",
    fontClass: "font-quicksand",
    nameStyle: {
      fontFamily: "'Quicksand', sans-serif",
      letterSpacing: "0.08em",
      fontWeight: 600,
      textShadow: "0 0 30px rgba(100, 200, 255, 0.7), 0 0 60px rgba(50, 150, 220, 0.4)",
    },
    icon: Sparkles,
  },
];

export const getFactionById = (id: FactionType | string | null | undefined): Faction | undefined => {
  if (!id) return undefined;
  return factions.find(f => f.id === id);
};
