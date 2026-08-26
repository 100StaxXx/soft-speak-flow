export interface CompanionStatAnalysisPreludeCard {
  id: string;
  title: string;
  description: string;
  imageStoragePath: string;
}

export const COMPANION_STAT_ANALYSIS_PRELUDE_CARD_BUCKET =
  "cosmiq-title-cards";
export const COMPANION_STAT_ANALYSIS_PRELUDE_CARD_PATH_PREFIX =
  "preload-template-cards/v1";

const buildImageStoragePath = (id: string) =>
  `${COMPANION_STAT_ANALYSIS_PRELUDE_CARD_PATH_PREFIX}/${id}.png`;

export const COMPANION_STAT_ANALYSIS_PRELUDE_CARDS: CompanionStatAnalysisPreludeCard[] = [
  {
    id: "the-wandering-seeker",
    title: "The Wandering Seeker",
    description: "A quiet traveler following the next signal through unknown stars.",
    imageStoragePath: buildImageStoragePath("the-wandering-seeker"),
  },
  {
    id: "the-verdant-guardian",
    title: "The Verdant Guardian",
    description: "A living shield rooted in renewal, recovery, and steady growth.",
    imageStoragePath: buildImageStoragePath("the-verdant-guardian"),
  },
  {
    id: "the-astral-scholar",
    title: "The Astral Scholar",
    description: "A star-lit reader turning patterns into insight and direction.",
    imageStoragePath: buildImageStoragePath("the-astral-scholar"),
  },
  {
    id: "the-iron-vanguard",
    title: "The Iron Vanguard",
    description: "A front-line force carrying discipline, vitality, and brave momentum.",
    imageStoragePath: buildImageStoragePath("the-iron-vanguard"),
  },
  {
    id: "the-unbroken-sentinel",
    title: "The Unbroken Sentinel",
    description: "A patient defender who holds the line when pressure rises.",
    imageStoragePath: buildImageStoragePath("the-unbroken-sentinel"),
  },
  {
    id: "the-reality-weaver",
    title: "The Reality Weaver",
    description: "A maker of impossible paths, shaping wisdom through imagination.",
    imageStoragePath: buildImageStoragePath("the-reality-weaver"),
  },
  {
    id: "the-soulforged-creator",
    title: "The Soulforged Creator",
    description: "A luminous artisan turning purpose into beautiful, living form.",
    imageStoragePath: buildImageStoragePath("the-soulforged-creator"),
  },
  {
    id: "the-inner-oracle",
    title: "The Inner Oracle",
    description: "A calm guide listening inward until the right path becomes clear.",
    imageStoragePath: buildImageStoragePath("the-inner-oracle"),
  },
  {
    id: "the-storm-breaker",
    title: "The Storm-Breaker",
    description: "A charged survivor stepping forward through thunder and fracture.",
    imageStoragePath: buildImageStoragePath("the-storm-breaker"),
  },
  {
    id: "the-cosmic-harmonizer",
    title: "The Cosmic Harmonizer",
    description: "A balanced presence aligning scattered signals into one clear orbit.",
    imageStoragePath: buildImageStoragePath("the-cosmic-harmonizer"),
  },
];

export const buildCompanionStatAnalysisPreludeCardImageUrl = (
  card: CompanionStatAnalysisPreludeCard,
  supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined,
) => {
  const baseUrl = supabaseUrl?.trim();
  if (!baseUrl) {
    throw new Error("Missing VITE_SUPABASE_URL for companion card storage.");
  }
  return `${baseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${
    COMPANION_STAT_ANALYSIS_PRELUDE_CARD_BUCKET
  }/${card.imageStoragePath}`;
};
