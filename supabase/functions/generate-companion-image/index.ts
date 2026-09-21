import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import {
  checkRateLimit,
  createRateLimitResponse,
  RATE_LIMITS,
} from "../_shared/rateLimiter.ts";
import {
  buildCostGuardrailBlockedResponse,
  createCostGuardrailSession,
  isCostGuardrailBlockedError,
} from "../_shared/costGuardrails.ts";
import {
  getCompanionFastRetryLimits,
  getCompanionFinalImageQuality,
  getCompanionHiddenImageQuality,
  getCompanionStandardRetryLimits,
  isCompanionFastPathEligible,
  resolveCompanionImageSizeForUser,
} from "../_shared/companionImagePolicy.ts";
import {
  buildSpiritLockPromptBlock,
  resolveCompanionSpiritLockProfile,
} from "../_shared/companionSpiritLock.ts";
import {
  buildAiEggPrompt,
  buildAiEvolutionPrompt,
  buildCompanionArtDirection,
  buildCompanionFamilyBible,
  buildEggFromStage1Prompt,
  buildInitialImageLineageMetadata,
  buildStage1BootstrapPrompt,
  getEvolutionDifferenceFloor,
} from "../_shared/companionLineage.ts";
import {
  editCompanionImage,
  generateCompanionImage,
  OpenAIImageRequestError,
} from "../_shared/openaiCompanionImageClient.ts";
import { judgeCompanionImage } from "../_shared/companionImageJudge.ts";
import { runCompanionJudgedRender } from "../_shared/companionJudgedRender.ts";
import { registerUserStorageAsset } from "../_shared/storageAssetLedger.ts";
import {
  getProgressionTierLabelForLevel,
  getVisualStage,
  PROGRESSION_LEVEL_CAP,
} from "../../../src/config/progression.ts";

// ============================================================================
// CATEGORY DEFAULTS - Shared anatomy for creature categories
// ============================================================================

interface CategoryDefaults {
  limbCount: number;
  hasWings: boolean;
  hasTail: boolean;
  bodyType: string;
  prohibitedBase: string[];
}

const CATEGORY_DEFAULTS: Record<string, CategoryDefaults> = {
  "canine": {
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped",
    prohibitedBase: ["wings", "horns", "scales"],
  },
  "feline": {
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped",
    prohibitedBase: ["wings", "floppy ears", "blunt face"],
  },
  "dragon": {
    limbCount: 4,
    hasWings: true,
    hasTail: true,
    bodyType: "quadruped-winged",
    prohibitedBase: ["fur", "feathers"],
  },
  "bird": {
    limbCount: 2,
    hasWings: true,
    hasTail: true,
    bodyType: "biped-winged",
    prohibitedBase: ["4 legs", "teeth", "fur"],
  },
  "equine": {
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped",
    prohibitedBase: ["wings", "claws", "split hooves"],
  },
  "reptile": {
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped",
    prohibitedBase: ["wings", "fur", "feathers"],
  },
  "aquatic": {
    limbCount: 0,
    hasWings: false,
    hasTail: true,
    bodyType: "aquatic-streamlined",
    prohibitedBase: ["legs", "wings", "fur"],
  },
  "mammal": {
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped",
    prohibitedBase: ["wings", "scales"],
  },
  "primate": {
    limbCount: 4,
    hasWings: false,
    hasTail: false,
    bodyType: "quadruped-knuckle",
    prohibitedBase: ["wings", "tail"],
  },
  "invertebrate": {
    limbCount: 8,
    hasWings: false,
    hasTail: false,
    bodyType: "aquatic-tentacle",
    prohibitedBase: ["skeleton", "fur"],
  },
  "mythical": {
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped",
    prohibitedBase: [],
  },
  "insect": {
    limbCount: 6,
    hasWings: true,
    hasTail: false,
    bodyType: "insect-winged",
    prohibitedBase: ["4 legs", "tail", "fur", "vertebrate skeleton"],
  },
};

// ============================================================================
// CREATURE ANATOMY - Compact format inheriting from categories
// ============================================================================

interface CreatureAnatomy {
  category: string;
  limbCount: number;
  hasWings: boolean;
  hasTail: boolean;
  bodyType: string;
  babyFeatures: string;
  adultFeatures: string;
  anatomyNotes: string;
  prohibitedFeatures: string;
  realWorldRef: string;
}

// Compact creature definitions - only unique properties per creature
const CREATURE_DATA: Record<
  string,
  {
    cat: string;
    baby: string;
    adult: string;
    notes: string;
    prohibited?: string;
    ref?: string;
    wings?: boolean;
    limbs?: number;
    tail?: boolean;
    body?: string;
  }
> = {
  // === CANINES ===
  "Wolf": {
    cat: "canine",
    baby:
      "oversized floppy ears, round snout, fluffy round body, huge paws, soft puppy fur",
    adult:
      "pointed erect ears, long elegant snout, thick fur ruff, bushy tail, muscular shoulders",
    notes:
      "Digitigrade legs, 4 toes with non-retractable claws, golden/amber eyes typical",
    ref: "grey wolf",
  },
  "Fox": {
    cat: "canine",
    baby: "ENORMOUS ears relative to tiny head, button nose, fluffy round body",
    adult:
      "large pointed triangular ears, slender build, extremely bushy tail, narrow snout, white chest",
    notes: "Distinctive ear-to-head ratio is KEY, vertical slit pupils",
    prohibited: "wings, multiple tails, blunt snout",
    ref: "red fox",
  },
  "Arctic Fox": {
    cat: "canine",
    baby: "pure white fluffy ball, tiny dark nose, small rounded ears",
    adult:
      "thick white/silver coat, compact body, small rounded ears, bushy tail wraps around body",
    notes:
      "Compact body, SHORTER snout than red fox, SMALL ears (heat retention)",
    prohibited: "wings, long ears",
    ref: "arctic fox",
  },
  "Fennec Fox": {
    cat: "canine",
    baby:
      "ABSOLUTELY ENORMOUS ears even as baby, tiny cream-colored fluffy body",
    adult:
      "MASSIVE bat-like ears (larger than head width), tiny body, cream/sand coloring, large dark eyes",
    notes:
      "SMALLEST canine, ears are 6 inches on 8-inch body - ears MUST be comically oversized",
    prohibited: "wings, small ears, large body",
    ref: "fennec fox",
  },
  "Dog": {
    cat: "canine",
    baby: "floppy ears, round puppy face, oversized paws, soft puppy fur",
    adult:
      "friendly expression, floppy or erect ears, wagging tail, loyal loving eyes",
    notes:
      "Domesticated wolf descendant, expressive face, 4 toes visible per foot",
    ref: "golden retriever",
  },
  "Hyena": {
    cat: "canine",
    baby: "spotted fluffy fur, rounded ears, short snout, compact round body",
    adult:
      "sloped back (front higher than rear), large rounded ears, powerful jaw, spotted coat, mane along spine",
    notes:
      "UNIQUE sloped back profile, large rounded ears, powerful neck and jaw",
    prohibited: "wings, level back, wolf proportions",
    ref: "spotted hyena",
  },
  "Tanuki": {
    cat: "canine",
    baby: "round fluffy body, dark mask markings around eyes, stubby legs",
    adult:
      "raccoon-like mask markings, fluffy body, bushy striped tail, round face, short legs",
    notes:
      "Japanese raccoon dog - NOT a raccoon, rounder body than fox, dark eye mask",
    prohibited: "wings, raccoon hands, tall legs",
    ref: "tanuki",
  },

  // === MYTHICAL CANINES ===
  "Fenrir": {
    cat: "canine",
    baby:
      "oversized wolf pup with fierce eyes, dark/shadow fur, tiny fangs visible",
    adult:
      "MASSIVE wolf of world-ending scale, chains/bindings, enormous fangs, cosmic-dark fur",
    notes:
      "Norse giant wolf - WOLF anatomy at colossal scale, glowing fierce eyes",
    ref: "Norse giant wolf",
  },
  "Cerberus": {
    cat: "canine",
    baby:
      "THREE adorable puppy heads sharing one body, dark fur, red/orange eyes",
    adult:
      "THREE fierce dog heads on one muscular body, dark fur, hellfire eyes, serpent tail possible",
    notes: "EXACTLY THREE HEADS (no more, no less), single powerful body",
    prohibited: "wings, two heads, one head, more than three heads",
    ref: "Greek hellhound",
    body: "quadruped-multihead",
  },

  // === FELINES ===
  "Cat": {
    cat: "feline",
    baby: "huge eyes relative to face, tiny triangle ears, fluffy round body",
    adult:
      "elegant slender body, pointed triangle ears, expressive almond eyes, long graceful tail",
    notes:
      "Retractable claws, vertical slit pupils, whiskers, 5 front toes 4 back",
    ref: "domestic cat",
  },
  "Lion": {
    cat: "feline",
    baby: "spotted fluffy cub, oversized paws, round face, no mane yet",
    adult:
      "MALES: magnificent mane framing face, powerful muscular build, tufted tail",
    notes:
      "Largest African cat, males have mane, tufted tail tip, rounded ears",
    prohibited: "wings, stripes, mane on females",
    ref: "African lion",
  },
  "Tiger": {
    cat: "feline",
    baby: "fluffy striped cub, oversized paws, round face, blue eyes",
    adult:
      "bold black stripes on orange coat, white chest/belly, powerful build",
    notes:
      "STRIPES are unique like fingerprints, white spots behind ears, amber eyes",
    prohibited: "wings, spots, mane, solid color",
    ref: "Bengal tiger",
  },
  "Panther": {
    cat: "feline",
    baby: "solid dark fluffy cub, golden/green eyes stand out against dark fur",
    adult:
      "sleek solid black coat, muscular build, glowing golden or green eyes",
    notes:
      "Melanistic leopard/jaguar - may have faint rosettes, extremely muscular",
    prohibited: "wings, obvious spots, mane",
    ref: "black panther",
  },
  "Snow Leopard": {
    cat: "feline",
    baby: "fluffy grey-white spotted cub, EXTREMELY long fluffy tail",
    adult:
      "pale grey coat with black rosettes, EXTREMELY LONG thick tail, small rounded ears",
    notes:
      "SIGNATURE: Tail almost as long as body and very thick/fluffy, GREEN eyes",
    prohibited: "wings, short tail, orange coloring",
    ref: "snow leopard",
  },
  "Cheetah": {
    cat: "feline",
    baby: "fluffy grey mane down back, spotted coat, black tear marks on face",
    adult:
      "LEAN athletic build, solid black spots, distinctive black tear marks from eyes to mouth",
    notes:
      "LEANEST cat - built for speed, solid spots NOT rosettes, tear lines SIGNATURE",
    prohibited: "wings, bulky build, rosettes",
    ref: "cheetah",
    body: "quadruped-lean",
  },
  "Jaguar": {
    cat: "feline",
    baby: "fluffy spotted cub with rosettes, stocky build even as baby",
    adult:
      "stocky powerful build, rosettes with spots inside them, massive jaw muscles",
    notes:
      "STOCKIEST big cat, rosettes have SPOTS INSIDE them, massive head and jaw",
    prohibited: "wings, lean build, solid spots",
    ref: "jaguar",
  },
  "Lynx": {
    cat: "feline",
    baby: "fluffy spotted kitten, ear tufts already visible, short stubby tail",
    adult:
      "distinctive black EAR TUFTS, spotted coat, very short bobbed tail, facial ruff",
    notes: "SIGNATURE: Black tufts on ear tips, very SHORT tail, facial ruff",
    prohibited: "wings, long tail, missing ear tufts",
    ref: "Eurasian lynx",
  },
  "Puma / Cougar": {
    cat: "feline",
    baby: "SPOTTED cubs (lose spots as adults), blue eyes, oversized paws",
    adult:
      "solid tawny/tan coat (NO spots as adult), small round head, long tail with dark tip",
    notes:
      "Adults are SOLID colored, small head relative to body, long thick tail",
    prohibited: "wings, spots on adults, mane",
    ref: "mountain lion",
  },

  // === MYTHICAL FELINES ===
  "Sphinx": {
    cat: "feline",
    baby: "lion cub body with small wing nubs, human-like wise eyes",
    adult:
      "lion body with large eagle/feathered wings, serene wise expression, regal posture",
    notes:
      "Egyptian: lion body + wings + wise expression, majestic feathered wings",
    wings: true,
    body: "quadruped-winged",
    ref: "Egyptian sphinx",
  },
  "Griffin": {
    cat: "mythical",
    baby:
      "eagle chick face on a tiny lion cub body, fluffy feathered forequarters, wing nubs",
    adult:
      "eagle head and beak, feathered forequarters, powerful leonine hindquarters, large feathered wings",
    notes:
      "Classic gryphon anatomy: eagle head and front half blended into lion hindquarters, feathered wings must stay fully readable",
    prohibited: "human face, horse body, reptile scales, extra limbs",
    wings: true,
    body: "quadruped-winged",
    ref: "griffin",
  },
  "Kitsune": {
    cat: "canine",
    baby: "adorable fox kit with 1-2 small fluffy tails, white/golden fur",
    adult:
      "elegant fox with MULTIPLE flowing tails (up to 9), white/golden/silver fur, mystical flames",
    notes:
      "Japanese fox spirit - MORE TAILS = MORE POWERFUL (1-9 tails), fox fire flames",
    body: "quadruped-multitail",
    ref: "nine-tailed fox",
  },

  // === DRAGONS & REPTILES ===
  "Dragon": {
    cat: "dragon",
    baby: "small cute dragon with oversized head, tiny wing nubs, stubby tail",
    adult:
      "4 legs + 2 wings (6 limbs), scales, horns, powerful tail, fire breath, majestic wingspan",
    notes:
      "Western dragon: 4 legs + 2 wings = 6 limbs, scales, horns on head, long neck",
    ref: "Western dragon",
  },
  "Mechanical Dragon": {
    cat: "dragon",
    baby:
      "tiny clockwork dragon hatchling, metallic scales, visible miniature gears, glowing core, articulated wing struts",
    adult:
      "engineered dragon with metallic scales, articulated joints, gear-driven wings, reactor core, reinforced alloy tail",
    notes:
      "MUST remain fully mechanical: metallic scales, articulated joints, visible gears/clockwork motifs, engineered energy core",
    prohibited:
      "flesh, skin, fur, biological tissue, organic anatomy, blood, muscles",
    ref: "clockwork mechanical dragon",
  },
  "Wyvern": {
    cat: "dragon",
    baby:
      "small wyvern with oversized wings that serve as front limbs, 2 back legs",
    adult:
      "2 back legs ONLY, wings ARE the front limbs (like a bat), barbed tail",
    notes: "ONLY 2 legs + 2 wings (4 limbs), wings double as front limbs",
    prohibited: "4 legs, front legs separate from wings",
    limbs: 2,
    body: "biped-winged",
    ref: "wyvern",
  },
  "Hydra": {
    cat: "dragon",
    baby: "small serpentine creature with 2-3 small heads, scales",
    adult:
      "MULTIPLE serpentine heads (5-9) on long necks from one body, reptilian, no wings",
    notes:
      "MULTIPLE HEADS on long serpentine necks, regenerating heads in myth",
    prohibited: "wings, single head, fur",
    wings: false,
    body: "quadruped-multihead",
    ref: "Greek Hydra",
  },
  "Basilisk": {
    cat: "reptile",
    baby: "small serpent with crown-like crest on head, scales, deadly eyes",
    adult:
      "massive serpent with crown/crest, deadly gaze, iridescent scales, no limbs",
    notes:
      "King of serpents - crown-like crest, deadly gaze, serpentine body NO legs",
    prohibited: "legs, chicken features",
    limbs: 0,
    body: "serpent",
    ref: "basilisk serpent",
  },
  "T-Rex": {
    cat: "reptile",
    baby: "adorable baby T-Rex with oversized head, tiny arms, fluffy feathers",
    adult:
      "massive bipedal dinosaur, TINY arms with 2 fingers, enormous head with massive teeth",
    notes:
      "Bipedal on 2 powerful legs, TINY useless arms, massive skull and teeth",
    prohibited: "wings, long arms, quadruped stance",
    limbs: 4,
    body: "biped",
    ref: "Tyrannosaurus Rex",
  },
  "Velociraptor": {
    cat: "reptile",
    baby: "small feathered raptor, big intelligent eyes, tiny claws",
    adult:
      "sleek feathered raptor, large sickle claw on each foot, intelligent eyes, FEATHERS",
    notes:
      "Actually had FEATHERS, sickle-shaped killing claw, intelligent, turkey-sized",
    prohibited: "wings, scales, large size",
    limbs: 4,
    body: "biped",
    ref: "feathered velociraptor",
  },
  "Crocodile": {
    cat: "reptile",
    baby: "tiny croc with oversized head, eyes on top of head, little teeth",
    adult:
      "armored scaly body, long snout with visible teeth, eyes and nostrils on top",
    notes:
      "Low-slung body, eyes/nostrils on TOP of head, interlocking teeth, armored scales",
    prohibited: "wings, fur, upright stance",
    body: "quadruped-low",
    ref: "saltwater crocodile",
  },
  "Snake": {
    cat: "reptile",
    baby: "small coiled serpent, tiny scales, curious forked tongue",
    adult:
      "elegant serpent body, scales, forked tongue, no limbs, mesmerizing eyes",
    notes: "NO LIMBS at all, scales covering body, forked tongue for sensing",
    prohibited: "legs, arms, wings, fur, ears",
    limbs: 0,
    body: "serpent",
    ref: "python, cobra",
  },
  "Sea Turtle": {
    cat: "reptile",
    baby: "tiny turtle with oversized shell, flipper limbs, big dark eyes",
    adult:
      "large domed shell, powerful flipper limbs (NOT legs), beak-like mouth",
    notes: "FLIPPERS not legs, domed shell, beak-like mouth without teeth",
    prohibited: "legs/feet, teeth, wings",
    body: "quadruped-flippers",
    ref: "green sea turtle",
  },

  // === BIRDS ===
  "Eagle": {
    cat: "bird",
    baby:
      "fluffy grey/white chick, oversized beak, downy feathers, wobbly stance",
    adult:
      "powerful hooked beak, fierce golden eyes, massive wingspan, sharp talons",
    notes:
      "2 legs with powerful talons, 2 wings, hooked beak, fierce forward-facing eyes",
    ref: "bald eagle",
  },
  "Falcon": {
    cat: "bird",
    baby: "fluffy white chick, oversized head, dark eyes, downy feathers",
    adult:
      "sleek aerodynamic body, pointed wings, dark facial markings, extremely fast",
    notes:
      "FASTEST animal alive, pointed swept-back wings, dark mustache marks",
    prohibited: "4 legs, rounded wings, bulky build",
    ref: "peregrine falcon",
  },
  "Hawk": {
    cat: "bird",
    baby: "fluffy chick with large eyes, downy feathers, oversized feet",
    adult: "broad rounded wings, keen eyes, hooked beak, banded tail feathers",
    notes:
      "Broader wings than falcon, red-tailed variety has rust-colored tail",
    ref: "red-tailed hawk",
  },
  "Owl": {
    cat: "bird",
    baby: "round fluffy owlet, ENORMOUS eyes, heart-shaped or round face",
    adult:
      "round flat face, ENORMOUS forward-facing eyes, ear tufts, silent flight feathers",
    notes: "HUGE forward-facing eyes, flat facial disc, can rotate head 270°",
    prohibited: "4 legs, small eyes, side-facing eyes",
    ref: "great horned owl",
  },
  "Raven": {
    cat: "bird",
    baby: "fluffy black chick, large beak, curious intelligent eyes",
    adult:
      "glossy black feathers with iridescent sheen, large curved beak, intelligent eyes",
    notes: "Larger than crow, wedge-shaped tail, iridescent black plumage",
    ref: "common raven",
  },
  "Parrot": {
    cat: "bird",
    baby: "fluffy colorful chick, oversized curved beak, pin feathers",
    adult:
      "vibrant colorful plumage, large curved beak, zygodactyl feet (2 forward, 2 back)",
    notes:
      "CURVED beak for cracking seeds, zygodactyl feet for climbing, vibrant colors",
    ref: "macaw",
  },
  "Hummingbird": {
    cat: "bird",
    baby: "absolutely TINY fluffy chick, long thin beak already visible",
    adult:
      "TINY body, extremely fast-beating wings (blur when flying), long thin beak",
    notes:
      "SMALLEST bird, wings move in figure-8 (can hover), needle-like beak",
    prohibited: "large size, 4 legs, short beak, slow wings",
    body: "biped-winged-tiny",
    ref: "ruby-throated hummingbird",
  },
  "Penguin": {
    cat: "bird",
    baby: "fluffy grey/brown chick, oversized head, stubby flipper wings",
    adult:
      "tuxedo black and white coloring, flipper wings (cannot fly), upright waddling stance",
    notes:
      "CANNOT FLY - wings are flippers for swimming, upright stance, webbed feet",
    prohibited: "flight capability, 4 legs, colorful plumage",
    body: "biped-flightless",
    ref: "emperor penguin",
  },

  // === MYTHICAL BIRDS ===
  "Phoenix": {
    cat: "bird",
    baby:
      "tiny bird made of gentle flames, ember eyes, small wing nubs, warm glow",
    adult:
      "majestic fire bird, flaming plumage in reds/oranges/golds, long elegant tail feathers",
    notes:
      "Bird of fire and rebirth, flames instead of or merged with feathers",
    prohibited: "4 legs, ice/cold colors, no flames, dark coloring",
    ref: "mythological phoenix",
  },
  "Thunderbird": {
    cat: "bird",
    baby:
      "storm-colored fluffy chick, crackling feathers, bright electric eyes",
    adult:
      "MASSIVE eagle-like bird, storm clouds in wings, lightning crackling, thunder with wingbeats",
    notes:
      "Native American myth - enormous eagle that controls storms, lightning in feathers",
    prohibited: "4 legs, small size, no storm elements, fire element",
    body: "biped-winged-giant",
    ref: "Native American thunderbird",
  },

  // === EQUINES ===
  "Horse (Stallion)": {
    cat: "equine",
    baby: "long-legged wobbly foal, oversized head, fuzzy coat, tiny mane",
    adult: "powerful muscular build, flowing mane and tail, elegant long legs",
    notes: "Single-toed hooves, flowing mane down neck, long tail from dock",
    ref: "Arabian horse",
  },
  "Unicorn": {
    cat: "equine",
    baby:
      "adorable foal with tiny horn nub on forehead, flowing mane, pure coat",
    adult:
      "elegant horse with SINGLE SPIRAL HORN on forehead, flowing ethereal mane",
    notes:
      "SINGLE spiral horn center of forehead, often white/silver, cloven hooves possible",
    prohibited: "wings (that's pegasus), multiple horns, no horn",
    ref: "mythological unicorn",
  },
  "Pegasus": {
    cat: "equine",
    baby:
      "adorable foal with small fluffy wing nubs, soft coat, oversized hooves",
    adult:
      "majestic horse with LARGE FEATHERED WINGS, powerful build, flowing mane/tail",
    notes:
      "Horse with FEATHERED BIRD WINGS (4 legs + 2 wings = 6 limbs), typically white",
    prohibited: "horn (that's an alicorn), bat wings",
    wings: true,
    body: "quadruped-winged",
    ref: "Greek Pegasus",
  },

  // === AQUATIC ===
  "Dolphin": {
    cat: "aquatic",
    baby: "small sleek calf, oversized head, playful expression",
    adult:
      "streamlined body, dorsal fin, tail flukes (horizontal), curved beak-like snout",
    notes:
      "NO LEGS - only fins, horizontal tail flukes (mammal), dorsal fin, blowhole",
    ref: "bottlenose dolphin",
  },
  "Shark": {
    cat: "aquatic",
    baby: "small shark pup, all fins present, large dark eyes, tiny teeth",
    adult:
      "powerful streamlined body, multiple fins, VERTICAL tail (fish), multiple rows of teeth",
    notes:
      "NO LEGS - only fins, VERTICAL tail fin (fish), gill slits, cartilage skeleton",
    prohibited: "legs, horizontal tail, lungs",
    ref: "great white shark",
  },
  "Orca": {
    cat: "aquatic",
    baby:
      "small calf with black and white pattern, orange tint to white patches",
    adult:
      "black and white pattern, tall dorsal fin, horizontal tail flukes, white eye patch",
    notes:
      "NO LEGS - flippers only, distinctive black/white pattern, TALL dorsal fin",
    ref: "killer whale",
  },
  "Blue Whale": {
    cat: "aquatic",
    baby:
      "relatively small calf (still huge), mottled blue-grey, horizontal flukes",
    adult:
      "ENORMOUS blue-grey body, mottled pattern, tiny dorsal fin, horizontal flukes",
    notes:
      "LARGEST ANIMAL EVER, NO LEGS, blue-grey mottled, baleen plates not teeth",
    prohibited: "legs, teeth, large dorsal fin",
    ref: "blue whale",
  },
  "Jellyfish": {
    cat: "invertebrate",
    baby: "tiny translucent bell, developing tentacles, gentle pulsing",
    adult:
      "translucent bell-shaped body, flowing tentacles beneath, bioluminescent glow",
    notes:
      "NO skeleton, translucent bell body, trailing tentacles, no brain, pulses to move",
    prohibited: "legs, skeleton, eyes, solid body",
    limbs: 0,
    body: "aquatic-bell",
    ref: "moon jellyfish",
  },

  // === INSECTS ===
  "Buttercat": {
    cat: "mythical",
    baby:
      "tiny fuzzy kitten with budding wing nubs, soft fur with butterfly patterns, playful curious eyes",
    adult:
      "adorable cat with large butterfly wings, soft fur with intricate wing patterns, cat ears and whiskers, graceful flight",
    notes:
      "Cat body with butterfly wings, 4 cat legs, 2 large patterned wings, cat tail, antennae optional, whimsical hybrid",
    prohibited: "6 legs, insect body, no fur, proboscis, compound eyes",
    limbs: 4,
    wings: true,
    tail: true,
    body: "quadruped-winged",
    ref: "fantasy butterfly cat hybrid",
  },
  "Octopus": {
    cat: "invertebrate",
    baby: "tiny translucent octopus, oversized head, 8 tiny tentacles",
    adult:
      "bulbous head, 8 suckered tentacles, color-changing skin, highly intelligent eyes",
    notes:
      "EXACTLY 8 tentacles with suckers, bulbous head/mantle, beak in center, very intelligent",
    prohibited: "legs, more or fewer than 8 tentacles, 10 limbs (that's squid)",
    ref: "giant Pacific octopus",
  },
  "Manta Ray": {
    cat: "aquatic",
    baby: "small ray with developing wing-like fins, long thin tail",
    adult:
      "MASSIVE flat diamond body, wing-like pectoral fins, cephalic fins near mouth",
    notes:
      "Flat diamond shape, NO LEGS, wing-like fins, horn-like cephalic fins, filter feeder",
    prohibited: "legs, thick body, stinger",
    body: "aquatic-flat",
    ref: "giant manta ray",
  },

  // === MYTHICAL AQUATIC ===
  "Kraken": {
    cat: "invertebrate",
    baby:
      "small but fierce cephalopod, 8 tentacles, glowing eyes, dark coloring",
    adult:
      "MASSIVE octopus/squid hybrid, 8-10 enormous tentacles, glowing eyes, ship-destroying size",
    notes:
      "Giant cephalopod of myth, 8-10 massive tentacles, enormous eyes, deep sea monster",
    prohibited: "legs, fur, small size, friendly appearance",
    body: "aquatic-tentacle-giant",
    ref: "mythological kraken",
  },
  "Leviathan": {
    cat: "aquatic",
    baby: "small sea serpent, scales, glowing eyes, serpentine body",
    adult:
      "COLOSSAL sea serpent/dragon, massive scales, world-ending size, primordial ocean god",
    notes:
      "Biblical sea monster, serpentine body, may have fins, enormous beyond comprehension",
    prohibited: "legs, small size, cute appearance",
    body: "aquatic-serpent-giant",
    ref: "Biblical Leviathan",
  },

  // === OTHER MAMMALS ===
  "Bear": {
    cat: "mammal",
    baby: "tiny fluffy cub, oversized paws, round face, curious eyes, playful",
    adult:
      "massive heavy build, thick fur, powerful paws with claws, small rounded ears",
    notes:
      "Plantigrade feet (walks on whole foot), powerful shoulders, small ears, very short tail",
    prohibited: "wings, long tail, digitigrade legs, thin build",
    body: "quadruped-heavy",
    ref: "grizzly bear",
  },
  "Elephant": {
    cat: "mammal",
    baby:
      "adorable baby elephant, oversized ears, tiny trunk, fuzzy sparse hair",
    adult:
      "MASSIVE body, long prehensile trunk, large fan-like ears, tusks, thick legs",
    notes:
      "Trunk is extended nose/lip, large ears for cooling, column-like legs, tusks are teeth",
    prohibited: "wings, no trunk, no ears, thin legs",
    body: "quadruped-heavy",
    ref: "African elephant",
  },
  "Gorilla": {
    cat: "primate",
    baby: "small infant gorilla, expressive face, clinging posture, large eyes",
    adult:
      "powerful muscular build, silver back (males), knuckle-walking posture, intelligent face",
    notes:
      "NO TAIL (great apes lack tails), knuckle-walking, silver back on males",
    prohibited: "wings, tail, fur-covered face",
    ref: "mountain gorilla",
  },
  "Rhino": {
    cat: "mammal",
    baby: "small rhino calf, tiny horn nub, thick skin, oversized head",
    adult:
      "massive armored-looking body, 1-2 HORNS on snout, thick grey skin, small ears",
    notes:
      "Horn made of keratin (hair protein), thick folded skin, 3 toes per foot",
    prohibited: "wings, smooth skin, no horn, fur",
    body: "quadruped-heavy",
    ref: "white rhino",
  },
  "Hippo": {
    cat: "mammal",
    baby: "small pink/grey calf, oversized head, stubby legs, in water",
    adult:
      "MASSIVE barrel body, huge mouth with tusks, eyes/ears on top of head, short legs",
    notes:
      "Eyes/ears/nostrils on TOP of head (for water), ENORMOUS mouth opening 180°",
    prohibited: "wings, long legs, small mouth",
    body: "quadruped-heavy",
    ref: "hippopotamus",
  },
  "Mammoth": {
    cat: "mammal",
    baby: "fluffy baby mammoth, long shaggy fur, tiny curved tusks, cute trunk",
    adult:
      "massive elephant-like body, LONG SHAGGY FUR, huge curved tusks, trunk, small ears",
    notes:
      "Like elephant but with LONG WOOLLY FUR, tusks curve MORE, SMALLER ears (cold)",
    prohibited: "wings, no fur, straight tusks, large ears",
    body: "quadruped-heavy",
    ref: "woolly mammoth",
  },
  "Kangaroo": {
    cat: "mammal",
    baby: "tiny joey, oversized back legs developing, may peek from pouch",
    adult:
      "powerful back legs for hopping, small arms, large ears, thick balancing tail, pouch",
    notes:
      "HOPS on powerful back legs, small front arms, THICK muscular tail for balance",
    prohibited: "wings, small tail, equal leg sizes",
    body: "biped-hopping",
    ref: "red kangaroo",
  },
  "Koala": {
    cat: "mammal",
    baby:
      "tiny fluffy koala joey, large round nose, clinging to imaginary parent",
    adult:
      "fluffy grey body, large round nose, round fluffy ears, no tail visible, climbing claws",
    notes:
      "Marsupial NOT a bear, large spoon-shaped nose, 2 thumbs on hands, eucalyptus diet",
    prohibited: "wings, tail, bear-like body, small nose",
    body: "quadruped-arboreal",
    ref: "koala",
  },
  "Red Panda": {
    cat: "mammal",
    baby: "tiny fluffy red and white cub, mask markings, oversized round ears",
    adult:
      "red-brown fur with white face markings, long bushy striped tail, round face, cute",
    notes:
      "NOT related to giant panda, bushy striped tail, white facial markings, tree-dwelling",
    prohibited: "wings, black/white coloring, short tail, ground-dwelling",
    body: "quadruped-arboreal",
    ref: "red panda",
  },
  "Panda": {
    cat: "mammal",
    baby: "tiny pink and white cub, slowly developing black markings, helpless",
    adult:
      "distinctive black and white pattern, black eye patches and ears, round face, bamboo diet",
    notes:
      "Black and white markings are DISTINCTIVE, black eye patches, round body, pseudo-thumb",
    prohibited: "wings, colored fur, non-bear body",
    body: "quadruped-heavy",
    ref: "giant panda",
  },
  "Sloth": {
    cat: "mammal",
    baby:
      "tiny sloth clinging to parent, long arms, small face, perpetual smile",
    adult:
      "long arms with curved claws, slow movements, algae-tinted fur, perpetual smile",
    notes:
      "Extremely slow, long curved claws, may have green algae in fur, hangs upside down",
    prohibited: "wings, fast movements, short arms, no claws",
    body: "quadruped-arboreal-slow",
    ref: "three-toed sloth",
  },
  "Rabbit": {
    cat: "mammal",
    baby: "tiny fluffy bunny, oversized long ears, twitching nose, round body",
    adult:
      "soft fluffy body, long upright ears, cotton tail, large back feet, twitching nose",
    notes:
      "Long UPRIGHT ears (not floppy unless lop breed), powerful back legs, cotton tail",
    prohibited: "wings, short ears, no cotton tail, carnivore features",
    body: "quadruped-hopping",
    ref: "rabbit",
  },
  "Mouse": {
    cat: "mammal",
    baby: "tiny pink hairless baby, closed eyes, oversized ears forming",
    adult:
      "small round body, large round ears, long thin tail, whiskers, tiny paws",
    notes:
      "SMALL size, large round ears, long thin tail, whiskers, constantly twitching nose",
    prohibited: "wings, large size, short tail, no whiskers",
    body: "quadruped-tiny",
    ref: "house mouse",
  },
  "Chinchilla": {
    cat: "mammal",
    baby: "tiny fluffy ball, oversized round ears, dense soft fur",
    adult:
      "extremely fluffy dense fur, large round ears, bushy tail, round body",
    notes:
      "DENSEST fur of any land animal, large round ears, bushy tail, dust baths",
    prohibited: "wings, thin fur, small ears, long legs",
    body: "quadruped-fluffy",
    ref: "chinchilla",
  },
  "Raccoon": {
    cat: "mammal",
    baby: "tiny masked baby, ringed tail, nimble paw fingers forming",
    adult:
      "grey fur with black mask, ringed bushy tail, dexterous hand-like paws",
    notes:
      "Distinctive black mask, ringed tail, human-like hand dexterity, nocturnal",
    prohibited: "wings, no mask, no ringed tail, non-dexterous paws",
    ref: "raccoon",
  },
  "Bat": {
    cat: "mammal",
    baby: "tiny bat pup, wing membranes developing, large ears, clinging",
    adult:
      "wing membranes between elongated fingers, large ears, nocturnal, echolocation",
    notes:
      "ONLY flying mammal, wings are skin between fingers, large ears for echolocation",
    prohibited: "feathered wings, small ears, bird features",
    wings: true,
    body: "flying-mammal",
    ref: "fruit bat",
  },
  "Deer": {
    cat: "mammal",
    baby: "spotted fawn, long wobbly legs, large eyes, oversized ears",
    adult:
      "graceful body, long legs, antlers (males), large eyes, twitching ears",
    notes:
      "Spotted fawns, males grow ANTLERS (not horns), graceful and alert, cloven hooves",
    prohibited: "wings, horns, short legs, predator features",
    ref: "white-tailed deer",
  },
};

// Function to expand compact data into full CreatureAnatomy
function getCreatureAnatomy(spiritAnimal: string): CreatureAnatomy {
  const data = CREATURE_DATA[spiritAnimal];
  if (!data) return getDefaultAnatomy(spiritAnimal);

  const categoryDefaults = CATEGORY_DEFAULTS[data.cat] ||
    CATEGORY_DEFAULTS["mythical"];

  return {
    category: data.cat,
    limbCount: data.limbs ?? categoryDefaults.limbCount,
    hasWings: data.wings ?? categoryDefaults.hasWings,
    hasTail: data.tail ?? categoryDefaults.hasTail,
    bodyType: data.body ?? categoryDefaults.bodyType,
    babyFeatures: data.baby,
    adultFeatures: data.adult,
    anatomyNotes: data.notes,
    prohibitedFeatures: data.prohibited ||
      categoryDefaults.prohibitedBase.join(", "),
    realWorldRef: data.ref || spiritAnimal,
  };
}

function getDefaultAnatomy(spiritAnimal: string): CreatureAnatomy {
  return {
    category: "unknown",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped",
    babyFeatures: "round fluffy body, oversized head, big eyes, stubby limbs",
    adultFeatures: "fully developed adult features appropriate to species",
    anatomyNotes: `Follow real-world ${spiritAnimal} anatomy exactly`,
    prohibitedFeatures:
      "extra limbs, multiple heads, wings (unless naturally has them)",
    realWorldRef: spiritAnimal,
  };
}

// ============================================================================
// STORY TONE MODIFIERS
// ============================================================================

const STORY_TONES: Record<
  string,
  { lighting: string; atmosphere: string; palette: string; expression: string }
> = {
  "whimsical": {
    lighting: "soft golden sunlight with sparkles",
    atmosphere: "magical fairy-tale, wonder",
    palette: "warm pastels with rainbow accents",
    expression: "curious, delighted, wonder",
  },
  "epic": {
    lighting: "dramatic rim light, volumetric rays",
    atmosphere: "heroic, momentous",
    palette: "rich saturated colors with metallic highlights",
    expression: "determined, noble, fierce",
  },
  "cozy": {
    lighting: "warm firelight, soft ambient glow",
    atmosphere: "safe, nurturing, comforting",
    palette: "warm earth tones, autumnal colors",
    expression: "content, peaceful, sleepy",
  },
  "mysterious": {
    lighting: "moonlight with misty atmosphere",
    atmosphere: "enigmatic, secretive, magical",
    palette: "deep blues, purples, silver accents",
    expression: "knowing, secretive, wise",
  },
  "triumphant": {
    lighting: "golden hour with lens flares",
    atmosphere: "victorious, celebratory",
    palette: "gold, white, vibrant accent colors",
    expression: "proud, joyful, accomplished",
  },
  "melancholic": {
    lighting: "soft diffused overcast",
    atmosphere: "reflective, bittersweet",
    palette: "muted tones, gentle grays with color accents",
    expression: "thoughtful, gentle sadness",
  },
  "playful": {
    lighting: "bright and cheerful daylight",
    atmosphere: "fun, energetic, silly",
    palette: "bright primary colors, candy hues",
    expression: "mischievous, happy, laughing",
  },
};

// Map UI story tone values to internal values
function normalizeStoryTone(tone?: string): string | undefined {
  if (!tone) return undefined;

  const mapping: Record<string, string> = {
    // UI values -> edge function values
    "soft_gentle": "cozy",
    "epic_adventure": "epic",
    "emotional_heartfelt": "melancholic",
    "dark_intense": "mysterious",
    "whimsical_playful": "whimsical",
    // Direct matches (if already normalized)
    "whimsical": "whimsical",
    "epic": "epic",
    "cozy": "cozy",
    "mysterious": "mysterious",
    "triumphant": "triumphant",
    "melancholic": "melancholic",
    "playful": "playful",
  };

  return mapping[tone.toLowerCase()] || tone;
}

function getStoryToneModifiers(tone?: string): string {
  if (!tone || !STORY_TONES[tone]) return "";
  const t = STORY_TONES[tone];
  return `\n━━━ STORY TONE: ${tone.toUpperCase()} ━━━\nExpression cue: ${t.expression}\nAura/particle mood only: ${t.atmosphere}\nOptional accent influence: ${t.palette}\nDo not change the canonical Cosmiq camera, lighting recipe, palette hierarchy, proportions, or rendering medium. Ignore this legacy lighting note as a lighting instruction: ${t.lighting}.`;
}

// ============================================================================
// ELEMENT OVERLAY
// ============================================================================

const ELEMENT_EFFECTS: Record<string, string> = {
  "Fire":
    "Warm glow, ember particles, heat shimmer, small flames licking around paws/form",
  "Water":
    "Water droplets, misty aura, ripple effects, subtle blue luminescence",
  "Earth":
    "Tiny floating rocks, moss/crystal accents, earthy particles, grounded energy",
  "Air":
    "Swirling wind currents, floating feathers/leaves, light airy particles",
  "Lightning": "Electric sparks, crackling energy, static-charged fur/feathers",
  "Ice": "Frost crystals, cold mist, snowflakes, icy blue shimmer",
  "Nature": "Growing vines, flower petals, green leaf particles, life energy",
  "Shadow": "Dark wispy tendrils, mysterious darkness, purple/black energy",
  "Light": "Golden radiance, light beams, glowing aura, holy shine",
  "Cosmic": "Stars and nebulae, space energy, galaxy patterns, universal glow",
};

function getElementOverlay(element: string): string {
  const effect = ELEMENT_EFFECTS[element] ||
    `${element} energy particles and magical glow`;
  return `\n━━━ ELEMENTAL OVERLAY: ${element.toUpperCase()} ━━━\nEffect: ${effect}\nNOTE: Attach the effect to the creature's body or immediate aura over transparency. It must not create a scene, floor, weather backdrop, or environmental lighting shift, and it does not replace the body/fur color.`;
}

const MAX_ALLOWED_RETRIES = 3;
const GENERATION_FETCH_TIMEOUT_MS = 75_000;
const AUXILIARY_FETCH_TIMEOUT_MS = 25_000;
const REPLAY_IMAGE_HEAD_TIMEOUT_MS = 2_500;
const COMPANION_IMAGE_REQUEST_IN_PROGRESS_STATUS = 409;
const IDEMPOTENCY_KEY_MAX_LENGTH = 160;
const COMPANION_IMAGE_BACKGROUND = "transparent" as const;
const COMPANION_IMAGE_OUTPUT_FORMAT = "png" as const;

const TRANSPARENT_COMPANION_OUTPUT_DIRECTION = [
  "COSMIQ COMPANION RENDER CONTRACT (AUTHORITATIVE):",
  ...buildCompanionArtDirection().map((rule) => `- ${rule}`),
].join("\n");

const appendTransparentCompanionOutputDirection = (prompt: string) =>
  `${prompt}\n\n${TRANSPARENT_COMPANION_OUTPUT_DIRECTION}`;

type CompanionImageFlowType =
  | "onboarding"
  | "regenerate"
  | "evolution"
  | "background"
  | "admin"
  | "ai_onboarding_egg";

type TimeoutCode = "AI_TIMEOUT" | "GENERATION_TIMEOUT";

interface TimedRequestError extends Error {
  code: TimeoutCode;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validates and sanitizes hex color codes.
 * Returns the fallback if the input is not a valid hex color.
 */
function ensureValidHex(
  color: string | undefined | null,
  fallback: string,
): string {
  if (!color) return fallback;
  const hexPattern = /^#[0-9A-Fa-f]{6}$/;
  const cleanColor = color.trim();
  if (hexPattern.test(cleanColor)) return cleanColor;
  // Try adding # if missing
  if (/^[0-9A-Fa-f]{6}$/.test(cleanColor)) return `#${cleanColor}`;
  return fallback;
}

function createTimedRequestError(
  code: TimeoutCode,
  timeoutMs: number,
): TimedRequestError {
  const err = new Error(
    `Request timed out after ${timeoutMs}ms`,
  ) as TimedRequestError;
  err.name = "TimedRequestError";
  err.code = code;
  return err;
}

function isTimedRequestError(error: unknown): error is TimedRequestError {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { code?: string }).code !== undefined &&
    ((error as { code?: string }).code === "AI_TIMEOUT" ||
      (error as { code?: string }).code === "GENERATION_TIMEOUT")
  );
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
  timeoutCode: TimeoutCode,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw createTimedRequestError(timeoutCode, timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeFlowType(value: unknown): CompanionImageFlowType {
  if (typeof value !== "string") return "background";
  const normalized = value.trim().toLowerCase();
  if (normalized === "onboarding") return "onboarding";
  if (normalized === "regenerate") return "regenerate";
  if (normalized === "evolution") return "evolution";
  if (normalized === "admin") return "admin";
  if (normalized === "ai_onboarding_egg") return "ai_onboarding_egg";
  return "background";
}

const COMPANION_IMAGE_BUCKET = "mentors-avatars";
const JUDGE_MINIMUMS = {
  overall: 7,
  continuity: 6,
  anatomy: 6,
  styleConsistency: 7,
  compositionConsistency: 7,
  backgroundCutout: 7,
};
const COMPANION_IMAGE_BACKGROUND_GATE_CODE =
  "COMPANION_IMAGE_BACKGROUND_GATE_FAILED";
const COMPANION_IMAGE_QUALITY_GATE_CODE = "COMPANION_IMAGE_QUALITY_GATE_FAILED";
const COMPANION_IMAGE_VALIDATION_UNAVAILABLE_CODE =
  "COMPANION_IMAGE_VALIDATION_UNAVAILABLE";

class CompanionImageQualityGateError extends Error {
  code: string;
  status: number;

  constructor(
    message: string,
    code = COMPANION_IMAGE_BACKGROUND_GATE_CODE,
    status = 422,
  ) {
    super(message);
    this.name = "CompanionImageQualityGateError";
    this.code = code;
    this.status = status;
  }
}

const getJudgeBackgroundCutoutScore = (
  scores: Awaited<ReturnType<typeof judgeCompanionImage>>,
): number =>
  scores && typeof scores.backgroundCutout === "number"
    ? scores.backgroundCutout
    : 0;

const hasJudgeBackgroundCutoutFailure = (
  scores: Awaited<ReturnType<typeof judgeCompanionImage>>,
): boolean =>
  Boolean(scores) &&
  getJudgeBackgroundCutoutScore(scores) < JUDGE_MINIMUMS.backgroundCutout;

const buildBackgroundCutoutGateError = (
  phase: string,
  scores: Awaited<ReturnType<typeof judgeCompanionImage>>,
): CompanionImageQualityGateError =>
  new CompanionImageQualityGateError(
    `Companion ${phase} failed transparent background quality gate: ${
      scores?.notes || "visible background or non-transparent cutout"
    }`,
  );

const buildValidationUnavailableGateError = (
  phase: string,
): CompanionImageQualityGateError =>
  new CompanionImageQualityGateError(
    `Companion ${phase} could not be validated because judge scores were unavailable.`,
    COMPANION_IMAGE_VALIDATION_UNAVAILABLE_CODE,
    502,
  );

const buildCompanionQualityGateError = (
  phase: string,
  scores: Awaited<ReturnType<typeof judgeCompanionImage>>,
): CompanionImageQualityGateError =>
  new CompanionImageQualityGateError(
    `Companion ${phase} did not meet the canonical Cosmiq art, composition, anatomy, or identity standard: ${
      scores?.notes || "candidate did not pass quality review"
    }`,
    COMPANION_IMAGE_QUALITY_GATE_CODE,
  );

const parseDataUrl = (dataUrl: string): Uint8Array => {
  const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  return Uint8Array.from(atob(base64Data), (char) => char.charCodeAt(0));
};

interface SupabaseMutationResult {
  error: { message?: string } | null;
}

interface SupabaseFilterBuilder extends PromiseLike<SupabaseMutationResult> {
  eq: (column: string, value: string) => SupabaseFilterBuilder;
}

interface SupabaseTableBuilder {
  delete: () => SupabaseFilterBuilder;
  upsert: (
    values: Record<string, unknown>,
    options?: { onConflict?: string },
  ) => PromiseLike<SupabaseMutationResult>;
}

interface SupabaseStorageBucket {
  upload: (
    path: string,
    data: Uint8Array,
    options: { contentType: string; upsert: boolean },
  ) => PromiseLike<SupabaseMutationResult>;
  getPublicUrl: (path: string) => { data: { publicUrl: string } };
  remove: (paths: string[]) => PromiseLike<SupabaseMutationResult>;
}

interface SupabaseServiceClient {
  storage: {
    from: (bucketId: string) => SupabaseStorageBucket;
  };
  from: (table: string) => SupabaseTableBuilder;
  rpc: (
    functionName: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
}

type CompanionImageRequestState =
  | { action: "disabled"; requestKey: null }
  | { action: "started"; requestKey: string }
  | {
    action: "completed";
    requestKey: string;
    responsePayload: Record<string, unknown>;
  }
  | { action: "in_progress"; requestKey: string };

const normalizeIdempotencyKey = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    console.warn(
      "[CompanionImageIdempotency] Rejected oversized idempotency key",
      {
        length: trimmed.length,
        maxLength: IDEMPOTENCY_KEY_MAX_LENGTH,
      },
    );
    return null;
  }
  return trimmed;
};

const isReplayImagePayloadUsable = async (
  responsePayload: Record<string, unknown>,
): Promise<boolean> => {
  const imageUrl = typeof responsePayload.imageUrl === "string"
    ? responsePayload.imageUrl.trim()
    : "";
  if (!imageUrl) {
    console.warn(
      "[CompanionImageIdempotency] Completed replay payload has no imageUrl",
    );
    return false;
  }

  try {
    const response = await fetchWithTimeout(
      imageUrl,
      { method: "HEAD" },
      REPLAY_IMAGE_HEAD_TIMEOUT_MS,
      "AI_TIMEOUT",
    );

    if (response.status === 404 || response.status === 410) {
      console.warn(
        "[CompanionImageIdempotency] Completed replay image is missing",
        {
          imageUrl,
          status: response.status,
        },
      );
      return false;
    }

    if (!response.ok) {
      console.warn(
        "[CompanionImageIdempotency] Completed replay image HEAD was inconclusive; reusing cached response",
        {
          imageUrl,
          status: response.status,
        },
      );
    }

    return true;
  } catch (error) {
    console.warn(
      "[CompanionImageIdempotency] Completed replay image HEAD threw; reusing cached response",
      {
        imageUrl,
        error: error instanceof Error ? error.message : String(error),
      },
    );
    return true;
  }
};

const appendRetrySuffixToPath = (filePath: string): string => {
  const dotIndex = filePath.lastIndexOf(".");
  const suffix = `_retry_${Date.now()}`;
  if (dotIndex <= 0) {
    return `${filePath}${suffix}`;
  }
  return `${filePath.slice(0, dotIndex)}${suffix}${filePath.slice(dotIndex)}`;
};

const uploadStorageObjectWithRetry = async ({
  supabase,
  filePath,
  binaryData,
}: {
  supabase: SupabaseServiceClient;
  filePath: string;
  binaryData: Uint8Array;
}): Promise<string> => {
  let lastErrorMessage = "unknown_storage_error";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const attemptedPath = attempt === 0
      ? filePath
      : appendRetrySuffixToPath(filePath);
    const { error: uploadError } = await supabase.storage
      .from(COMPANION_IMAGE_BUCKET)
      .upload(attemptedPath, binaryData, {
        contentType: "image/png",
        upsert: false,
      });

    if (!uploadError) {
      return attemptedPath;
    }

    lastErrorMessage = uploadError.message ?? "unknown_storage_error";
    console.error("[CompanionImageStorageUpload]", {
      attempt: attempt + 1,
      bucketId: COMPANION_IMAGE_BUCKET,
      storagePath: attemptedPath,
      error: lastErrorMessage,
    });
  }

  throw new Error(`Storage upload failed after retry: ${lastErrorMessage}`);
};

const registerUserStorageAssetBestEffort = async ({
  supabase,
  userId,
  bucketId,
  storagePath,
  sourceKind,
}: {
  supabase: SupabaseServiceClient;
  userId: string;
  bucketId: string;
  storagePath: string;
  sourceKind: string;
}): Promise<void> => {
  try {
    await registerUserStorageAsset({
      supabase,
      userId,
      bucketId,
      storagePath,
      sourceKind,
    });
  } catch (error) {
    console.warn(
      "[CompanionImageStorageLedger] Failed to register uploaded asset",
      {
        bucketId,
        storagePath,
        sourceKind,
        error: error instanceof Error ? error.message : String(error),
      },
    );
  }
};

const deleteUploadedAssetBestEffort = async ({
  supabase,
  bucketId,
  storagePath,
  reason,
}: {
  supabase: SupabaseServiceClient;
  bucketId: string;
  storagePath: string;
  reason: string;
}): Promise<void> => {
  try {
    const { error } = await supabase.storage.from(bucketId).remove([
      storagePath,
    ]);
    if (error) {
      console.warn("[CompanionImageStorageCleanup] Storage cleanup failed", {
        bucketId,
        storagePath,
        reason,
        error: error.message ?? "unknown_storage_error",
      });
    }
  } catch (error) {
    console.warn("[CompanionImageStorageCleanup] Storage cleanup threw", {
      bucketId,
      storagePath,
      reason,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const { error } = await supabase
      .from("user_storage_assets")
      .delete()
      .eq("bucket_id", bucketId)
      .eq("storage_path", storagePath);
    if (error) {
      console.warn("[CompanionImageStorageCleanup] Ledger cleanup failed", {
        bucketId,
        storagePath,
        reason,
        error: error.message ?? "unknown_ledger_error",
      });
    }
  } catch (error) {
    console.warn("[CompanionImageStorageCleanup] Ledger cleanup threw", {
      bucketId,
      storagePath,
      reason,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const beginCompanionImageRequest = async ({
  supabase,
  userId,
  idempotencyKey,
}: {
  supabase: SupabaseServiceClient;
  userId: string;
  idempotencyKey: unknown;
}): Promise<CompanionImageRequestState> => {
  const requestKey = normalizeIdempotencyKey(idempotencyKey);
  if (!requestKey) {
    return { action: "disabled", requestKey: null };
  }

  try {
    const { data, error } = await supabase.rpc(
      "begin_companion_image_generation_request",
      {
        p_user_id: userId,
        p_request_key: requestKey,
      },
    );

    if (error) {
      console.warn(
        "[CompanionImageIdempotency] Begin request failed; continuing without idempotency",
        {
          requestKey,
          error: error.message ?? "unknown_rpc_error",
        },
      );
      return { action: "disabled", requestKey: null };
    }

    const row = Array.isArray(data)
      ? (data[0] as Record<string, unknown> | undefined)
      : (data as Record<string, unknown> | undefined);
    const action = typeof row?.action === "string" ? row.action : "started";

    if (action === "completed") {
      const responsePayload =
        row?.response_payload && typeof row.response_payload === "object" &&
          !Array.isArray(row.response_payload)
          ? row.response_payload as Record<string, unknown>
          : {};
      return { action: "completed", requestKey, responsePayload };
    }

    if (action === "in_progress") {
      return { action: "in_progress", requestKey };
    }

    return { action: "started", requestKey };
  } catch (error) {
    console.warn(
      "[CompanionImageIdempotency] Begin request threw; continuing without idempotency",
      {
        requestKey,
        error: error instanceof Error ? error.message : String(error),
      },
    );
    return { action: "disabled", requestKey: null };
  }
};

const completeCompanionImageRequestBestEffort = async ({
  supabase,
  userId,
  requestKey,
  status,
  responsePayload,
  errorMessage,
}: {
  supabase: SupabaseServiceClient;
  userId: string;
  requestKey: string | null;
  status: "completed" | "failed";
  responsePayload?: Record<string, unknown> | null;
  errorMessage?: string | null;
}): Promise<void> => {
  if (!requestKey) return;

  try {
    const { error } = await supabase.rpc(
      "complete_companion_image_generation_request",
      {
        p_user_id: userId,
        p_request_key: requestKey,
        p_status: status,
        p_response_payload: responsePayload ?? null,
        p_error_message: errorMessage ?? null,
      },
    );

    if (error) {
      console.warn("[CompanionImageIdempotency] Complete request failed", {
        requestKey,
        status,
        error: error.message ?? "unknown_rpc_error",
      });
    }
  } catch (error) {
    console.warn("[CompanionImageIdempotency] Complete request threw", {
      requestKey,
      status,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const uploadGeneratedDataUrl = async ({
  supabase,
  userId,
  dataUrl,
  filePath,
  sourceKind,
}: {
  supabase: SupabaseServiceClient;
  userId: string;
  dataUrl: string;
  filePath: string;
  sourceKind: string;
}): Promise<{ filePath: string; publicUrl: string }> => {
  const binaryData = parseDataUrl(dataUrl);
  const uploadedPath = await uploadStorageObjectWithRetry({
    supabase,
    filePath,
    binaryData,
  });

  const { data: { publicUrl } } = supabase.storage.from(COMPANION_IMAGE_BUCKET)
    .getPublicUrl(uploadedPath);
  await registerUserStorageAssetBestEffort({
    supabase,
    userId,
    bucketId: COMPANION_IMAGE_BUCKET,
    storagePath: uploadedPath,
    sourceKind,
  });

  return { filePath: uploadedPath, publicUrl };
};

const judgeScoresPass = ({
  mode,
  scores,
  previousLevel,
  nextLevel,
}: {
  mode: "bootstrap" | "egg" | "evolution";
  scores: Awaited<ReturnType<typeof judgeCompanionImage>>;
  previousLevel?: number;
  nextLevel?: number;
}): boolean => {
  if (!scores) return false;

  if (
    scores.overall < JUDGE_MINIMUMS.overall ||
    scores.continuity < JUDGE_MINIMUMS.continuity ||
    scores.anatomy < JUDGE_MINIMUMS.anatomy ||
    scores.styleConsistency < JUDGE_MINIMUMS.styleConsistency ||
    scores.compositionConsistency < JUDGE_MINIMUMS.compositionConsistency ||
    getJudgeBackgroundCutoutScore(scores) < JUDGE_MINIMUMS.backgroundCutout
  ) {
    return false;
  }

  if (
    mode === "evolution" &&
    typeof previousLevel === "number" &&
    typeof nextLevel === "number" &&
    scores.difference < getEvolutionDifferenceFloor(previousLevel, nextLevel)
  ) {
    return false;
  }

  return true;
};

const rankJudgeScores = (
  scores: Awaited<ReturnType<typeof judgeCompanionImage>>,
): number => {
  if (!scores) return 0;
  return (
    scores.overall * 4 +
    scores.continuity * 3 +
    scores.anatomy * 2 +
    scores.styleConsistency * 3 +
    scores.compositionConsistency * 2 +
    getJudgeBackgroundCutoutScore(scores) * 2 +
    scores.centering +
    scores.difference
  );
};

const resolveJudgeFocalValue = (value: number | null | undefined): number =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : 0.5;

const appendJudgeCritique = (
  prompt: string,
  notes: string | null | undefined,
): string => {
  const critique = typeof notes === "string" ? notes.trim() : "";
  if (!critique) return prompt;
  return `${prompt}\n\nRetry critique:\n- ${critique}`;
};

function generateCharacterDNA(
  spiritAnimal: string,
  element: string,
  favoriteColor: string,
  eyeColor: string | undefined,
  furColor: string | undefined,
  stage: number,
): string {
  const anatomy = getCreatureAnatomy(spiritAnimal);
  const visualStage = getVisualStage(stage);
  const isYouthStage = visualStage <= 2;

  return `
╔══════════════════════════════════════════════════════════════════════════════╗
║                    CHARACTER DNA - IMMUTABLE IDENTITY                        ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ SPECIES: ${spiritAnimal.toUpperCase().padEnd(65)}║
║ Body Type: ${anatomy.bodyType.padEnd(63)}║
╠══════════════════════════════════════════════════════════════════════════════╣
║ Limb Count: EXACTLY ${anatomy.limbCount} limbs | Wings: ${
    anatomy.hasWings ? "YES" : "NO"
  } | Tail: ${anatomy.hasTail ? "YES" : "NO"}${" ".repeat(28)}║
╠══════════════════════════════════════════════════════════════════════════════╣
║ Primary Color: ${favoriteColor.padEnd(59)}║
║ Eye Color: ${(eyeColor || favoriteColor).padEnd(63)}║
║ Surface Color: ${(furColor || favoriteColor).padEnd(58)}║
║ Element: ${element} (ambient effects ONLY, NOT body color)${
    " ".repeat(Math.max(0, 32 - element.length))
  }║
╠══════════════════════════════════════════════════════════════════════════════╣
║ ${isYouthStage ? "YOUTH" : "MATURE"} FEATURES: ${
    (isYouthStage ? anatomy.babyFeatures : anatomy.adultFeatures).substring(
      0,
      60,
    ).padEnd(60)
  }║
║ REAL-WORLD REF: ${anatomy.realWorldRef.substring(0, 58).padEnd(58)}║
║ PROHIBITED: ${anatomy.prohibitedFeatures.substring(0, 62).padEnd(62)}║
╚══════════════════════════════════════════════════════════════════════════════╝`;
}

function getNegativePrompts(stage: number, spiritAnimal: string): string {
  const anatomy = getCreatureAnatomy(spiritAnimal);
  const visualStage = getVisualStage(stage);
  const base = [
    "different color than specified",
    "wrong species features",
    "hybrid creature",
    "human features",
    "wrong number of limbs",
  ];

  const stageNegatives = visualStage <= 2
    ? [
      "muscular build",
      "adult proportions",
      "fierce expression",
      "large size",
      "fully developed wings",
    ]
    : visualStage <= 5
    ? ["baby proportions", "cosmic/divine features", "reality-warping effects"]
    : [];

  const creatureNegatives = [
    ...(!anatomy.hasWings ? ["wings of any kind"] : []),
    ...(!anatomy.hasTail ? ["tail of any kind"] : []),
    ...(anatomy.limbCount === 0 ? ["legs", "arms"] : []),
  ];

  return `\n━━━ DO NOT INCLUDE ━━━\n${
    [...base, ...stageNegatives, ...creatureNegatives].map((n) => `✗ ${n}`)
      .join("\n")
  }\n✗ ${anatomy.prohibitedFeatures}`;
}

// ============================================================================
// MAIN SERVER
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);
  const requestStartedAt = Date.now();
  let promptBuildDurationMs = 0;
  let generationCallDurationMs = 0;
  let qualityCallDurationMs = 0;
  let storageUploadDurationMs = 0;

  const timedResponse = (response: Response, reason: string): Response => {
    const totalDurationMs = Date.now() - requestStartedAt;
    console.log(
      `[CompanionImageTiming] reason=${reason} total_ms=${totalDurationMs} auth_ms=${authDurationMs} prompt_build_ms=${promptBuildDurationMs} generation_ms=${generationCallDurationMs} quality_ms=${qualityCallDurationMs} storage_ms=${storageUploadDurationMs}`,
    );
    return response;
  };

  let authDurationMs = 0;
  let idempotencyRequestKey: string | null = null;
  let idempotencyUserId: string | null = null;
  let idempotencyStarted = false;
  let idempotencySupabase: SupabaseServiceClient | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    idempotencySupabase = supabase as unknown as SupabaseServiceClient;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return timedResponse(
        new Response(
          JSON.stringify({
            error: "No authorization header",
            code: "NO_AUTH_HEADER",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 401,
          },
        ),
        "auth_missing_header",
      );
    }

    const authStartedAt = Date.now();
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      token,
    );
    authDurationMs = Date.now() - authStartedAt;
    console.log(`[CompanionImageTiming] auth_ms=${authDurationMs}`);
    if (authError || !user) {
      return timedResponse(
        new Response(
          JSON.stringify({
            error: "Invalid authentication",
            code: "INVALID_AUTH",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 401,
          },
        ),
        "auth_invalid",
      );
    }

    console.log(`User authenticated: ${user.id}`);
    const costGuardrails = createCostGuardrailSession({
      supabase,
      endpointKey: "generate-companion-image",
      featureKey: "ai_companion_images",
      userId: user.id,
    });
    const guardedFetch = costGuardrails.wrapFetch(fetch);
    await costGuardrails.enforceAccess({
      capabilities: ["image", "text"],
      providers: ["openai"],
    });

    const rateLimit = await checkRateLimit(
      supabase,
      user.id,
      "generate-companion-image",
      RATE_LIMITS["companion-image"],
    );

    if (!rateLimit.allowed) {
      return timedResponse(
        createRateLimitResponse(rateLimit, corsHeaders),
        "rate_limit_blocked",
      );
    }

    const {
      spiritAnimal,
      element,
      stage,
      favoriteColor,
      eyeColor,
      furColor,
      retryAttempt = 0,
      maxInternalRetries,
      storyTone,
      previousStageImageUrl,
      companionId,
      flowType,
      debug = false,
      image_size,
      idempotencyKey,
    } = await req.json();

    console.log(
      `Request - Animal: ${spiritAnimal}, Element: ${element}, Stage: ${stage}, Color: ${favoriteColor}`,
    );

    if (!spiritAnimal) throw new Error("spiritAnimal is required");
    if (!element) throw new Error("element is required");
    if (stage === undefined || stage === null) {
      throw new Error("stage is required");
    }
    if (!favoriteColor) throw new Error("favoriteColor is required");

    const anatomy = getCreatureAnatomy(spiritAnimal);
    const requestedStageNumber = Number(stage);
    if (
      !Number.isInteger(requestedStageNumber) || requestedStageNumber < 0 ||
      requestedStageNumber > PROGRESSION_LEVEL_CAP
    ) {
      throw new Error(`Invalid stage: ${stage}`);
    }
    const stageName = getProgressionTierLabelForLevel(requestedStageNumber);
    const spiritLockProfile = resolveCompanionSpiritLockProfile(spiritAnimal);
    const spiritLockPromptBlock = spiritLockProfile
      ? buildSpiritLockPromptBlock(spiritLockProfile, "image")
      : "";
    const spiritLockActive = Boolean(spiritLockProfile);
    console.log("[SpiritLock]", {
      species: spiritAnimal,
      profile_match: spiritLockProfile?.id ?? null,
      function: "generate-companion-image",
      stage,
    });

    const normalizedFlowType = normalizeFlowType(flowType);
    const fastPathEligible = isCompanionFastPathEligible(user.id);
    const imageSize = resolveCompanionImageSizeForUser(user.id, image_size);
    const visualIdentityProfile = buildCompanionFamilyBible({
      spiritAnimal,
      coreElement: element,
      favoriteColor,
      storyTone,
    });
    const fastRetryLimits = getCompanionFastRetryLimits();
    const standardRetryLimits = getCompanionStandardRetryLimits();
    const hiddenImageQuality = getCompanionHiddenImageQuality();
    const finalImageQuality = getCompanionFinalImageQuality();
    console.log(
      `[CompanionImagePolicy] user=${user.id} flow=${normalizedFlowType} fast_path=${fastPathEligible} image_size=${imageSize} stage0_fast_retries=${fastRetryLimits.stage0} non_stage0_fast_retries=${fastRetryLimits.nonStage0} stage0_retries=${standardRetryLimits.stage0} non_stage0_retries=${standardRetryLimits.nonStage0} hidden_quality=${hiddenImageQuality} final_quality=${finalImageQuality}`,
    );

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY not configured");
      return timedResponse(
        new Response(
          JSON.stringify({
            error: "AI service not configured.",
            code: "AI_SERVICE_NOT_CONFIGURED",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
          },
        ),
        "ai_key_missing",
      );
    }

    if (normalizedFlowType === "ai_onboarding_egg" && Number(stage) === 0) {
      let idempotencyState = await beginCompanionImageRequest({
        supabase,
        userId: user.id,
        idempotencyKey,
      });
      if (idempotencyState.action === "completed") {
        if (
          await isReplayImagePayloadUsable(idempotencyState.responsePayload)
        ) {
          return timedResponse(
            new Response(
              JSON.stringify({
                ...idempotencyState.responsePayload,
                idempotencyReplay: true,
              }),
              {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
              },
            ),
            "success_bootstrap_stage1_first_idempotent_replay",
          );
        }

        await completeCompanionImageRequestBestEffort({
          supabase,
          userId: user.id,
          requestKey: idempotencyState.requestKey,
          status: "failed",
          errorMessage: "Completed replay image URL was unavailable",
        });
        idempotencyState = await beginCompanionImageRequest({
          supabase,
          userId: user.id,
          idempotencyKey: idempotencyState.requestKey,
        });
      }
      if (idempotencyState.action === "completed") {
        if (
          await isReplayImagePayloadUsable(idempotencyState.responsePayload)
        ) {
          return timedResponse(
            new Response(
              JSON.stringify({
                ...idempotencyState.responsePayload,
                idempotencyReplay: true,
              }),
              {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
              },
            ),
            "success_bootstrap_stage1_first_idempotent_replay",
          );
        }

        console.warn(
          "[CompanionImageIdempotency] Completed replay remained unusable after restart attempt; continuing without idempotency",
          {
            requestKey: idempotencyState.requestKey,
          },
        );
        idempotencyState = { action: "disabled", requestKey: null };
      }
      if (idempotencyState.action === "in_progress") {
        return timedResponse(
          new Response(
            JSON.stringify({
              error: "Companion image generation is already in progress.",
              code: "GENERATION_IN_PROGRESS",
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: COMPANION_IMAGE_REQUEST_IN_PROGRESS_STATUS,
            },
          ),
          "idempotency_in_progress",
        );
      }
      if (idempotencyState.action === "started") {
        idempotencyRequestKey = idempotencyState.requestKey;
        idempotencyUserId = user.id;
        idempotencyStarted = true;
      }

      const promptBuildStartedAt = Date.now();
      const starterPromptBase = appendTransparentCompanionOutputDirection(
        buildStage1BootstrapPrompt(visualIdentityProfile),
      );
      const starterPrompt = spiritLockPromptBlock
        ? `${starterPromptBase}\n\nMechanical spirit-lock:\n${spiritLockPromptBlock}`
        : starterPromptBase;
      const eggPromptBase = appendTransparentCompanionOutputDirection(
        buildEggFromStage1Prompt(visualIdentityProfile),
      );
      const eggPrompt = spiritLockPromptBlock
        ? `${eggPromptBase}\n\nMechanical spirit-lock:\n${spiritLockPromptBlock}`
        : eggPromptBase;
      promptBuildDurationMs = Date.now() - promptBuildStartedAt;

      const bootstrapAttempts = Math.max(
        1,
        Math.min(
          MAX_ALLOWED_RETRIES + 1,
          (fastPathEligible
            ? fastRetryLimits.stage0
            : standardRetryLimits.stage0) +
            1,
        ),
      );

      const runJudgedRender = async ({
        mode,
        basePrompt,
        referenceImageUrl,
        previousLevel,
        nextLevel,
        render,
      }: {
        mode: "bootstrap" | "egg" | "evolution";
        basePrompt: string;
        referenceImageUrl?: string | null;
        previousLevel?: number;
        nextLevel?: number;
        render: (
          prompt: string,
        ) => Promise<
          {
            imageDataUrl: string;
            revisedPrompt: string | null;
            size?: string | null;
          }
        >;
      }) =>
        await runCompanionJudgedRender({
          basePrompt,
          attempts: bootstrapAttempts,
          maxAttempts: Math.min(MAX_ALLOWED_RETRIES + 2, bootstrapAttempts + 1),
          render: async (prompt) => await render(prompt),
          judge: async (rendered) =>
            await judgeCompanionImage({
              guardedFetch,
              openAIApiKey: OPENAI_API_KEY,
              profile: visualIdentityProfile,
              mode,
              candidateImageUrl: rendered.imageDataUrl,
              referenceImageUrl,
              previousLevel,
              nextLevel,
            }),
          scoresPass: (scores) =>
            judgeScoresPass({ mode, scores, previousLevel, nextLevel }),
          rankScores: (scores) => rankJudgeScores(scores),
          appendCritique: (prompt, notes) => appendJudgeCritique(prompt, notes),
          onGenerationDurationMs: (durationMs) => {
            generationCallDurationMs += durationMs;
          },
          onJudgeDurationMs: (durationMs) => {
            qualityCallDurationMs += durationMs;
          },
        });

      const stageOneAttempt = await runJudgedRender({
        mode: "bootstrap",
        basePrompt: starterPrompt,
        previousLevel: 0,
        nextLevel: 1,
        render: async (prompt) =>
          await generateCompanionImage({
            guardedFetch,
            openAIApiKey: OPENAI_API_KEY,
            prompt,
            size: imageSize,
            quality: hiddenImageQuality,
            background: COMPANION_IMAGE_BACKGROUND,
            outputFormat: COMPANION_IMAGE_OUTPUT_FORMAT,
            userId: user.id,
          }),
      });

      if (!stageOneAttempt.scores) {
        throw buildValidationUnavailableGateError("hidden stage-1 bootstrap");
      }
      if (hasJudgeBackgroundCutoutFailure(stageOneAttempt.scores)) {
        throw buildBackgroundCutoutGateError(
          "hidden stage-1 bootstrap",
          stageOneAttempt.scores,
        );
      }
      if (!stageOneAttempt.passed) {
        throw buildCompanionQualityGateError(
          "hidden stage-1 bootstrap",
          stageOneAttempt.scores,
        );
      }

      const stageOneUploadStartedAt = Date.now();
      const hiddenStageOne = await uploadGeneratedDataUrl({
        supabase,
        userId: user.id,
        dataUrl: stageOneAttempt.imageDataUrl,
        filePath:
          `${user.id}/companions/bootstrap/stage1_hidden_${Date.now()}.png`,
        sourceKind: "companion_image_hidden_stage1",
      });
      storageUploadDurationMs += Date.now() - stageOneUploadStartedAt;

      let eggAttempt: Awaited<ReturnType<typeof runJudgedRender>>;
      let eggUpload: { filePath: string; publicUrl: string };
      let eggSourceType: "stage1_reference_edit" | "standalone_generation" =
        "stage1_reference_edit";
      let eggReferenceEditFailure: string | null = null;
      try {
        try {
          eggAttempt = await runJudgedRender({
            mode: "egg",
            basePrompt: eggPrompt,
            referenceImageUrl: stageOneAttempt.imageDataUrl,
            render: async (prompt) =>
              await editCompanionImage({
                guardedFetch,
                openAIApiKey: OPENAI_API_KEY,
                prompt,
                size: imageSize,
                quality: finalImageQuality,
                background: COMPANION_IMAGE_BACKGROUND,
                outputFormat: COMPANION_IMAGE_OUTPUT_FORMAT,
                userId: user.id,
                referenceImages: [
                  {
                    imageUrl: hiddenStageOne.publicUrl,
                  },
                ],
              }),
          });
        } catch (eggEditError) {
          eggSourceType = "standalone_generation";
          eggReferenceEditFailure = eggEditError instanceof Error
            ? eggEditError.message.slice(0, 500)
            : String(eggEditError).slice(0, 500);
          console.warn(
            "[CompanionImage] Stage-0 egg reference edit failed; falling back to standalone egg generation",
            {
              userId: user.id,
              stage: 0,
              error: eggReferenceEditFailure,
            },
          );

          eggAttempt = await runJudgedRender({
            mode: "egg",
            basePrompt: eggPrompt,
            referenceImageUrl: stageOneAttempt.imageDataUrl,
            render: async (prompt) =>
              await generateCompanionImage({
                guardedFetch,
                openAIApiKey: OPENAI_API_KEY,
                prompt,
                size: imageSize,
                quality: finalImageQuality,
                background: COMPANION_IMAGE_BACKGROUND,
                outputFormat: COMPANION_IMAGE_OUTPUT_FORMAT,
                userId: user.id,
              }),
          });
        }

        if (!eggAttempt.scores) {
          throw buildValidationUnavailableGateError("stage-0 egg bootstrap");
        }
        if (hasJudgeBackgroundCutoutFailure(eggAttempt.scores)) {
          throw buildBackgroundCutoutGateError(
            "stage-0 egg bootstrap",
            eggAttempt.scores,
          );
        }
        if (!eggAttempt.passed) {
          throw buildCompanionQualityGateError(
            "stage-0 egg bootstrap",
            eggAttempt.scores,
          );
        }

        const eggUploadStartedAt = Date.now();
        eggUpload = await uploadGeneratedDataUrl({
          supabase,
          userId: user.id,
          dataUrl: eggAttempt.imageDataUrl,
          filePath:
            `${user.id}/companions/bootstrap/stage0_egg_${Date.now()}.png`,
          sourceKind: "companion_image",
        });
        storageUploadDurationMs += Date.now() - eggUploadStartedAt;
      } catch (eggError) {
        await deleteUploadedAssetBestEffort({
          supabase,
          bucketId: COMPANION_IMAGE_BUCKET,
          storagePath: hiddenStageOne.filePath,
          reason: "stage0_egg_bootstrap_failed",
        });
        throw eggError;
      }

      const hiddenStageOneFocalX = resolveJudgeFocalValue(
        stageOneAttempt.scores?.subjectCenterX,
      );
      const hiddenStageOneFocalY = resolveJudgeFocalValue(
        stageOneAttempt.scores?.subjectCenterY,
      );
      const eggFocalX = resolveJudgeFocalValue(
        eggAttempt.scores?.subjectCenterX,
      );
      const eggFocalY = resolveJudgeFocalValue(
        eggAttempt.scores?.subjectCenterY,
      );

      type BootstrapQualityWarning = {
        phase: "hidden_stage1" | "egg";
        code: "JUDGE_UNAVAILABLE" | "QUALITY_NOT_APPROVED";
        retryCount: number;
        scores: Awaited<ReturnType<typeof judgeCompanionImage>>;
      };
      const stageOneWarning = !stageOneAttempt.passed
        ? {
          phase: "hidden_stage1" as const,
          code: stageOneAttempt.judgeUnavailable
            ? ("JUDGE_UNAVAILABLE" as const)
            : ("QUALITY_NOT_APPROVED" as const),
          retryCount: stageOneAttempt.retryCount,
          scores: stageOneAttempt.scores,
        }
        : null;
      const eggWarning = !eggAttempt.passed
        ? {
          phase: "egg" as const,
          code: eggAttempt.judgeUnavailable
            ? ("JUDGE_UNAVAILABLE" as const)
            : ("QUALITY_NOT_APPROVED" as const),
          retryCount: eggAttempt.retryCount,
          scores: eggAttempt.scores,
        }
        : null;
      const qualityWarnings = [stageOneWarning, eggWarning]
        .filter(Boolean) as BootstrapQualityWarning[];
      const judgeUnavailable = stageOneAttempt.judgeUnavailable ||
        eggAttempt.judgeUnavailable;

      const imageLineageMetadata = buildInitialImageLineageMetadata({
        eggImageUrl: eggUpload.publicUrl,
        hiddenStageOneImageUrl: hiddenStageOne.publicUrl,
        eggFocalX,
        eggFocalY,
        hiddenStageOneFocalX,
        hiddenStageOneFocalY,
        generationLog: {
          requestedSize: imageSize,
          hiddenStageOne: {
            retryCount: stageOneAttempt.retryCount,
            passedJudge: stageOneAttempt.passed,
            judgeUnavailable: stageOneAttempt.judgeUnavailable,
            size: stageOneAttempt.size,
            scores: stageOneAttempt.scores,
          },
          egg: {
            sourceType: eggSourceType,
            referenceEditFailure: eggReferenceEditFailure,
            retryCount: eggAttempt.retryCount,
            passedJudge: eggAttempt.passed,
            judgeUnavailable: eggAttempt.judgeUnavailable,
            size: eggAttempt.size,
            scores: eggAttempt.scores,
          },
        },
      });

      const responseData: Record<string, unknown> = {
        imageUrl: eggUpload.publicUrl,
        imageFocalX: eggFocalX,
        imageFocalY: eggFocalY,
        visualIdentityProfile,
        imageLineageMetadata,
        hiddenStageOneImageUrl: hiddenStageOne.publicUrl,
        requestedImageSize: imageSize,
        imageSize: eggAttempt.size ?? imageSize,
      };

      if (qualityWarnings.length > 0) {
        responseData.qualityWarning = qualityWarnings[0];
        responseData.qualityWarnings = qualityWarnings;
      }

      if (judgeUnavailable) {
        responseData.judgeUnavailable = true;
      }

      if (debug === true) {
        responseData.bootstrap = {
          starterPrompt,
          eggPrompt,
          starterRevisedPrompt: stageOneAttempt.revisedPrompt,
          eggRevisedPrompt: eggAttempt.revisedPrompt,
        };
      }

      await completeCompanionImageRequestBestEffort({
        supabase,
        userId: user.id,
        requestKey: idempotencyRequestKey,
        status: "completed",
        responsePayload: responseData,
      });

      return timedResponse(
        new Response(JSON.stringify(responseData), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }),
        "success_bootstrap_stage1_first",
      );
    }

    // ========================================================================
    // COMPATIBILITY CALLER PIPELINE
    // The modern AI onboarding flow returns early above with the stage-1-first
    // OpenAI Image API bootstrap. The code below is intentionally kept for
    // regeneration/admin/sample-card callers. These callers now share the
    // canonical OpenAI companion model and Cosmiq render contract too.
    // ========================================================================
    console.info(
      "[CompanionImage] Using compatibility render pipeline",
      {
        flowType: normalizedFlowType,
        stage,
        hasPreviousStageImageUrl: Boolean(previousStageImageUrl),
        companionId: companionId ?? null,
      },
    );

    // ========================================================================
    // VISUAL METADATA EXTRACTION FOR IDENTITY CONTINUITY
    // Instead of I2I (too similar), we analyze the previous image and inject
    // the extracted visual metadata into the T2I prompt for consistency
    // ========================================================================
    let previousImageUrl: string | null = null;
    let extractedMetadata: {
      hexPrimaryColor: string;
      hexEyeColor: string;
      hexAccentColor: string;
      primaryColorDesc: string;
      eyeColorDesc: string;
      markings: string;
      viewingAngle: string;
      pose: string;
      expression: string;
      lightingDirection: string;
      artStyle: string;
      distinctiveFeatures: string;
      overallDescription: string;
    } | null = null;

    if (requestedStageNumber >= 2) {
      if (previousStageImageUrl) {
        previousImageUrl = previousStageImageUrl;
        console.log(
          `Will extract metadata from provided previous stage image (stage ${stage})`,
        );
      } else if (companionId) {
        const { data: prevEvolution } = await supabase
          .from("companion_evolutions")
          .select("image_url")
          .eq("companion_id", companionId)
          .eq("stage", stage - 1)
          .single();

        if (prevEvolution?.image_url) {
          previousImageUrl = prevEvolution.image_url;
          console.log(
            `Fetched previous stage ${stage - 1} image for metadata extraction`,
          );
        }
      }

      // Extract visual metadata using tool calling for guaranteed JSON structure
      if (previousImageUrl) {
        try {
          console.log("Extracting visual metadata using tool calling...");

          const extractionTool = {
            type: "function",
            function: {
              name: "extract_visual_metadata",
              description:
                "Extract detailed visual characteristics from a creature image for consistency in evolution chain",
              parameters: {
                type: "object",
                properties: {
                  hexPrimaryColor: {
                    type: "string",
                    description:
                      "Exact hex code of the primary body/fur color (e.g., #FF6B35)",
                  },
                  hexEyeColor: {
                    type: "string",
                    description:
                      "Exact hex code of the eye color (e.g., #FFD700)",
                  },
                  hexAccentColor: {
                    type: "string",
                    description:
                      "Exact hex code of any accent/secondary color (e.g., #FFFFFF)",
                  },
                  primaryColorDesc: {
                    type: "string",
                    description:
                      "Description of primary color (e.g., warm orange-red)",
                  },
                  eyeColorDesc: {
                    type: "string",
                    description:
                      "Description of eye color (e.g., golden amber)",
                  },
                  markings: {
                    type: "string",
                    description:
                      "Description of patterns, spots, stripes, or unique markings",
                  },
                  viewingAngle: {
                    type: "string",
                    enum: ["front", "side", "3/4 view", "rear 3/4"],
                    description: "Camera angle viewing the creature",
                  },
                  pose: {
                    type: "string",
                    enum: [
                      "sitting",
                      "standing",
                      "lying down",
                      "action/dynamic",
                      "curled up",
                    ],
                    description: "Body pose of the creature",
                  },
                  expression: {
                    type: "string",
                    enum: [
                      "happy",
                      "curious",
                      "fierce",
                      "serene",
                      "playful",
                      "alert",
                    ],
                    description: "Facial expression",
                  },
                  lightingDirection: {
                    type: "string",
                    enum: [
                      "from above",
                      "from side",
                      "from below",
                      "ambient/soft",
                      "dramatic",
                    ],
                    description: "Main light source direction",
                  },
                  artStyle: {
                    type: "string",
                    description:
                      "Rendering style description (e.g., painterly digital art, soft cel shading)",
                  },
                  distinctiveFeatures: {
                    type: "string",
                    description:
                      "Unique physical features that identify this specific creature",
                  },
                  overallDescription: {
                    type: "string",
                    description:
                      "Detailed paragraph describing exactly how this creature looks",
                  },
                },
                required: [
                  "hexPrimaryColor",
                  "hexEyeColor",
                  "primaryColorDesc",
                  "eyeColorDesc",
                  "markings",
                  "viewingAngle",
                  "pose",
                  "expression",
                  "lightingDirection",
                  "artStyle",
                  "distinctiveFeatures",
                  "overallDescription",
                ],
                additionalProperties: false,
              },
            },
          };

          const analysisResponse = await fetchWithTimeout(
            "https://api.openai.com/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [{
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text:
                        `Analyze this ${spiritAnimal} creature image and extract its visual characteristics for consistent evolution. Be precise with hex colors and descriptive with features.`,
                    },
                    { type: "image_url", image_url: { url: previousImageUrl } },
                  ],
                }],
                tools: [extractionTool],
                tool_choice: {
                  type: "function",
                  function: { name: "extract_visual_metadata" },
                },
              }),
            },
            AUXILIARY_FETCH_TIMEOUT_MS,
            "AI_TIMEOUT",
            guardedFetch,
          );

          if (analysisResponse.ok) {
            const analysisData = await analysisResponse.json();
            const toolCall = analysisData.choices?.[0]?.message?.tool_calls
              ?.[0];

            if (toolCall?.function?.arguments) {
              try {
                extractedMetadata = JSON.parse(toolCall.function.arguments);
                console.log(
                  "Successfully extracted visual metadata via tool calling:",
                  extractedMetadata,
                );
              } catch (parseError) {
                console.warn(
                  "Failed to parse tool call arguments:",
                  parseError,
                );
              }
            }

            // Fallback to content parsing if tool calling didn't return expected format
            if (!extractedMetadata) {
              const content = analysisData.choices?.[0]?.message?.content || "";
              if (content) {
                try {
                  let cleanedText = content.trim();
                  if (cleanedText.startsWith("```json")) {
                    cleanedText = cleanedText.slice(7);
                  } else if (cleanedText.startsWith("```")) {
                    cleanedText = cleanedText.slice(3);
                  }
                  if (cleanedText.endsWith("```")) {
                    cleanedText = cleanedText.slice(0, -3);
                  }
                  extractedMetadata = JSON.parse(cleanedText.trim());
                } catch (e) {
                  console.warn("Content fallback parsing failed");
                }
              }
            }

            // Ultimate fallback with user-provided colors
            if (!extractedMetadata) {
              extractedMetadata = {
                hexPrimaryColor: ensureValidHex(favoriteColor, "#FF6B35"),
                hexEyeColor: ensureValidHex(
                  eyeColor || favoriteColor,
                  "#FFD700",
                ),
                hexAccentColor: "#FFFFFF",
                primaryColorDesc: `Color ${favoriteColor}`,
                eyeColorDesc: eyeColor ? `Color ${eyeColor}` : "matching body",
                markings: "none detected",
                viewingAngle: "3/4 view",
                pose: "standing",
                expression: "curious",
                lightingDirection: "from above",
                artStyle: "stylized digital fantasy art",
                distinctiveFeatures: `${spiritAnimal} typical features`,
                overallDescription:
                  `A ${spiritAnimal} creature with ${favoriteColor} coloring`,
              };
            }

            // Sanitize extracted hex colors
            if (extractedMetadata) {
              extractedMetadata.hexPrimaryColor = ensureValidHex(
                extractedMetadata.hexPrimaryColor,
                favoriteColor,
              );
              extractedMetadata.hexEyeColor = ensureValidHex(
                extractedMetadata.hexEyeColor,
                eyeColor || favoriteColor,
              );
              if (extractedMetadata.hexAccentColor) {
                extractedMetadata.hexAccentColor = ensureValidHex(
                  extractedMetadata.hexAccentColor,
                  "#FFFFFF",
                );
              }
            }
          } else {
            console.warn(
              "Metadata extraction API call failed, proceeding without reference",
            );
          }
        } catch (metadataError) {
          if (isTimedRequestError(metadataError)) {
            console.warn(
              "Metadata extraction timed out, proceeding without reference",
            );
          } else {
            console.warn("Error extracting metadata:", metadataError);
          }
        }
      }
    }

    // ========================================================================
    // BUILD THE PROMPT
    // ========================================================================

    const promptBuildStartedAt = Date.now();
    const characterDNA = generateCharacterDNA(
      spiritAnimal,
      element,
      favoriteColor,
      eyeColor,
      furColor,
      stage,
    );
    const negativePrompts = getNegativePrompts(stage, spiritAnimal);
    const storyToneStyle = getStoryToneModifiers(normalizeStoryTone(storyTone));
    const elementOverlay = getElementOverlay(element);
    const spiritLockPromptAddendum = spiritLockPromptBlock
      ? `\n━━━ SPIRIT LOCK ━━━\n${spiritLockPromptBlock}\n`
      : "";

    const retryEnforcement = retryAttempt > 0
      ? `\n━━━ RETRY (Attempt ${retryAttempt}) ━━━\nCRITICAL - Previous had errors:\n- EXACTLY ${anatomy.limbCount} limbs\n- ${
        anatomy.hasWings ? "Include wings" : "NO WINGS"
      }\n- SINGLE HEAD ONLY\n- Reference: ${anatomy.realWorldRef}`
      : "";

    let fullPrompt: string;

    if (requestedStageNumber === 0) {
      fullPrompt = buildAiEggPrompt(visualIdentityProfile);
    } else if (requestedStageNumber === 1) {
      fullPrompt = `${
        buildStage1BootstrapPrompt(visualIdentityProfile)
      }\n\n${storyToneStyle}\n${elementOverlay}${spiritLockPromptAddendum}`;
    } else if (extractedMetadata) {
      // Use prior artwork as identity evidence while the global Cosmiq contract
      // remains authoritative for rendering, framing, lighting, and polish.
      fullPrompt = `${
        buildAiEvolutionPrompt({
          profile: visualIdentityProfile,
          previousLevel: Math.max(1, requestedStageNumber - 1),
          nextLevel: requestedStageNumber,
        })
      }

PRIOR PORTRAIT IDENTITY EVIDENCE
Generate the Level ${requestedStageNumber} (${stageName}) ${spiritAnimal} as the same individual described below.

━━━ EXACT COLOR PALETTE (MANDATORY) ━━━
┌─────────────────────────────────────────────┐
│ PRIMARY: ${extractedMetadata.hexPrimaryColor} (${extractedMetadata.primaryColorDesc})
│ EYES:    ${extractedMetadata.hexEyeColor} (${extractedMetadata.eyeColorDesc})
│ ACCENT:  ${extractedMetadata.hexAccentColor || "#FFFFFF"}
└─────────────────────────────────────────────┘
⚠️ USE THESE EXACT HEX COLORS - DO NOT DEVIATE

━━━ MARKINGS & PATTERNS ━━━
${extractedMetadata.markings}

━━━ PRIOR PRESENTATION EVIDENCE (NON-BINDING) ━━━
• Prior viewing angle: ${extractedMetadata.viewingAngle}
• Prior pose: ${extractedMetadata.pose}
• Prior expression: ${extractedMetadata.expression}
• Prior lighting: ${extractedMetadata.lightingDirection}
Use these only to recognize the individual. Apply the canonical Cosmiq camera, subject scale, safe area, and lighting recipe for this render.

━━━ PRIOR ART-STYLE EVIDENCE (NON-BINDING) ━━━
${extractedMetadata.artStyle}
Preserve compatible identity/material details, but the Cosmiq render contract overrides any conflicting style evidence.

━━━ DISTINCTIVE FEATURES TO PRESERVE ━━━
${extractedMetadata.distinctiveFeatures}

━━━ REFERENCE DESCRIPTION ━━━
${extractedMetadata.overallDescription}

${characterDNA}

${storyToneStyle}
${elementOverlay}
${spiritLockPromptAddendum}
${retryEnforcement}
${negativePrompts}

━━━ SELF-VERIFICATION CHECKLIST ━━━
□ PRIMARY COLOR is ${extractedMetadata.hexPrimaryColor} - verified
□ EYE COLOR is ${extractedMetadata.hexEyeColor} - verified
□ Limb count is EXACTLY ${anatomy.limbCount} - verified
□ ${anatomy.hasWings ? "Wings present" : "NO wings"} - correct
□ Recognizable as the SAME creature, just evolved
□ Canonical Cosmiq render contract, square framing, subject scale, lighting, and finish are all satisfied`;
    } else {
      fullPrompt = `${
        buildAiEvolutionPrompt({
          profile: visualIdentityProfile,
          previousLevel: Math.max(1, requestedStageNumber - 1),
          nextLevel: requestedStageNumber,
        })
      }

${characterDNA}

${storyToneStyle}
${elementOverlay}
${spiritLockPromptAddendum}
${retryEnforcement}
${negativePrompts}

━━━ SELF-VERIFICATION CHECKLIST ━━━
□ Body color is ${favoriteColor} - correct
□ Limb count is EXACTLY ${anatomy.limbCount} - verified
□ ${anatomy.hasWings ? "Wings present" : "NO wings"} - correct
□ Looks like a real ${anatomy.realWorldRef}
□ Canonical Cosmiq render contract, square framing, subject scale, lighting, and finish are all satisfied`;
    }
    fullPrompt = appendTransparentCompanionOutputDirection(fullPrompt);
    promptBuildDurationMs = Date.now() - promptBuildStartedAt;
    console.log(
      `[CompanionImageTiming] prompt_build_ms=${promptBuildDurationMs}`,
    );

    // ========================================================================
    // CALL AI FOR IMAGE GENERATION WITH AUTO-RETRY ON LOW QUALITY
    // ========================================================================

    const stageNumber = Number(stage);
    const adaptiveRetryDefault = fastPathEligible
      ? (stageNumber === 0 ? fastRetryLimits.stage0 : fastRetryLimits.nonStage0)
      : (stageNumber === 0
        ? standardRetryLimits.stage0
        : standardRetryLimits.nonStage0);
    const requestedRetries = typeof maxInternalRetries === "number" &&
        Number.isFinite(maxInternalRetries)
      ? Math.max(
        0,
        Math.min(MAX_ALLOWED_RETRIES, Math.floor(maxInternalRetries)),
      )
      : adaptiveRetryDefault;
    const MAX_INTERNAL_RETRIES = requestedRetries;
    let currentAttempt = 0;
    let imageUrl: string | null = null;
    let lastUpstreamStatus: number | null = null;
    let lastProviderError: string | null = null;
    let lastProviderModel: string | null = null;
    let qualityJudgeUnavailable = false;
    let qualityScore: {
      overall: number;
      limbCount: number;
      speciesFidelity: number;
      colorMatch: number;
      subjectCenterX?: number;
      subjectCenterY?: number;
      centeringScore?: number;
      styleConsistency?: number;
      compositionConsistency?: number;
      materialFidelity?: number;
      backgroundCutout?: number;
      compositionIssues?: string[];
      styleIssues?: string[];
      backgroundIssues?: string[];
      materialIssues?: string[];
      issues: string[];
      shouldRetry: boolean;
    } | null = null;

    while (
      currentAttempt <=
        Math.max(MAX_INTERNAL_RETRIES, qualityJudgeUnavailable ? 1 : 0)
    ) {
      const loggedMaxInternalRetries = Math.max(
        MAX_INTERNAL_RETRIES,
        qualityJudgeUnavailable ? 1 : 0,
      );
      console.log(
        `Calling AI for T2I generation (stage ${stage}, attempt ${
          currentAttempt + 1
        }/${loggedMaxInternalRetries + 1}, ${
          extractedMetadata ? "with metadata" : "no metadata"
        })...`,
      );

      const messageContent = currentAttempt > 0
        ? `${fullPrompt}\n\n━━━ QUALITY RETRY #${currentAttempt} ━━━\nPrevious attempt had issues: ${
          qualityScore?.issues?.join(", ") || "low quality"
        }${
          spiritLockActive
            ? `\nSpirit-lock material issues: ${
              qualityScore?.materialIssues?.join(", ") ||
              "material drift detected"
            }`
            : ""
        }\nPAY EXTRA ATTENTION to anatomical correctness. Ensure EXACTLY ${anatomy.limbCount} limbs.${
          spiritLockActive
            ? "\nKeep Mechanical Dragon identity strictly mechanical."
            : ""
        }`
        : fullPrompt;

      const generationAttemptStartedAt = Date.now();
      try {
        const timedGenerationFetch = ((
          input: RequestInfo | URL,
          init?: RequestInit,
        ) =>
          fetchWithTimeout(
            input instanceof Request
              ? input.url
              : input instanceof URL
              ? input.toString()
              : String(input),
            init ?? {},
            GENERATION_FETCH_TIMEOUT_MS,
            "GENERATION_TIMEOUT",
            guardedFetch,
          )) as typeof fetch;
        const rendered = await generateCompanionImage({
          guardedFetch: timedGenerationFetch,
          openAIApiKey: OPENAI_API_KEY,
          prompt: messageContent,
          size: imageSize,
          quality: finalImageQuality,
          background: COMPANION_IMAGE_BACKGROUND,
          outputFormat: COMPANION_IMAGE_OUTPUT_FORMAT,
          userId: user.id,
        });
        imageUrl = rendered.imageDataUrl;
        lastProviderModel = rendered.model ?? null;
        lastUpstreamStatus = 200;
        generationCallDurationMs += Date.now() - generationAttemptStartedAt;
      } catch (generationError) {
        generationCallDurationMs += Date.now() - generationAttemptStartedAt;
        if (isTimedRequestError(generationError)) {
          console.error("AI generation timed out:", generationError);
          return timedResponse(
            new Response(
              JSON.stringify({
                error: "AI generation timed out. Try again.",
                code: generationError.code,
              }),
              {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 504,
              },
            ),
            "generation_timeout",
          );
        }
        if (isCostGuardrailBlockedError(generationError)) {
          throw generationError;
        }
        if (generationError instanceof OpenAIImageRequestError) {
          lastUpstreamStatus = generationError.status;
          lastProviderError = generationError.responseText.slice(0, 1000);
          lastProviderModel = generationError.model;
          const responseStatus = generationError.status === 429
            ? 429
            : generationError.status === 402
            ? 402
            : 502;
          const responseCode = generationError.status === 429
            ? "RATE_LIMITED"
            : generationError.status === 402
            ? "INSUFFICIENT_CREDITS"
            : "AI_IMAGE_REQUEST_FAILED";
          return timedResponse(
            new Response(
              JSON.stringify({
                error: responseStatus === 429
                  ? "AI service busy. Try again."
                  : responseStatus === 402
                  ? "Insufficient AI credits."
                  : "AI image request failed. Try again.",
                code: responseCode,
                ...(debug === true
                  ? { providerError: lastProviderError, imageSize }
                  : {}),
              }),
              {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: responseStatus,
              },
            ),
            "generation_provider_error",
          );
        }
        console.error("Network error:", generationError);
        return timedResponse(
          new Response(
            JSON.stringify({
              error: "Network error. Try again.",
              code: "NETWORK_ERROR",
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 503,
            },
          ),
          "generation_network_error",
        );
      }
      console.log(
        `[CompanionImageTiming] generation_attempt_ms=${
          Date.now() - generationAttemptStartedAt
        } attempt=${currentAttempt + 1}`,
      );

      if (!imageUrl) {
        console.error("No image URL in response from canonical image client");
        throw new Error("No image URL in response");
      }

      console.log("Image generated, running quality analysis...");

      // ========================================================================
      // QUALITY SCORING - Analyze generated image for anatomical correctness
      // ========================================================================
      qualityScore = null;
      const qualityStartedAt = Date.now();
      let currentAttemptJudgeUnavailable = false;

      try {
        const qualityTool = {
          type: "function",
          function: {
            name: "score_image_quality",
            description:
              "Score the quality and correctness of a generated creature image",
            parameters: {
              type: "object",
              properties: {
                limbCountScore: {
                  type: "number",
                  description:
                    "Score 0-100: Does the creature have the correct number of limbs? 100 = correct, 0 = wrong count",
                },
                actualLimbCount: {
                  type: "number",
                  description:
                    "How many limbs does the creature appear to have?",
                },
                speciesFidelityScore: {
                  type: "number",
                  description:
                    "Score 0-100: How well does this look like the intended species?",
                },
                colorMatchScore: {
                  type: "number",
                  description:
                    "Score 0-100: How well do the colors match the expected palette?",
                },
                subjectCenterX: {
                  type: "number",
                  description:
                    "Normalized 0-1 horizontal center of the visible subject mass. 0.5 means perfectly centered horizontally.",
                },
                subjectCenterY: {
                  type: "number",
                  description:
                    "Normalized 0-1 vertical center of the visible subject mass. 0.5 means perfectly centered vertically.",
                },
                centeringScore: {
                  type: "number",
                  description:
                    "Score 0-100: How naturally centered is the subject within the frame?",
                },
                styleConsistencyScore: {
                  type: "number",
                  description:
                    "Score 0-100: How closely the image follows the canonical Cosmiq polished 2D/2.5D creature-art medium, dark-warm contour finish, softly modeled gradient fills, selective painterly texture, luminous eye treatment, lighting recipe, simplified readable forms, and polish.",
                },
                compositionConsistencyScore: {
                  type: "number",
                  description:
                    "Score 0-100: Full silhouette and effects fit within the 10% safe area, subject fills roughly 68-78% of the square canvas, center is near x=.50/y=.52, and the camera is neutral three-quarter-front without extreme perspective.",
                },
                backgroundCutoutScore: {
                  type: "number",
                  description:
                    "Score 0-100: 100 = isolated subject-only transparent/empty cutout; 0 = visible scenic background, sky, clouds, floor, frame, card, shadow plane, or rectangular backdrop.",
                },
                compositionIssues: {
                  type: "array",
                  items: { type: "string" },
                  description:
                    "List any composition issues such as subject too high, low, left, right, cropped, or visually off-center.",
                },
                styleIssues: {
                  type: "array",
                  items: { type: "string" },
                  description:
                    "List style drift such as photorealism, flat vector diagrams, anime-screen or cel-only rendering, sketch, gritty horror, plastic 3D, extreme chibi, inconsistent lighting, muddy values, or mismatched contour finish.",
                },
                backgroundIssues: {
                  type: "array",
                  items: { type: "string" },
                  description:
                    "List any visible background/backdrop problems such as sky, clouds, landscape, room, floor, frame, card, shadow plane, solid rectangle, or non-transparent canvas.",
                },
                anatomyIssues: {
                  type: "array",
                  items: { type: "string" },
                  description:
                    "List any anatomical issues (extra limbs, wrong body parts, mutations)",
                },
                overallQuality: {
                  type: "number",
                  description:
                    "Overall quality score 0-100 considering all factors",
                },
                materialFidelityScore: {
                  type: "number",
                  description:
                    "Score 0-100: For mechanical species, how well the output preserves mechanical identity (metallic scales, articulated joints, gear motifs, engineered energy core).",
                },
                materialIssues: {
                  type: "array",
                  items: { type: "string" },
                  description:
                    "List spirit-lock issues such as organic drift, missing mechanical anchors, or biological textures.",
                },
              },
              required: [
                "limbCountScore",
                "actualLimbCount",
                "speciesFidelityScore",
                "colorMatchScore",
                "subjectCenterX",
                "subjectCenterY",
                "centeringScore",
                "styleConsistencyScore",
                "compositionConsistencyScore",
                "backgroundCutoutScore",
                "compositionIssues",
                "styleIssues",
                "backgroundIssues",
                "anatomyIssues",
                "overallQuality",
              ],
              additionalProperties: false,
            },
          },
        };

        const qualityPrompt =
          `Analyze this ${spiritAnimal} creature image for quality and correctness.

Expected characteristics:
- Species: ${spiritAnimal}
- Expected limbs: ${anatomy.limbCount}
- Wings expected: ${anatomy.hasWings ? "YES" : "NO"}
- Body type: ${anatomy.bodyType}
- Primary color should be: ${favoriteColor}
- Color variety is allowed: ${favoriteColor} must remain clearly visible as the anchor, while secondary/tertiary accent colors are acceptable
- Estimate the visible subject center as normalized coordinates where the full frame is 0..1 in each direction
- Score how naturally centered the subject appears in the frame; images with the subject pushed too high/low/left/right should score poorly
- Score canonical style strictly: premium polished 2D/2.5D creature-collecting illustration, clean dark-warm contour lines, softly modeled gradient fills, selective painterly texture, luminous expressive eyes, crisp silhouette edges, simplified readable forms, soft neutral upper-left key, gentle cool rim, lifted midtones, and controlled saturated accents. Penalize photorealism, flat vector diagrams, anime-screen or cel-only rendering, sketch, gritty horror, plastic 3D, extreme chibi, muddy lighting, or a different contour finish.
- Score composition strictly: square portrait, neutral eye-level three-quarter-front camera, full silhouette, center near x=0.50/y=0.52, visible subject roughly 68-78% of canvas height, and all anatomy/effects within a 10% safe-area inset.
- Score the background/cutout strictly. The image should be isolated companion-only transparent-background art. Penalize any visible sky, clouds, horizon, landscape, room, floor, frame, card, shadow plane, solid rectangle, or scene-like backdrop.
${
            extractedMetadata
              ? `- Reference eye color: ${extractedMetadata.hexEyeColor}`
              : ""
          }
${
            spiritLockActive
              ? `- SPIRIT LOCK: Mechanical Dragon must remain mechanical.
- Required anchors: metallic scales, articulated joints, gear/clockwork motifs, engineered energy core.
- Forbidden drift: flesh, skin, fur, tissue, muscles, blood, or biological descriptors.
- For this profile, provide materialFidelityScore and materialIssues explicitly.`
              : ""
          }

Score each aspect from 0-100 and list any issues.`;

        const qualityResponse = await fetchWithTimeout(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [{
                role: "user",
                content: [
                  { type: "text", text: qualityPrompt },
                  { type: "image_url", image_url: { url: imageUrl } },
                ],
              }],
              tools: [qualityTool],
              tool_choice: {
                type: "function",
                function: { name: "score_image_quality" },
              },
            }),
          },
          AUXILIARY_FETCH_TIMEOUT_MS,
          "AI_TIMEOUT",
          guardedFetch,
        );
        qualityCallDurationMs += Date.now() - qualityStartedAt;
        console.log(
          `[CompanionImageTiming] quality_attempt_ms=${
            Date.now() - qualityStartedAt
          } attempt=${currentAttempt + 1}`,
        );

        if (qualityResponse.ok) {
          const qualityData = await qualityResponse.json();
          const toolCall = qualityData.choices?.[0]?.message?.tool_calls?.[0];

          if (toolCall?.function?.arguments) {
            const scores = JSON.parse(toolCall.function.arguments);
            const subjectCenterX = typeof scores.subjectCenterX === "number"
              ? Math.max(0, Math.min(1, scores.subjectCenterX))
              : undefined;
            const subjectCenterY = typeof scores.subjectCenterY === "number"
              ? Math.max(0, Math.min(1, scores.subjectCenterY))
              : undefined;
            const centeringScore = typeof scores.centeringScore === "number"
              ? scores.centeringScore
              : undefined;
            const styleConsistency =
              typeof scores.styleConsistencyScore === "number"
                ? scores.styleConsistencyScore
                : 0;
            const compositionConsistency =
              typeof scores.compositionConsistencyScore === "number"
                ? scores.compositionConsistencyScore
                : 0;
            const compositionIssues = Array.isArray(scores.compositionIssues)
              ? scores.compositionIssues.filter((
                value: unknown,
              ): value is string => typeof value === "string")
              : [];
            const styleIssues = Array.isArray(scores.styleIssues)
              ? scores.styleIssues.filter((value: unknown): value is string =>
                typeof value === "string"
              )
              : [];
            const backgroundCutout =
              typeof scores.backgroundCutoutScore === "number"
                ? scores.backgroundCutoutScore
                : 0;
            const backgroundIssues = Array.isArray(scores.backgroundIssues)
              ? scores.backgroundIssues.filter((
                value: unknown,
              ): value is string => typeof value === "string")
              : [];
            const materialFidelity =
              typeof scores.materialFidelityScore === "number"
                ? scores.materialFidelityScore
                : undefined;
            const materialIssues = Array.isArray(scores.materialIssues)
              ? scores.materialIssues
              : [];
            const centeringDistance = typeof subjectCenterX === "number" &&
                typeof subjectCenterY === "number"
              ? Math.hypot(subjectCenterX - 0.5, subjectCenterY - 0.5)
              : null;
            const centeringRetryRequired = (
              typeof centeringScore === "number" ? centeringScore < 65 : false
            ) || (
              centeringDistance !== null ? centeringDistance > 0.18 : false
            );
            const materialRetryRequired = spiritLockActive
              ? (typeof materialFidelity === "number"
                ? materialFidelity < 70
                : true) || materialIssues.length > 0
              : false;
            const backgroundRetryRequired = backgroundCutout < 70 ||
              backgroundIssues.length > 0;
            const styleRetryRequired = styleConsistency < 70 ||
              styleIssues.length > 0;
            const compositionRetryRequired = compositionConsistency < 70 ||
              compositionIssues.length > 0;
            qualityScore = {
              overall: scores.overallQuality || 0,
              limbCount: scores.limbCountScore || 0,
              speciesFidelity: scores.speciesFidelityScore || 0,
              colorMatch: scores.colorMatchScore || 0,
              subjectCenterX,
              subjectCenterY,
              centeringScore,
              styleConsistency,
              compositionConsistency,
              compositionIssues,
              styleIssues,
              backgroundCutout,
              backgroundIssues,
              materialFidelity,
              materialIssues,
              issues: [
                ...(Array.isArray(scores.anatomyIssues)
                  ? scores.anatomyIssues
                  : []),
                ...compositionIssues,
                ...styleIssues,
                ...backgroundIssues,
              ],
              shouldRetry: scores.overallQuality < 70 ||
                scores.limbCountScore < 60 ||
                scores.speciesFidelityScore < 70 ||
                scores.colorMatchScore < 65 ||
                backgroundRetryRequired ||
                styleRetryRequired ||
                compositionRetryRequired ||
                materialRetryRequired ||
                centeringRetryRequired,
            };
            console.log("Quality analysis:", qualityScore);
            if (spiritLockActive) {
              console.log("[SpiritLock]", {
                species: spiritAnimal,
                profile_match: spiritLockProfile?.id ?? null,
                function: "generate-companion-image",
                stage,
                phase: currentAttempt === 0 ? "first_pass" : "retry_pass",
                material_fidelity: materialFidelity ?? null,
                material_issues: materialIssues,
                retry_required: materialRetryRequired,
              });
            }
          } else {
            currentAttemptJudgeUnavailable = true;
            qualityJudgeUnavailable = true;
          }
        } else {
          currentAttemptJudgeUnavailable = true;
          qualityJudgeUnavailable = true;
          console.warn(
            "Quality analysis request failed (non-blocking):",
            qualityResponse.status,
          );
        }
      } catch (qualityError) {
        qualityCallDurationMs += Date.now() - qualityStartedAt;
        currentAttemptJudgeUnavailable = true;
        qualityJudgeUnavailable = true;
        console.log(
          `[CompanionImageTiming] quality_attempt_ms=${
            Date.now() - qualityStartedAt
          } attempt=${currentAttempt + 1} status=error`,
        );
        if (isTimedRequestError(qualityError)) {
          console.warn("Quality analysis timed out (non-blocking)");
        } else {
          console.warn("Quality analysis failed (non-blocking):", qualityError);
        }
      }

      // Check if we should retry
      const effectiveMaxInternalRetries = Math.max(
        MAX_INTERNAL_RETRIES,
        currentAttemptJudgeUnavailable ? 1 : 0,
      );
      if (
        !qualityScore && currentAttemptJudgeUnavailable &&
        currentAttempt < effectiveMaxInternalRetries
      ) {
        console.log(
          `Quality judge unavailable, retrying once before accepting an unvalidated image... (${
            currentAttempt + 1
          }/${effectiveMaxInternalRetries})`,
        );
        currentAttempt++;
        continue;
      }

      if (
        qualityScore?.shouldRetry &&
        currentAttempt < effectiveMaxInternalRetries
      ) {
        console.log(
          `Quality too low (overall: ${qualityScore.overall}, limbs: ${qualityScore.limbCount}, centering: ${
            qualityScore.centeringScore ?? "n/a"
          }, background: ${
            qualityScore.backgroundCutout ?? "n/a"
          }), retrying... (${
            currentAttempt + 1
          }/${effectiveMaxInternalRetries})`,
        );
        currentAttempt++;
        continue;
      }

      // Quality acceptable or max retries reached. Failed final candidates are
      // rejected by the quality gate below and are never uploaded.
      if (qualityScore?.shouldRetry) {
        console.log(
          `Rejecting image after ${
            currentAttempt + 1
          } attempts despite quality issues`,
        );
      }
      break;
    }

    // ========================================================================
    // UPLOAD TO STORAGE
    // ========================================================================
    if (!imageUrl) {
      console.error("[CompanionImageGenerationFailure]", {
        stage,
        flowType: normalizedFlowType,
        model: lastProviderModel ?? "openai-companion-image-client",
        imageSize,
        attempts: currentAttempt + 1,
        lastUpstreamStatus,
        lastProviderError,
        finalQualityScore: qualityScore,
        judgeUnavailable: qualityJudgeUnavailable,
      });
      throw new Error(
        `No image was generated after all attempts (model=${
          lastProviderModel ?? "openai-companion-image-client"
        }, image_size=${imageSize}, attempts=${
          currentAttempt + 1
        }, last_upstream_status=${
          lastUpstreamStatus ?? "n/a"
        }, final_quality_overall=${qualityScore?.overall ?? "n/a"})`,
      );
    }

    if (!qualityScore && qualityJudgeUnavailable) {
      return timedResponse(
        new Response(
          JSON.stringify({
            error: "Generated companion image could not be validated.",
            code: COMPANION_IMAGE_VALIDATION_UNAVAILABLE_CODE,
            judgeUnavailable: true,
            qualityWarning: {
              phase: "legacy_render",
              code: "JUDGE_UNAVAILABLE",
              retryCount: currentAttempt,
              scores: null,
            },
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 502,
          },
        ),
        "quality_gate_unavailable",
      );
    }

    const finalBackgroundIssues = qualityScore?.backgroundIssues ?? [];
    const finalBackgroundCutoutFailed = Boolean(
      qualityScore &&
        ((qualityScore.backgroundCutout ?? 0) < 70 ||
          finalBackgroundIssues.length > 0),
    );
    if (finalBackgroundCutoutFailed) {
      return timedResponse(
        new Response(
          JSON.stringify({
            error:
              "Generated companion image failed transparent background validation.",
            code: "COMPANION_IMAGE_BACKGROUND_GATE_FAILED",
            qualityScore,
            qualityWarning: {
              phase: "legacy_render",
              code: "QUALITY_NOT_APPROVED",
              retryCount: currentAttempt,
              scores: qualityScore,
            },
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 422,
          },
        ),
        "background_quality_failed",
      );
    }

    if (qualityScore?.shouldRetry) {
      return timedResponse(
        new Response(
          JSON.stringify({
            error:
              "Generated companion image did not meet Cosmiq's art, composition, anatomy, or identity quality standard.",
            code: "COMPANION_IMAGE_QUALITY_GATE_FAILED",
            qualityScore,
            retryable: true,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 422,
          },
        ),
        "companion_quality_failed",
      );
    }

    console.log("Uploading to storage...");
    const storageStartedAt = Date.now();

    const base64Data = imageUrl.split(",")[1];
    const binaryData = Uint8Array.from(
      atob(base64Data),
      (c) => c.charCodeAt(0),
    );
    const filePath =
      `${user.id}/companion_${user.id}_stage${stage}_${Date.now()}.png`;

    const uploadedPath = await uploadStorageObjectWithRetry({
      supabase,
      filePath,
      binaryData,
    });

    const { data: { publicUrl } } = supabase.storage.from("mentors-avatars")
      .getPublicUrl(uploadedPath);
    await registerUserStorageAssetBestEffort({
      supabase,
      userId: user.id,
      bucketId: "mentors-avatars",
      storagePath: uploadedPath,
      sourceKind: "companion_image",
    });
    storageUploadDurationMs = Date.now() - storageStartedAt;
    console.log(`[CompanionImageTiming] storage_ms=${storageUploadDurationMs}`);

    console.log(`Uploaded: ${publicUrl}`);

    // Return response with quality score
    const responseData: Record<string, unknown> = {
      imageUrl: publicUrl,
      imageFocalX: qualityScore?.subjectCenterX ?? 0.5,
      imageFocalY: qualityScore?.subjectCenterY ?? 0.5,
      visualIdentityProfile,
      requestedImageSize: imageSize,
      imageSize,
    };
    if (debug === true) {
      responseData.prompt = fullPrompt;
    }

    if (qualityScore) {
      responseData.qualityScore = {
        ...qualityScore,
        overallScore: qualityScore.overall,
        retryCount: currentAttempt,
      };
    }

    if (extractedMetadata) {
      responseData.extractedMetadata = extractedMetadata;
    }

    return timedResponse(
      new Response(JSON.stringify(responseData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }),
      "success",
    );
  } catch (error) {
    if (idempotencyStarted && idempotencyUserId && idempotencySupabase) {
      await completeCompanionImageRequestBestEffort({
        supabase: idempotencySupabase,
        userId: idempotencyUserId,
        requestKey: idempotencyRequestKey,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }

    if (isCostGuardrailBlockedError(error)) {
      return timedResponse(
        buildCostGuardrailBlockedResponse(error, corsHeaders),
        "cost_guardrail_blocked",
      );
    }
    if (isTimedRequestError(error)) {
      return timedResponse(
        new Response(
          JSON.stringify({
            error: "AI request timed out. Please try again.",
            code: error.code,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 504,
          },
        ),
        "timed_request_error",
      );
    }
    if (error instanceof CompanionImageQualityGateError) {
      return timedResponse(
        new Response(
          JSON.stringify({ error: error.message, code: error.code }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: error.status,
          },
        ),
        "quality_gate_failed",
      );
    }
    console.error("Error:", error);
    return timedResponse(
      new Response(
        JSON.stringify({
          error: error instanceof Error
            ? error.message
            : "Internal server error",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        },
      ),
      "unhandled_error",
    );
  }
});
