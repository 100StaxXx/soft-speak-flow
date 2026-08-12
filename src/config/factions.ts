import { Flame, HandHeart, Waves, type LucideIcon } from "lucide-react";
import steadfastImg from "@/assets/paths/path-steadfast.webp";
import stillwaterImg from "@/assets/paths/path-stillwater.webp";
import mercifulImg from "@/assets/paths/path-merciful.webp";

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
    name: "THE STEADFAST",
    subtitle: "Courage Made Consistent",
    description: "A path for people who meet faith through action. The Steadfast practice courage, discipline, and faithful follow-through—one honest step at a time.",
    motto: "Be strong, take heart, and keep walking.",
    philosophy: [
      "Faith becomes visible through action",
      "Courage grows through small obedience",
      "Consistency matters more than intensity",
      "Rest and recovery belong on the path",
    ],
    traits: ["Courageous", "Grounded", "Resilient", "Disciplined"],
    idealFor: "People who grow through clear action, accountability, and practical daily challenges.",
    image: steadfastImg,
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
    name: "THE STILLWATER",
    subtitle: "Wisdom Through Prayerful Attention",
    description: "A path for people who hear most clearly in quiet. Stillwater members make room for Scripture, reflection, honest questions, and the gentle work of discernment.",
    motto: "In quietness, notice what grace is doing.",
    philosophy: [
      "Depth before urgency",
      "Prayer makes room for truth",
      "Attention is a form of love",
      "Patience can be faithful action",
    ],
    traits: ["Reflective", "Wise", "Patient", "Attentive"],
    idealFor: "People who grow through contemplation, learning, Scripture, and thoughtful reflection.",
    image: stillwaterImg,
    color: "#7F26D9",
    fontClass: "font-cinzel",
    nameStyle: {
      fontFamily: "'Cinzel', serif",
      letterSpacing: "0.2em",
      fontWeight: 400,
      textShadow: "0 0 30px rgba(180, 100, 255, 0.7), 0 0 60px rgba(130, 50, 200, 0.4)",
    },
    icon: Waves,
  },
  {
    id: "stellar",
    name: "THE MERCIFUL",
    subtitle: "Grace Expressed Through Service",
    description: "A path for people whose faith comes alive in relationship. The Merciful practice compassion, generosity, reconciliation, and concrete care for the people around them.",
    motto: "Receive grace freely; carry it outward.",
    philosophy: [
      "Love becomes concrete through service",
      "Compassion begins with attention",
      "Generosity can be practiced daily",
      "Community is part of formation",
    ],
    traits: ["Compassionate", "Generous", "Relational", "Hopeful"],
    idealFor: "People who grow through relationships, service, encouragement, and acts of practical care.",
    image: mercifulImg,
    color: "#3DB8F5",
    fontClass: "font-quicksand",
    nameStyle: {
      fontFamily: "'Quicksand', sans-serif",
      letterSpacing: "0.08em",
      fontWeight: 600,
      textShadow: "0 0 30px rgba(100, 200, 255, 0.7), 0 0 60px rgba(50, 150, 220, 0.4)",
    },
    icon: HandHeart,
  },
];

export const getFactionById = (id: FactionType | string | null | undefined): Faction | undefined => {
  if (!id) return undefined;
  return factions.find(f => f.id === id);
};
