import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// CHARACTER DNA SYSTEM - All 65 creatures with exact anatomical specifications
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

const CREATURE_ANATOMY: Record<string, CreatureAnatomy> = {
  // === CANINES ===
  "Wolf": {
    category: "canine",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped",
    babyFeatures: "oversized floppy ears, round snout, fluffy round body, huge paws relative to body, soft puppy fur",
    adultFeatures: "pointed erect ears, long elegant snout, thick fur ruff around neck, bushy tail, muscular shoulders",
    anatomyNotes: "Digitigrade legs, 4 toes per foot with non-retractable claws, distinctive wolf ear shape, golden/amber eyes typical",
    prohibitedFeatures: "wings, horns, multiple tails, scales, extra heads",
    realWorldRef: "grey wolf, timber wolf"
  },
  "Fox": {
    category: "canine",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped",
    babyFeatures: "ENORMOUS ears relative to tiny head, button nose, fluffy round body, tiny legs",
    adultFeatures: "large pointed triangular ears, slender elegant build, extremely bushy tail, narrow pointed snout, white chest",
    anatomyNotes: "Slender legs, smaller than wolf, distinctive ear-to-head ratio is KEY feature, vertical slit pupils",
    prohibitedFeatures: "wings, multiple tails (unless Kitsune), horns, blunt snout",
    realWorldRef: "red fox"
  },
  "Arctic Fox": {
    category: "canine",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped",
    babyFeatures: "pure white fluffy ball, tiny dark nose, small rounded ears, extra fluffy coat",
    adultFeatures: "thick white/silver coat, compact body, small rounded ears (heat retention), bushy tail wraps around body",
    anatomyNotes: "Compact body for cold, SHORTER snout than red fox, SMALL ears (unlike other foxes), thick fur on paws",
    prohibitedFeatures: "wings, horns, long ears (ears MUST be small and rounded)",
    realWorldRef: "arctic fox in winter coat"
  },
  "Fennec Fox": {
    category: "canine",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped",
    babyFeatures: "ABSOLUTELY ENORMOUS ears even as baby (signature feature), tiny cream-colored fluffy body",
    adultFeatures: "MASSIVE bat-like ears (larger than head width), tiny body, cream/sand coloring, large dark eyes",
    anatomyNotes: "SMALLEST canine species, ears are 6 inches on 8-inch body - ears MUST be comically oversized, huge eyes for nocturnal hunting",
    prohibitedFeatures: "wings, small ears (ears MUST be ENORMOUS - this is non-negotiable), large body",
    realWorldRef: "fennec fox"
  },
  "Dog": {
    category: "canine",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped",
    babyFeatures: "floppy ears, round puppy face, oversized paws, soft puppy fur, short snout",
    adultFeatures: "friendly expression, floppy or erect ears depending on breed, wagging tail, loyal loving eyes",
    anatomyNotes: "Domesticated wolf descendant, expressive face, can have variety of ear shapes, 4 toes visible per foot",
    prohibitedFeatures: "wings, horns, scales, cat features",
    realWorldRef: "golden retriever, german shepherd"
  },
  "Hyena": {
    category: "canine-like",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped",
    babyFeatures: "spotted fluffy fur, rounded ears, short snout, compact round body",
    adultFeatures: "sloped back (front higher than rear), large rounded ears, powerful jaw, spotted coat, mane along spine",
    anatomyNotes: "UNIQUE sloped back profile (front legs longer than back), large rounded ears, powerful neck and jaw muscles",
    prohibitedFeatures: "wings, level back (back MUST slope down), wolf-like proportions",
    realWorldRef: "spotted hyena"
  },
  "Tanuki": {
    category: "canine",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped",
    babyFeatures: "round fluffy body, dark mask markings around eyes, stubby legs, round face",
    adultFeatures: "raccoon-like mask markings, fluffy body, bushy striped tail, round face, short legs",
    anatomyNotes: "Japanese raccoon dog - NOT a raccoon, rounder body than fox, distinctive dark eye mask, fluffy cheeks",
    prohibitedFeatures: "wings, raccoon hands (these are paws not hands), tall legs",
    realWorldRef: "Japanese raccoon dog (tanuki)"
  },
  
  // === MYTHICAL CANINES ===
  "Fenrir": {
    category: "mythical-canine",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped-giant",
    babyFeatures: "oversized wolf pup with fierce eyes, dark/shadow fur, tiny fangs visible, intense gaze even as baby",
    adultFeatures: "MASSIVE wolf of world-ending scale, chains/bindings often depicted, enormous fangs, cosmic-dark fur",
    anatomyNotes: "Norse giant wolf - WOLF anatomy but at colossal scale, glowing fierce eyes, thick shaggy fur, massive paws",
    prohibitedFeatures: "wings, multiple heads, non-wolf features, small size at adult stages",
    realWorldRef: "giant wolf from Norse mythology"
  },
  "Cerberus": {
    category: "mythical-canine",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped-multihead",
    babyFeatures: "THREE adorable puppy heads sharing one body, dark fur, red/orange eyes, stubby legs",
    adultFeatures: "THREE fierce dog heads on one muscular body, dark fur, hellfire eyes, serpent tail possible, massive",
    anatomyNotes: "EXACTLY THREE HEADS (no more, no less), single powerful body, each head can have different expression, Greek hellhound",
    prohibitedFeatures: "wings, two heads, one head, more than three heads, non-dog features",
    realWorldRef: "three-headed Greek hellhound"
  },
  
  // === FELINES ===
  "Cat": {
    category: "feline",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped",
    babyFeatures: "huge eyes relative to face, tiny triangle ears, fluffy round body, short stubby legs",
    adultFeatures: "elegant slender body, pointed triangle ears, expressive almond eyes, long graceful tail",
    anatomyNotes: "Retractable claws, vertical slit pupils, whiskers, pink nose pad, 5 front toes 4 back toes",
    prohibitedFeatures: "wings, floppy ears, blunt face, dog-like features",
    realWorldRef: "domestic cat"
  },
  "Lion": {
    category: "feline",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped",
    babyFeatures: "spotted fluffy cub, oversized paws, round face, no mane yet, playful expression",
    adultFeatures: "MALES: magnificent mane framing face, powerful muscular build, tufted tail, regal posture",
    anatomyNotes: "Largest African cat, males have mane (females don't), tufted tail tip, rounded ears, golden eyes",
    prohibitedFeatures: "wings, stripes, mane on female lions, long fur on body (only mane is long)",
    realWorldRef: "African lion"
  },
  "Tiger": {
    category: "feline",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped",
    babyFeatures: "fluffy striped cub, oversized paws, round face, blue eyes (cubs have blue eyes)",
    adultFeatures: "bold black stripes on orange coat, white chest/belly, powerful build, distinctive facial markings",
    anatomyNotes: "STRIPES are unique like fingerprints, white spots behind ears, amber eyes (adult), massive paws",
    prohibitedFeatures: "wings, spots instead of stripes, mane, solid color coat",
    realWorldRef: "Bengal tiger, Siberian tiger"
  },
  "Panther": {
    category: "feline",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped",
    babyFeatures: "solid dark fluffy cub, golden/green eyes stand out against dark fur, oversized paws",
    adultFeatures: "sleek solid black/dark coat, muscular build, glowing golden or green eyes, rosettes visible in certain light",
    anatomyNotes: "Actually melanistic leopard/jaguar - may have faint rosettes visible, extremely muscular, luminous eyes",
    prohibitedFeatures: "wings, obvious spots/stripes, mane, blue eyes",
    realWorldRef: "black panther (melanistic leopard)"
  },
  "Snow Leopard": {
    category: "feline",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped",
    babyFeatures: "fluffy grey-white spotted cub, EXTREMELY long fluffy tail, blue-grey eyes",
    adultFeatures: "pale grey coat with black rosettes, EXTREMELY LONG thick tail (for balance), small rounded ears",
    anatomyNotes: "SIGNATURE: Tail is almost as long as body and very thick/fluffy, pale grey-white coat, rosette patterns, GREEN eyes",
    prohibitedFeatures: "wings, short tail, orange coloring, stripes",
    realWorldRef: "snow leopard"
  },
  "Cheetah": {
    category: "feline",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped-lean",
    babyFeatures: "fluffy grey mane down back, spotted coat, oversized paws, black tear marks on face",
    adultFeatures: "LEAN athletic build, solid black spots (NOT rosettes), distinctive black tear marks from eyes to mouth",
    anatomyNotes: "LEANEST cat - built for speed, solid spots NOT rosettes, black tear lines on face are SIGNATURE, small round head",
    prohibitedFeatures: "wings, muscular bulky build, rosettes, missing tear marks",
    realWorldRef: "cheetah"
  },
  "Jaguar": {
    category: "feline",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped",
    babyFeatures: "fluffy spotted cub with rosettes, stocky build even as baby, large paws",
    adultFeatures: "stocky powerful build, rosettes with spots inside them, massive jaw muscles, shorter legs than leopard",
    anatomyNotes: "STOCKIEST big cat, rosettes have SPOTS INSIDE them (unlike leopard), massive head and jaw, short powerful legs",
    prohibitedFeatures: "wings, lean build, solid spots, missing spots-in-rosettes",
    realWorldRef: "jaguar"
  },
  "Lynx": {
    category: "feline",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped",
    babyFeatures: "fluffy spotted kitten, ear tufts already visible, short stubby tail, big paws",
    adultFeatures: "distinctive black EAR TUFTS, spotted coat, very short bobbed tail, ruff of fur around face, large paws",
    anatomyNotes: "SIGNATURE: Black tufts on ear tips, very SHORT tail (bobbed), facial ruff, long legs, spotted coat",
    prohibitedFeatures: "wings, long tail, missing ear tufts, smooth ears",
    realWorldRef: "Eurasian lynx, Canadian lynx"
  },
  "Puma / Cougar": {
    category: "feline",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped",
    babyFeatures: "SPOTTED cubs (they lose spots as adults), blue eyes, oversized paws",
    adultFeatures: "solid tawny/tan coat (NO spots as adult), small round head, long tail with dark tip, muscular build",
    anatomyNotes: "Adults are SOLID colored (not spotted), small head relative to body, long thick tail, can purr unlike big cats",
    prohibitedFeatures: "wings, spots on adults, mane, stripes",
    realWorldRef: "mountain lion, cougar, puma"
  },
  
  // === MYTHICAL FELINES ===
  "Sphinx": {
    category: "mythical-feline",
    limbCount: 4,
    hasWings: true,
    hasTail: true,
    bodyType: "quadruped-winged",
    babyFeatures: "lion cub body with small wing nubs, human-like wise eyes, short coat",
    adultFeatures: "lion body with large eagle/feathered wings, serene wise expression, regal posture, often shown with headdress",
    anatomyNotes: "Egyptian: lion body + wings + wise expression (NOT human head in this fantasy version), majestic feathered wings",
    prohibitedFeatures: "human head, multiple heads, serpent features",
    realWorldRef: "Egyptian sphinx with wings"
  },
  "Kitsune": {
    category: "mythical-feline",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped-multitail",
    babyFeatures: "adorable fox kit with 1-2 small fluffy tails, white/golden fur, large ears",
    adultFeatures: "elegant fox with MULTIPLE flowing tails (up to 9), white/golden/silver fur, mystical flames, wise eyes",
    anatomyNotes: "Japanese fox spirit - MORE TAILS = MORE POWERFUL (1-9 tails), often white/gold/silver, fox fire flames, elegant",
    prohibitedFeatures: "wings, single tail at high stages, non-fox body",
    realWorldRef: "Japanese nine-tailed fox spirit"
  },
  
  // === DRAGONS & REPTILES ===
  "Dragon": {
    category: "dragon",
    limbCount: 4,
    hasWings: true,
    hasTail: true,
    bodyType: "quadruped-winged",
    babyFeatures: "small cute dragon with oversized head, tiny wing nubs, stubby tail, soft scales, big curious eyes",
    adultFeatures: "4 legs + 2 wings (6 limbs total), scales, horns, powerful tail, fire/element breath, majestic wingspan",
    anatomyNotes: "Western dragon: 4 legs + 2 wings = 6 limbs total, scales cover body, horns on head, powerful claws, long neck",
    prohibitedFeatures: "feathers instead of scales, no wings, more than 6 limbs, furry body",
    realWorldRef: "Western European dragon"
  },
  "Wyvern": {
    category: "dragon",
    limbCount: 2,
    hasWings: true,
    hasTail: true,
    bodyType: "biped-winged",
    babyFeatures: "small wyvern with oversized wings that serve as front limbs, 2 back legs, big eyes",
    adultFeatures: "2 back legs ONLY, wings ARE the front limbs (like a bat), barbed tail, sleek predatory build",
    anatomyNotes: "ONLY 2 legs + 2 wings (4 limbs total), wings double as front limbs, often has barbed/poisoned tail tip",
    prohibitedFeatures: "4 legs (wyverns have 2 legs only), front legs separate from wings",
    realWorldRef: "wyvern - bat-like dragon with 2 legs"
  },
  "Hydra": {
    category: "dragon",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped-multihead",
    babyFeatures: "small serpentine creature with 2-3 small heads, scales, stubby legs",
    adultFeatures: "MULTIPLE serpentine heads (5-9 typical) on long necks from one body, reptilian, no wings, powerful legs",
    anatomyNotes: "MULTIPLE HEADS on long serpentine necks, regenerating heads in myth, no wings, dragon-like body",
    prohibitedFeatures: "wings, single head, feathers, fur",
    realWorldRef: "Greek Lernaean Hydra"
  },
  "Basilisk": {
    category: "reptile",
    limbCount: 0,
    hasWings: false,
    hasTail: true,
    bodyType: "serpent",
    babyFeatures: "small serpent with crown-like crest on head, scales, large deadly eyes",
    adultFeatures: "massive serpent with crown/crest, deadly gaze, iridescent scales, no limbs, may have small wings",
    anatomyNotes: "King of serpents - crown-like crest, deadly gaze, serpentine body with NO legs, may have vestigial wings",
    prohibitedFeatures: "legs, chicken features (that's a cockatrice), fur",
    realWorldRef: "mythological basilisk serpent"
  },
  "T-Rex": {
    category: "dinosaur",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "biped",
    babyFeatures: "adorable baby T-Rex with oversized head, tiny arms, fluffy feathers possible, big curious eyes",
    adultFeatures: "massive bipedal dinosaur, TINY arms with 2 fingers, enormous head with massive teeth, powerful legs, long tail",
    anatomyNotes: "Bipedal on 2 powerful legs, TINY useless arms with 2 fingers, massive skull and teeth, horizontal body balanced by tail",
    prohibitedFeatures: "wings, long arms, quadruped stance, no teeth",
    realWorldRef: "Tyrannosaurus Rex"
  },
  "Velociraptor": {
    category: "dinosaur",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "biped",
    babyFeatures: "small feathered raptor, big intelligent eyes, tiny claws, fluffy down feathers",
    adultFeatures: "sleek feathered raptor, large sickle claw on each foot, intelligent eyes, FEATHERS covering body",
    anatomyNotes: "Actually had FEATHERS, sickle-shaped killing claw on each foot, intelligent pack hunter, NOT scaly like in movies",
    prohibitedFeatures: "wings, scales (they had feathers), large size (they were turkey-sized)",
    realWorldRef: "feathered velociraptor (scientifically accurate)"
  },
  "Crocodile": {
    category: "reptile",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped-low",
    babyFeatures: "tiny croc with oversized head, eyes on top of head, little teeth visible, yellow-green coloring",
    adultFeatures: "armored scaly body, long snout with visible teeth, eyes and nostrils on top of head, powerful tail",
    anatomyNotes: "Low-slung body, eyes/nostrils on TOP of head (for water surface), interlocking teeth visible, armored scales",
    prohibitedFeatures: "wings, fur, upright stance, alligator snout shape",
    realWorldRef: "saltwater crocodile, Nile crocodile"
  },
  "Snake": {
    category: "reptile",
    limbCount: 0,
    hasWings: false,
    hasTail: true,
    bodyType: "serpent",
    babyFeatures: "small coiled serpent, tiny scales, curious forked tongue, bright eyes",
    adultFeatures: "elegant serpent body, scales, forked tongue, no limbs, mesmerizing eyes, various patterns possible",
    anatomyNotes: "NO LIMBS at all, scales covering entire body, forked tongue for sensing, can be any color/pattern",
    prohibitedFeatures: "legs, arms, wings, fur, ears",
    realWorldRef: "python, cobra, any snake"
  },
  "Sea Turtle": {
    category: "reptile-aquatic",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped-flippers",
    babyFeatures: "tiny turtle with oversized shell, flipper limbs, big dark eyes, cute round head",
    adultFeatures: "large domed shell, powerful flipper limbs (NOT legs), beak-like mouth, wise ancient eyes",
    anatomyNotes: "FLIPPERS not legs (cannot walk on land well), domed shell, beak-like mouth without teeth, ancient appearance",
    prohibitedFeatures: "legs/feet (has flippers), teeth, wings",
    realWorldRef: "green sea turtle, leatherback"
  },
  
  // === BIRDS ===
  "Eagle": {
    category: "bird",
    limbCount: 2,
    hasWings: true,
    hasTail: true,
    bodyType: "biped-winged",
    babyFeatures: "fluffy grey/white chick, oversized beak, downy feathers, large eyes, wobbly stance",
    adultFeatures: "powerful hooked beak, fierce golden eyes, massive wingspan, sharp talons, white head (bald eagle)",
    anatomyNotes: "2 legs with powerful talons, 2 wings, hooked beak, fierce forward-facing eyes, feathered body",
    prohibitedFeatures: "4 legs, teeth, fur, scales on body",
    realWorldRef: "bald eagle, golden eagle"
  },
  "Falcon": {
    category: "bird",
    limbCount: 2,
    hasWings: true,
    hasTail: true,
    bodyType: "biped-winged",
    babyFeatures: "fluffy white chick, oversized head, dark eyes, downy feathers",
    adultFeatures: "sleek aerodynamic body, pointed wings, dark facial markings, extremely fast, sharp talons",
    anatomyNotes: "FASTEST animal alive, pointed swept-back wings, dark mustache marks on face, smaller than eagle",
    prohibitedFeatures: "4 legs, rounded wings, teeth, large bulky build",
    realWorldRef: "peregrine falcon"
  },
  "Hawk": {
    category: "bird",
    limbCount: 2,
    hasWings: true,
    hasTail: true,
    bodyType: "biped-winged",
    babyFeatures: "fluffy chick with large eyes, downy feathers, oversized feet",
    adultFeatures: "broad rounded wings, keen eyes, hooked beak, banded tail feathers, powerful talons",
    anatomyNotes: "Broader wings than falcon, red-tailed variety has distinctive rust-colored tail, fierce gaze",
    prohibitedFeatures: "4 legs, teeth, fur, pointed falcon-like wings",
    realWorldRef: "red-tailed hawk"
  },
  "Owl": {
    category: "bird",
    limbCount: 2,
    hasWings: true,
    hasTail: true,
    bodyType: "biped-winged",
    babyFeatures: "round fluffy owlet, ENORMOUS eyes, heart-shaped or round face, downy white/grey feathers",
    adultFeatures: "round flat face, ENORMOUS forward-facing eyes, ear tufts (some species), silent flight feathers",
    anatomyNotes: "HUGE forward-facing eyes, flat facial disc, can rotate head 270°, silent flight feathers, ear tufts vary by species",
    prohibitedFeatures: "4 legs, small eyes, side-facing eyes, teeth",
    realWorldRef: "great horned owl, snowy owl, barn owl"
  },
  "Raven": {
    category: "bird",
    limbCount: 2,
    hasWings: true,
    hasTail: true,
    bodyType: "biped-winged",
    babyFeatures: "fluffy black chick, large beak, curious intelligent eyes, downy feathers",
    adultFeatures: "glossy black feathers with iridescent sheen, large curved beak, intelligent eyes, shaggy throat feathers",
    anatomyNotes: "Larger than crow, wedge-shaped tail in flight, intelligent eyes, iridescent black plumage, thick beak",
    prohibitedFeatures: "4 legs, colorful feathers, small beak, teeth",
    realWorldRef: "common raven"
  },
  "Parrot": {
    category: "bird",
    limbCount: 2,
    hasWings: true,
    hasTail: true,
    bodyType: "biped-winged",
    babyFeatures: "fluffy colorful chick, oversized curved beak, pin feathers emerging",
    adultFeatures: "vibrant colorful plumage, large curved beak, zygodactyl feet (2 toes forward, 2 back), intelligent eyes",
    anatomyNotes: "CURVED beak for cracking seeds, zygodactyl feet for climbing, vibrant colors, can mimic sounds",
    prohibitedFeatures: "4 legs, straight beak, dull colors, teeth",
    realWorldRef: "macaw, African grey parrot"
  },
  "Hummingbird": {
    category: "bird",
    limbCount: 2,
    hasWings: true,
    hasTail: true,
    bodyType: "biped-winged-tiny",
    babyFeatures: "absolutely TINY fluffy chick, long thin beak already visible, iridescent hints",
    adultFeatures: "TINY body, extremely fast-beating wings (blur when flying), long thin beak, iridescent gorget",
    anatomyNotes: "SMALLEST bird, wings move in figure-8 (can hover), long needle-like beak for nectar, iridescent throat",
    prohibitedFeatures: "large size, 4 legs, short beak, slow wings",
    realWorldRef: "ruby-throated hummingbird"
  },
  "Penguin": {
    category: "bird",
    limbCount: 2,
    hasWings: true,
    hasTail: true,
    bodyType: "biped-flightless",
    babyFeatures: "fluffy grey/brown chick, oversized head, stubby flipper wings, waddling stance",
    adultFeatures: "tuxedo black and white coloring, flipper wings (cannot fly), upright waddling stance, waterproof feathers",
    anatomyNotes: "CANNOT FLY - wings are flippers for swimming, upright stance, black back white front, webbed feet",
    prohibitedFeatures: "flight capability, 4 legs, colorful plumage (except emperor penguin chicks), fur",
    realWorldRef: "emperor penguin, king penguin"
  },
  
  // === MYTHICAL BIRDS ===
  "Phoenix": {
    category: "mythical-bird",
    limbCount: 2,
    hasWings: true,
    hasTail: true,
    bodyType: "biped-winged",
    babyFeatures: "tiny bird made of gentle flames, ember eyes, small wing nubs, warm glow",
    adultFeatures: "majestic fire bird, flaming plumage in reds/oranges/golds, long elegant tail feathers, radiant glow",
    anatomyNotes: "Bird of fire and rebirth, flames instead of or merged with feathers, golden/red coloring, long tail plumes",
    prohibitedFeatures: "4 legs, ice/cold colors, no flames, dark coloring",
    realWorldRef: "mythological phoenix, firebird"
  },
  "Thunderbird": {
    category: "mythical-bird",
    limbCount: 2,
    hasWings: true,
    hasTail: true,
    bodyType: "biped-winged-giant",
    babyFeatures: "storm-colored fluffy chick, crackling feathers, bright electric eyes",
    adultFeatures: "MASSIVE eagle-like bird, storm clouds in wings, lightning crackling, thunder with wingbeats",
    anatomyNotes: "Native American myth - enormous eagle that controls storms, lightning in feathers, storm clouds follow",
    prohibitedFeatures: "4 legs, small size, no storm/lightning elements, fire element",
    realWorldRef: "Native American thunderbird"
  },
  
  // === EQUINES ===
  "Horse (Stallion)": {
    category: "equine",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped",
    babyFeatures: "long-legged wobbly foal, oversized head, fuzzy coat, curious eyes, tiny mane",
    adultFeatures: "powerful muscular build, flowing mane and tail, elegant long legs, noble expression",
    anatomyNotes: "Single-toed hooves, flowing mane down neck, long tail from dock, muscular neck, expressive eyes",
    prohibitedFeatures: "wings, horn, split hooves, claws",
    realWorldRef: "Arabian horse, thoroughbred"
  },
  "Unicorn": {
    category: "mythical-equine",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped",
    babyFeatures: "adorable foal with tiny horn nub on forehead, flowing mane, pure white/pastel coat, innocent eyes",
    adultFeatures: "elegant horse with SINGLE SPIRAL HORN on forehead, flowing ethereal mane, cloven hooves possible, pure coat",
    anatomyNotes: "SINGLE spiral horn center of forehead, often white/silver, flowing magical mane/tail, can have cloven hooves",
    prohibitedFeatures: "wings (that's a pegasus/alicorn), multiple horns, no horn, dark evil appearance",
    realWorldRef: "mythological unicorn"
  },
  "Pegasus": {
    category: "mythical-equine",
    limbCount: 4,
    hasWings: true,
    hasTail: true,
    bodyType: "quadruped-winged",
    babyFeatures: "adorable foal with small fluffy wing nubs, soft coat, oversized hooves, curious expression",
    adultFeatures: "majestic horse with LARGE FEATHERED WINGS, powerful build, flowing mane/tail, often white",
    anatomyNotes: "Horse with FEATHERED BIRD WINGS (4 legs + 2 wings = 6 limbs), typically white, graceful flyer",
    prohibitedFeatures: "horn (that's an alicorn), bat wings, no wings, dragon features",
    realWorldRef: "Greek mythological Pegasus"
  },
  
  // === AQUATIC ===
  "Dolphin": {
    category: "aquatic-mammal",
    limbCount: 0,
    hasWings: false,
    hasTail: true,
    bodyType: "aquatic-streamlined",
    babyFeatures: "small sleek calf, oversized head, playful expression, lighter coloring",
    adultFeatures: "streamlined body, dorsal fin, tail flukes (horizontal), curved beak-like snout, intelligent eyes",
    anatomyNotes: "NO LEGS - only fins, horizontal tail flukes (mammal), dorsal fin, blowhole on top, curved snout",
    prohibitedFeatures: "legs, vertical tail (fish), gills, fur",
    realWorldRef: "bottlenose dolphin"
  },
  "Shark": {
    category: "aquatic-fish",
    limbCount: 0,
    hasWings: false,
    hasTail: true,
    bodyType: "aquatic-streamlined",
    babyFeatures: "small shark pup, all fins present, large dark eyes, tiny teeth visible",
    adultFeatures: "powerful streamlined body, multiple fins, VERTICAL tail (fish), multiple rows of teeth, gill slits",
    anatomyNotes: "NO LEGS - only fins, VERTICAL tail fin (fish), gill slits on sides, multiple tooth rows, cartilage skeleton",
    prohibitedFeatures: "legs, horizontal tail, lungs/blowhole, fur, bones",
    realWorldRef: "great white shark"
  },
  "Orca": {
    category: "aquatic-mammal",
    limbCount: 0,
    hasWings: false,
    hasTail: true,
    bodyType: "aquatic-streamlined",
    babyFeatures: "small calf with black and white pattern, orange tint to white patches (newborn), oversized head",
    adultFeatures: "black and white pattern, tall dorsal fin, horizontal tail flukes, white eye patch, powerful build",
    anatomyNotes: "NO LEGS - flippers only, distinctive black/white pattern, TALL dorsal fin (especially males), horizontal flukes",
    prohibitedFeatures: "legs, vertical tail, gills, all-black coloring, fur",
    realWorldRef: "killer whale, orca"
  },
  "Blue Whale": {
    category: "aquatic-mammal",
    limbCount: 0,
    hasWings: false,
    hasTail: true,
    bodyType: "aquatic-streamlined",
    babyFeatures: "relatively small calf (still huge), mottled blue-grey, horizontal flukes, small flippers",
    adultFeatures: "ENORMOUS blue-grey body, mottled pattern, tiny dorsal fin, horizontal flukes, throat grooves",
    anatomyNotes: "LARGEST ANIMAL EVER, NO LEGS, blue-grey mottled, very small dorsal fin far back, baleen plates not teeth",
    prohibitedFeatures: "legs, teeth (has baleen), large dorsal fin, gills, fur",
    realWorldRef: "blue whale"
  },
  "Jellyfish": {
    category: "aquatic-invertebrate",
    limbCount: 0,
    hasWings: false,
    hasTail: false,
    bodyType: "aquatic-bell",
    babyFeatures: "tiny translucent bell, developing tentacles, gentle pulsing",
    adultFeatures: "translucent bell-shaped body, flowing tentacles beneath, bioluminescent glow possible, ethereal",
    anatomyNotes: "NO skeleton, translucent bell body, trailing tentacles, no brain, pulses to move, often bioluminescent",
    prohibitedFeatures: "legs, skeleton, eyes, solid body, fur",
    realWorldRef: "moon jellyfish, lion's mane jellyfish"
  },
  "Octopus": {
    category: "aquatic-invertebrate",
    limbCount: 8,
    hasWings: false,
    hasTail: false,
    bodyType: "aquatic-tentacle",
    babyFeatures: "tiny translucent octopus, oversized head, 8 tiny tentacles, curious eyes",
    adultFeatures: "bulbous head, 8 suckered tentacles, color-changing skin, highly intelligent eyes, no skeleton",
    anatomyNotes: "EXACTLY 8 tentacles with suckers, bulbous head/mantle, beak in center, can change color/texture, very intelligent",
    prohibitedFeatures: "legs, more or fewer than 8 tentacles, skeleton, fur, 10 limbs (that's squid)",
    realWorldRef: "common octopus, giant Pacific octopus"
  },
  "Manta Ray": {
    category: "aquatic-fish",
    limbCount: 0,
    hasWings: false,
    hasTail: true,
    bodyType: "aquatic-flat",
    babyFeatures: "small ray with developing wing-like fins, long thin tail, curious expression",
    adultFeatures: "MASSIVE flat diamond body, wing-like pectoral fins, cephalic fins (horns) near mouth, gentle giant",
    anatomyNotes: "Flat diamond shape, NO LEGS, wing-like fins for swimming, horn-like cephalic fins, very long thin tail, filter feeder",
    prohibitedFeatures: "legs, thick body, stinger (mantas don't sting), fur",
    realWorldRef: "giant oceanic manta ray"
  },
  
  // === MYTHICAL AQUATIC ===
  "Kraken": {
    category: "mythical-aquatic",
    limbCount: 8,
    hasWings: false,
    hasTail: false,
    bodyType: "aquatic-tentacle-giant",
    babyFeatures: "small but fierce cephalopod, 8 tentacles, glowing eyes, dark coloring",
    adultFeatures: "MASSIVE octopus/squid hybrid, 8-10 enormous tentacles, glowing eyes, ship-destroying size, deep sea horror",
    anatomyNotes: "Giant cephalopod of myth, 8-10 massive tentacles, enormous eyes, can grab ships, deep sea monster",
    prohibitedFeatures: "legs, fur, small size, friendly appearance",
    realWorldRef: "mythological kraken, giant squid"
  },
  "Leviathan": {
    category: "mythical-aquatic",
    limbCount: 0,
    hasWings: false,
    hasTail: true,
    bodyType: "aquatic-serpent-giant",
    babyFeatures: "small sea serpent, scales, glowing eyes, serpentine body",
    adultFeatures: "COLOSSAL sea serpent/dragon, massive scales, world-ending size, primordial ocean god",
    anatomyNotes: "Biblical sea monster, serpentine body, may have fins, enormous beyond comprehension, ancient and powerful",
    prohibitedFeatures: "legs, small size, cute appearance, fur",
    realWorldRef: "Biblical Leviathan, sea serpent"
  },
  
  // === OTHER MAMMALS ===
  "Bear": {
    category: "mammal",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped-heavy",
    babyFeatures: "tiny fluffy cub, oversized paws, round face, curious eyes, playful",
    adultFeatures: "massive heavy build, thick fur, powerful paws with claws, small rounded ears, short tail",
    anatomyNotes: "Plantigrade feet (walks on whole foot like humans), powerful shoulders, small ears, very short tail, thick fur",
    prohibitedFeatures: "wings, long tail, digitigrade legs, thin build",
    realWorldRef: "grizzly bear, polar bear"
  },
  "Elephant": {
    category: "mammal",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped-heavy",
    babyFeatures: "adorable baby elephant, oversized ears, tiny trunk, fuzzy sparse hair, playful",
    adultFeatures: "MASSIVE body, long prehensile trunk, large fan-like ears, tusks (ivory), thick legs, wise eyes",
    anatomyNotes: "Trunk is extended nose/lip, large ears for cooling, column-like legs, tusks are elongated teeth, tiny tail with tuft",
    prohibitedFeatures: "wings, no trunk, no ears, thin legs, fur coat",
    realWorldRef: "African elephant"
  },
  "Gorilla": {
    category: "mammal-primate",
    limbCount: 4,
    hasWings: false,
    hasTail: false,
    bodyType: "quadruped-knuckle",
    babyFeatures: "small infant gorilla, expressive face, clinging to imaginary parent, large eyes",
    adultFeatures: "powerful muscular build, silver back (males), knuckle-walking posture, intelligent expressive face, NO TAIL",
    anatomyNotes: "NO TAIL (great apes lack tails), knuckle-walking, silver back on males, intelligent human-like eyes, powerful arms",
    prohibitedFeatures: "wings, tail, fur-covered face, non-primate features",
    realWorldRef: "mountain gorilla, silverback"
  },
  "Rhino": {
    category: "mammal",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped-heavy",
    babyFeatures: "small rhino calf, tiny horn nub, thick skin, oversized head, playful",
    adultFeatures: "massive armored-looking body, 1-2 HORNS on snout, thick grey skin, small ears, tiny eyes",
    anatomyNotes: "Horn made of keratin (hair protein), thick folded skin, 3 toes per foot, poor eyesight but good hearing",
    prohibitedFeatures: "wings, smooth skin, no horn, large eyes, fur",
    realWorldRef: "white rhino, black rhino"
  },
  "Hippo": {
    category: "mammal-semiaquatic",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped-heavy",
    babyFeatures: "small pink/grey calf, oversized head, stubby legs, in water with eyes/ears above surface",
    adultFeatures: "MASSIVE barrel body, huge mouth with tusks, eyes/ears on top of head, short legs, semi-aquatic",
    anatomyNotes: "Eyes/ears/nostrils on TOP of head (for water surface), ENORMOUS mouth opening 180°, short stubby legs, pink secretion",
    prohibitedFeatures: "wings, long legs, small mouth, fully aquatic (needs to surface)",
    realWorldRef: "hippopotamus"
  },
  "Mammoth": {
    category: "mammal-extinct",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped-heavy",
    babyFeatures: "fluffy baby mammoth, long shaggy fur, tiny curved tusks beginning, cute trunk",
    adultFeatures: "massive elephant-like body, LONG SHAGGY FUR, huge curved tusks, trunk, small ears (for cold)",
    anatomyNotes: "Like elephant but with LONG WOOLLY FUR, tusks curve MORE than elephant, SMALLER ears (heat retention), cold-adapted",
    prohibitedFeatures: "wings, no fur (must be woolly), straight tusks, large ears",
    realWorldRef: "woolly mammoth"
  },
  "Kangaroo": {
    category: "mammal-marsupial",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "biped-hopping",
    babyFeatures: "tiny joey, oversized back legs developing, may peek from pouch, large ears",
    adultFeatures: "powerful back legs for hopping, small arms, large ears, thick balancing tail, pouch (females)",
    anatomyNotes: "HOPS on powerful back legs, small front arms with hands, THICK muscular tail for balance, large upright ears",
    prohibitedFeatures: "wings, walking on all fours, small tail, no pouch on females",
    realWorldRef: "red kangaroo"
  },
  "Sloth": {
    category: "mammal",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "arboreal",
    babyFeatures: "tiny baby sloth clinging to branch or parent, long curved claws, sleepy expression, fuzzy",
    adultFeatures: "long limbs with LONG CURVED CLAWS for hanging, slow-moving, algae-tinged fur, peaceful sleepy face",
    anatomyNotes: "LONG CURVED CLAWS for branch-hanging, extremely slow, spends life upside-down, algae grows in fur (greenish tint)",
    prohibitedFeatures: "wings, fast movement, short claws, energetic expression",
    realWorldRef: "three-toed sloth"
  },
  "Reindeer": {
    category: "mammal-cervid",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped",
    babyFeatures: "spotted fawn, developing antler bumps, long legs, white spots on brown coat",
    adultFeatures: "thick winter coat, BOTH males and females have antlers, wide hooves for snow, white neck ruff",
    anatomyNotes: "ONLY deer where females ALSO have antlers, wide flat hooves for snow, thick double coat, white rump",
    prohibitedFeatures: "wings, no antlers on adults, thin coat, narrow hooves",
    realWorldRef: "reindeer, caribou"
  },
  "Wolverine": {
    category: "mammal-mustelid",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped",
    babyFeatures: "small fierce kit, dark fur, stocky build even young, determined expression",
    adultFeatures: "stocky powerful build, dark brown fur with lighter stripes, bear-like face, incredibly fierce, short legs",
    anatomyNotes: "Largest land mustelid, EXTREMELY powerful for size, dark fur with tan/blonde side stripes, fierce temper, thick fur",
    prohibitedFeatures: "wings, slender build, wolf-like appearance (not a wolf), long legs",
    realWorldRef: "wolverine (gulo gulo)"
  },
  
  // === MYTHICAL HYBRIDS ===
  "Gryphon": {
    category: "mythical-hybrid",
    limbCount: 4,
    hasWings: true,
    hasTail: true,
    bodyType: "quadruped-winged",
    babyFeatures: "adorable cub/chick hybrid, lion body with eagle head developing, small wing nubs, mixed fur and down",
    adultFeatures: "EAGLE head + front talons + wings on LION body + back legs + tail, majestic hybrid, noble bearing",
    anatomyNotes: "Eagle head with beak, eagle wings, eagle FRONT TALONS, lion BACK LEGS/BODY/TAIL, 6 limbs total",
    prohibitedFeatures: "all-eagle, all-lion, other animal parts, no beak, no wings",
    realWorldRef: "mythological gryphon/griffin"
  },
  "Hippogriff": {
    category: "mythical-hybrid",
    limbCount: 4,
    hasWings: true,
    hasTail: true,
    bodyType: "quadruped-winged",
    babyFeatures: "adorable foal/chick hybrid, horse body with eagle head developing, small wing nubs, mixed fur and down",
    adultFeatures: "EAGLE head + wings + front talons on HORSE body + back hooves + tail, noble bearing, faster than gryphon",
    anatomyNotes: "Eagle head with beak, eagle wings, eagle FRONT TALONS, horse BACK LEGS/BODY/TAIL with hooves, 6 limbs total",
    prohibitedFeatures: "lion parts (that's gryphon), all-eagle, all-horse, no beak, no wings",
    realWorldRef: "mythological hippogriff"
  },
  "Chimera": {
    category: "mythical-hybrid",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped-multihead",
    babyFeatures: "strange hybrid baby with lion features, small goat head emerging from back, serpent tail developing",
    adultFeatures: "LION primary body/head, GOAT head rising from back/spine, SERPENT for tail, fire-breathing, monstrous",
    anatomyNotes: "Greek monster: lion body + lion head + goat head on back + serpent tail head, fire-breathing, terrifying",
    prohibitedFeatures: "wings, eagle parts, single head, friendly appearance",
    realWorldRef: "Greek mythological Chimera"
  },
  
  // === INVERTEBRATES ===
  "Butterfly": {
    category: "insect",
    limbCount: 6,
    hasWings: true,
    hasTail: false,
    bodyType: "insect",
    babyFeatures: "caterpillar form with many segments, tiny legs, cute face, fuzzy body, or chrysalis stage",
    adultFeatures: "delicate body, LARGE colorful wings with patterns, 6 thin legs, antennae, proboscis (tongue)",
    anatomyNotes: "6 legs, 4 wings (2 forewings, 2 hindwings), compound eyes, curled proboscis tongue, antennae with clubs",
    prohibitedFeatures: "2 legs, 2 wings, fur, vertebrate features, moth antennae (moths are feathery)",
    realWorldRef: "monarch butterfly, blue morpho"
  },
  
  // === MECHANICAL ===
  "Mechanical Dragon": {
    category: "construct",
    limbCount: 4,
    hasWings: true,
    hasTail: true,
    bodyType: "quadruped-winged-mechanical",
    babyFeatures: "small clockwork dragon, brass gears visible, steam wisps, glowing eyes, articulated joints",
    adultFeatures: "steampunk dragon of metal and gears, articulated plates, steam/energy breath, glowing core, mechanical wings",
    anatomyNotes: "Dragon anatomy but MECHANICAL: gears, pistons, metal plates, rivets, steam vents, glowing power core, articulated joints",
    prohibitedFeatures: "organic scales, flesh, bones, fur, non-mechanical elements",
    realWorldRef: "steampunk mechanical dragon"
  }
};

// ============================================================================
// STORY TONE VISUAL MODIFIERS
// ============================================================================

const STORY_TONE_MODIFIERS = {
  soft_gentle: {
    lighting: "soft golden hour lighting, warm glow, gentle shadows, diffused light",
    atmosphere: "peaceful meadow feeling, soft clouds, gentle magical sparkles",
    expression: "gentle, kind, nurturing expression, soft eyes",
    colors: "pastel enhancement, soft gradients, warm undertones"
  },
  epic_adventure: {
    lighting: "dramatic heroic lighting, bold shadows, strong rim lighting",
    atmosphere: "dynamic energy, wind effects, action-ready environment",
    expression: "determined, brave, confident expression, alert posture",
    colors: "bold saturated colors, high contrast, vibrant"
  },
  emotional_heartfelt: {
    lighting: "warm intimate lighting, soft focus edges, golden tones",
    atmosphere: "cozy atmosphere, gentle particles, feeling of safety and love",
    expression: "loving, emotional, deep connection in eyes",
    colors: "warm color temperature, golden tones, soft saturation"
  },
  dark_intense: {
    lighting: "moody dramatic lighting, deep shadows, mysterious",
    atmosphere: "mysterious environment, fog, dramatic intensity",
    expression: "fierce, determined, powerful, intense gaze",
    colors: "deep rich colors, high contrast shadows, dramatic"
  },
  whimsical_playful: {
    lighting: "bright cheerful lighting, sparkles everywhere, magical",
    atmosphere: "magical bubbles, floating elements, pure joy",
    expression: "playful, joyful, mischievous, fun",
    colors: "vibrant candy colors, iridescent highlights, rainbow hints"
  }
};

// ============================================================================
// ELEMENT EFFECTS AS PURE OVERLAY (does NOT change body color)
// ============================================================================

const ELEMENT_AS_OVERLAY: Record<string, string> = {
  fire: "glowing ember PARTICLES floating around creature (NOT changing body color), heat shimmer aura, flame wisps nearby, warm orange glow AROUND not ON creature",
  water: "floating water DROPLETS around creature (NOT changing body color), ripple aura effects, bioluminescent sparkles in air, cool blue glow AROUND not ON creature",
  earth: "floating dust PARTICLES and small stones orbiting creature (NOT changing body color), crystal formations nearby, nature energy, earthen glow AROUND not ON creature",
  air: "swirling wind CURRENTS visible around creature (NOT changing body color), cloud wisps, feather particles floating, silvery glow AROUND not ON creature",
  lightning: "electric ARCS crackling around creature (NOT changing body color), plasma glow effects, energy field, purple-blue electricity AROUND not ON creature",
  ice: "frost PARTICLES and snowflakes around creature (NOT changing body color), cold vapor, ice crystal formations, cyan glow AROUND not ON creature",
  light: "divine RAYS and sparkles around creature (NOT changing body color), holy glow, lens flares, golden radiance AROUND not ON creature",
  shadow: "dark TENDRILS and wisps around creature (NOT changing body color), mysterious smoke, void particles, purple-black energy AROUND not ON creature"
};

// ============================================================================
// AGING PARAMETERS SYSTEM - Quantified changes for each stage
// ============================================================================

interface AgingParams {
  eyeOpenness: string;
  bodyRoundness: string;
  furState: string;
  limbDevelopment: string;
  mobilityLevel: string;
  sizePercent: string;
  muscleDefinition: string;
  wingDevelopment: string;
  elementalManifest: string;
  cosmicPower: string;
}

const AGING_PARAMETERS: Record<number, AgingParams> = {
  // Egg stages (0-1) don't have aging params
  2: {
    eyeOpenness: "5% - barely cracking open, squinting at first light",
    bodyRoundness: "95% - nearly perfect sphere of baby fat",
    furState: "20% dry - still damp/glistening from egg",
    limbDevelopment: "10% - tiny nubs pressed flat against body",
    mobilityLevel: "0% - lying curled in egg position, cannot move",
    sizePercent: "8% of adult",
    muscleDefinition: "0% - pure soft baby fat",
    wingDevelopment: "0% - invisible wet nubs if species has wings",
    elementalManifest: "0% - no elemental effects visible",
    cosmicPower: "0%"
  },
  3: {
    eyeOpenness: "100% - eyes now fully open, huge and curious",
    bodyRoundness: "92% - still extremely round blob",
    furState: "70% dry - now fluffy instead of wet",
    limbDevelopment: "15% - slightly more visible but still pressed to body",
    mobilityLevel: "5% - can lift head slightly, look around",
    sizePercent: "10% of adult",
    muscleDefinition: "0% - still pure baby fat",
    wingDevelopment: "5% - tiny dry nubs barely visible",
    elementalManifest: "0% - no elemental effects",
    cosmicPower: "0%"
  },
  4: {
    eyeOpenness: "100% - fully open, expressive",
    bodyRoundness: "88% - very round but slightly less spherical",
    furState: "90% dry - fully fluffy and soft",
    limbDevelopment: "20% - short stubby limbs, can support sitting",
    mobilityLevel: "15% - can sit upright steadily",
    sizePercent: "12% of adult",
    muscleDefinition: "0% - no muscle, all fluff",
    wingDevelopment: "10% - small visible nubs",
    elementalManifest: "0% - no effects",
    cosmicPower: "0%"
  },
  5: {
    eyeOpenness: "100%",
    bodyRoundness: "82% - still round but body elongating slightly",
    furState: "100% - fully developed baby fluff",
    limbDevelopment: "30% - can support wobbly walking",
    mobilityLevel: "30% - wobbly toddle, unstable but mobile",
    sizePercent: "18% of adult",
    muscleDefinition: "5% - hint of future strength",
    wingDevelopment: "20% - small buds visible, cannot use",
    elementalManifest: "5% - faintest hints of element color in eyes",
    cosmicPower: "0%"
  },
  6: {
    eyeOpenness: "100%",
    bodyRoundness: "75% - rounder than adult but less baby-blob",
    furState: "100%",
    limbDevelopment: "40% - proportionally longer, more coordinated",
    mobilityLevel: "50% - steady walking, some playful running",
    sizePercent: "22% of adult",
    muscleDefinition: "8% - slight definition under fluff",
    wingDevelopment: "30% - can flutter slightly",
    elementalManifest: "8% - very subtle glow possible",
    cosmicPower: "0%"
  },
  7: {
    eyeOpenness: "100%",
    bodyRoundness: "68% - transitioning toward juvenile proportions",
    furState: "100%",
    limbDevelopment: "50% - noticeably longer, more capable",
    mobilityLevel: "65% - running, climbing, exploring",
    sizePercent: "28% of adult",
    muscleDefinition: "12% - baby fat reducing, shape emerging",
    wingDevelopment: "40% - small wings, can glide briefly",
    elementalManifest: "12% - subtle elemental hints around creature",
    cosmicPower: "0%"
  },
  8: {
    eyeOpenness: "100%",
    bodyRoundness: "55% - gangly adolescent proportions",
    furState: "100%",
    limbDevelopment: "65% - long and somewhat awkward",
    mobilityLevel: "80% - agile and energetic",
    sizePercent: "38% of adult",
    muscleDefinition: "25% - athletic build emerging",
    wingDevelopment: "50% - can glide medium distances",
    elementalManifest: "20% - noticeable elemental aura",
    cosmicPower: "0%"
  },
  9: {
    eyeOpenness: "100%",
    bodyRoundness: "45% - approaching adult proportions",
    furState: "100%",
    limbDevelopment: "75% - near adult proportions",
    mobilityLevel: "90% - full mobility",
    sizePercent: "48% of adult",
    muscleDefinition: "40% - clearly athletic",
    wingDevelopment: "60% - capable short flight",
    elementalManifest: "30% - clear elemental effects",
    cosmicPower: "0%"
  },
  10: {
    eyeOpenness: "100%",
    bodyRoundness: "35% - near adult proportions",
    furState: "100%",
    limbDevelopment: "85% - almost adult length",
    mobilityLevel: "100% - full adult mobility",
    sizePercent: "60% of adult",
    muscleDefinition: "55% - well-defined athlete",
    wingDevelopment: "75% - proficient flyer",
    elementalManifest: "45% - strong elemental presence",
    cosmicPower: "0%"
  },
  11: {
    eyeOpenness: "100%",
    bodyRoundness: "25% - prime adult proportions",
    furState: "100%",
    limbDevelopment: "95% - peak proportions",
    mobilityLevel: "100%",
    sizePercent: "80% of adult",
    muscleDefinition: "70% - peak physical condition",
    wingDevelopment: "90% - powerful flight",
    elementalManifest: "60% - element part of being",
    cosmicPower: "5% - first hints of mythic power"
  },
  12: {
    eyeOpenness: "100%",
    bodyRoundness: "20% - perfect adult form",
    furState: "100%",
    limbDevelopment: "100% - full adult development",
    mobilityLevel: "100%",
    sizePercent: "100% of adult",
    muscleDefinition: "80% - magnificent specimen",
    wingDevelopment: "100% - full wingspan",
    elementalManifest: "75% - commanding elemental power",
    cosmicPower: "10% - mythic potential visible"
  },
  13: {
    eyeOpenness: "100%",
    bodyRoundness: "18%",
    furState: "100% - with subtle magical shimmer",
    limbDevelopment: "100%",
    mobilityLevel: "100%",
    sizePercent: "115% of normal adult",
    muscleDefinition: "85%",
    wingDevelopment: "110% - enhanced mythic wings",
    elementalManifest: "85% - element integral to being",
    cosmicPower: "25% - reality subtly bends"
  },
  14: {
    eyeOpenness: "100%",
    bodyRoundness: "15%",
    furState: "100% - magical luminescence in coat",
    limbDevelopment: "100%",
    mobilityLevel: "100%",
    sizePercent: "140% of normal adult",
    muscleDefinition: "90%",
    wingDevelopment: "125% - legendary wings",
    elementalManifest: "95% - environment responds to presence",
    cosmicPower: "40% - heroic mythic power"
  },
  15: {
    eyeOpenness: "100%",
    bodyRoundness: "12%",
    furState: "100% - divine light woven in",
    limbDevelopment: "100%",
    mobilityLevel: "100%",
    sizePercent: "TITAN - building-sized",
    muscleDefinition: "95%",
    wingDevelopment: "150% - colossal divine wings",
    elementalManifest: "100% - IS the element",
    cosmicPower: "55% - earth-shaking power"
  },
  16: {
    eyeOpenness: "100%",
    bodyRoundness: "10%",
    furState: "100% - stars visible within coat",
    limbDevelopment: "100%",
    mobilityLevel: "100%",
    sizePercent: "CELESTIAL - mountain-sized",
    muscleDefinition: "98%",
    wingDevelopment: "175% - cosmic wings",
    elementalManifest: "100%",
    cosmicPower: "70% - celestial being"
  },
  17: {
    eyeOpenness: "100%",
    bodyRoundness: "8%",
    furState: "100% - nebulae and galaxies visible",
    limbDevelopment: "100%",
    mobilityLevel: "100%",
    sizePercent: "DIVINE - planetary scale",
    muscleDefinition: "100%",
    wingDevelopment: "200% - divine wings",
    elementalManifest: "100%",
    cosmicPower: "85% - approaching godhood"
  },
  18: {
    eyeOpenness: "100%",
    bodyRoundness: "5%",
    furState: "100% - made of starlight",
    limbDevelopment: "100%",
    mobilityLevel: "100%",
    sizePercent: "UNIVERSAL - stellar scale",
    muscleDefinition: "100%",
    wingDevelopment: "INFINITE",
    elementalManifest: "100%",
    cosmicPower: "92% - shapes reality"
  },
  19: {
    eyeOpenness: "100%",
    bodyRoundness: "2%",
    furState: "100% - primordial energy",
    limbDevelopment: "100%",
    mobilityLevel: "100%",
    sizePercent: "PRIMORDIAL - galactic scale",
    muscleDefinition: "100%",
    wingDevelopment: "INFINITE",
    elementalManifest: "100%",
    cosmicPower: "98% - creation power"
  },
  20: {
    eyeOpenness: "100%",
    bodyRoundness: "0% - perfect divine form",
    furState: "100% - IS creation itself",
    limbDevelopment: "100%",
    mobilityLevel: "100%",
    sizePercent: "ORIGIN - universal scale",
    muscleDefinition: "100%",
    wingDevelopment: "INFINITE",
    elementalManifest: "100%",
    cosmicPower: "100% - THE ORIGIN"
  }
};

// ============================================================================
// COMPLETE 21 EVOLUTION STAGES - Ultra-detailed prompts
// ============================================================================

const EVOLUTION_STAGES: Record<number, { name: string; prompt: string; useFutureSilhouette?: boolean; futureStage?: number }> = {
  // === EGG STAGES ===
  0: {
    name: "Dormant Egg",
    prompt: `A mystical egg floating in gentle elemental energy.

EGG APPEARANCE:
- Smooth opalescent surface with subtle iridescent shimmer
- {color} undertones glowing softly throughout shell
- Semi-translucent crystalline quality
- Size of a large ostrich egg

SILHOUETTE WITHIN:
- Deep inside the translucent shell, a DARK SHADOWY SILHOUETTE is barely visible
- The silhouette shows the basic shape of a powerful, mature {spirit} curled in sleep
- Just a dark featureless shadow - mysterious and intriguing
- Hints at the magnificent creature that will emerge

ENVIRONMENT:
- Floating in soft {element} energy particles
- Gentle magical glow surrounding the egg
- Peaceful, anticipatory atmosphere`,
    useFutureSilhouette: true,
    futureStage: 15
  },
  1: {
    name: "Cracking Awakening",
    prompt: `The same mystical egg now with luminous cracks spreading across its surface.

CRACKING EGG:
- Same egg from Stage 0, but now with glowing cracks spreading
- {color} light emanating from fractures
- {element} energy leaking through the cracks
- Shell beginning to fragment but not yet broken

SILHOUETTE WITHIN:
- Through the cracks, the shadowy silhouette is MORE visible now
- Shows the outline of the ULTIMATE form (stage 20) of a {spirit}
- Still a dark, featureless shadow but now stirring slightly
- Beginning to move, about to awaken

ENVIRONMENT:
- More intense {element} particles swirling around
- Building anticipation and energy
- The moment just before emergence`,
    useFutureSilhouette: true,
    futureStage: 20
  },

  // === BABY STAGES 2-7 (Ultra-specific, minimal changes between each) ===
  2: {
    name: "Hatchling",
    prompt: `A TINY {spirit} that JUST emerged from its egg SECONDS ago.

━━━ SIZE (CRITICAL) ━━━
- PALM-SIZED: Fits easily in a cupped human hand
- Only 8-10% of adult size
- Think: newborn hamster or just-hatched chick

━━━ JUST-HATCHED APPEARANCE ━━━
- WET/DAMP looking, still glistening from egg
- Eyes barely opening, squinting at first light
- Body extremely ROUND and SQUISHY
- Zero muscle definition - pure soft baby fat
- Oversized head (60% of total body mass)
- Tiny stubby limbs pressed close to body
- If species has wings: just tiny wet nubs, flat against body, invisible

━━━ POSTURE ━━━
- Still in same curled position as in the egg
- Barely moved since hatching
- Lying/resting, cannot stand yet

━━━ COLORS ━━━
- {color} in soft, muted, newborn tones
- Baby coloring - less vibrant than adult will be

━━━ EXPRESSION ━━━
- Eyes: barely open slits, squinting
- Completely helpless, vulnerable, precious
- Pure innocence

REAL-WORLD COMPARISON: A bird that hatched 30 seconds ago, or a newborn puppy with eyes still sealed.`
  },
  3: {
    name: "Nestling",
    prompt: `A TINY {spirit} baby, NEARLY IDENTICAL to Stage 2 but eyes now open.

━━━ SIZE (UNCHANGED) ━━━
- Still palm-sized: 10-12% of adult size
- Still EXTREMELY small

━━━ CHANGES FROM STAGE 2 (ONLY THESE 2 CHANGES) ━━━
1. Eyes now FULLY OPEN (big, curious, innocent, taking up most of face)
2. Slightly drier/fluffier than wet hatchling look

━━━ EVERYTHING ELSE IDENTICAL TO STAGE 2 ━━━
- Same tiny round body shape
- Same soft squishy proportions
- Same stubby limbs pressed to body
- Same oversized head
- Same helpless baby appearance
- Same curled posture (maybe head lifted slightly to look around)
- If wings: still tiny nubs, flat, not visible

━━━ COLORS (MUST BE IDENTICAL) ━━━
- EXACT SAME {color} palette as Stage 2
- NO color shifting or changes whatsoever

━━━ EXPRESSION ━━━
- Eyes: now fully open, HUGE relative to face
- Curious, wondering, taking in the world
- Still completely helpless

REAL-WORLD COMPARISON: A 3-day-old puppy or kitten - eyes just opened, still wobbly and helpless.`
  },
  4: {
    name: "Fledgling",
    prompt: `A small {spirit} baby, NEARLY IDENTICAL to Stage 3 with slightly more coordination.

━━━ SIZE ━━━
- Still very small: 12-15% of adult size
- Fits in cupped hands

━━━ CHANGES FROM STAGE 3 (ONLY THESE 2-3 CHANGES) ━━━
1. Can now SIT UPRIGHT steadily (no longer just lying curled)
2. Limbs slightly more defined but still short and stubby
3. Beginning to show playful curiosity in expression

━━━ EVERYTHING ELSE IDENTICAL TO PREVIOUS STAGES ━━━
- Same round baby proportions (big head, tiny body)
- Same fluffy/soft baby texture
- Same big innocent eyes from Stage 3
- Still clearly a helpless baby
- Cannot walk yet - just learned to sit
- If wings: still tiny nubs, maybe slightly more visible

━━━ COLORS (MUST BE IDENTICAL) ━━━
- EXACT SAME {color} palette as Stages 2-3
- NO color changes whatsoever

━━━ EXPRESSION ━━━
- Playful curiosity beginning to show
- Still innocent and baby-like
- Maybe tiny smile

REAL-WORLD COMPARISON: A 3-week-old puppy - can sit up, playful but still very much a baby.`
  },
  5: {
    name: "Cub",
    prompt: `A small {spirit} cub, NEARLY IDENTICAL to Stage 4 but now mobile.

━━━ SIZE ━━━
- Small: 18-20% of adult size
- Fits on a lap easily

━━━ CHANGES FROM STAGE 4 (ONLY THESE 2-3 CHANGES) ━━━
1. Can now WALK/TODDLE around (wobbly but mobile)
2. Body slightly less perfectly round (baby fat still very present)
3. If species has wings: now small visible BUDS instead of flat nubs

━━━ EVERYTHING ELSE IDENTICAL TO PREVIOUS STAGES ━━━
- Same adorable baby face with big eyes
- Same soft fluffy texture
- Same baby proportions overall
- Still clearly a young baby, NOT a juvenile
- Limbs still short and stubby

━━━ COLORS (MUST BE IDENTICAL) ━━━
- EXACT SAME {color} as Stages 2-4
- Completely unchanged color palette

━━━ EXPRESSION ━━━
- Curious and exploring
- Playful wobbliness
- Still innocent baby expression

REAL-WORLD COMPARISON: A 6-week-old puppy - playful, wobbly walking, but obviously still a baby.`
  },
  6: {
    name: "Pup",
    prompt: `A young {spirit} pup, NEARLY IDENTICAL to Stage 5 with minor growth.

━━━ SIZE ━━━
- 22-25% of adult size
- Small and young

━━━ CHANGES FROM STAGE 5 (ONLY THESE 2-3 CHANGES) ━━━
1. Limbs slightly longer (still short, still puppy proportions)
2. Face very slightly less perfectly round
3. More coordinated movement, less wobbly
4. If wings: small but now can flutter slightly

━━━ EVERYTHING ELSE IDENTICAL TO PREVIOUS STAGES ━━━
- Same soft baby texture
- Same playful innocent expression
- Same baby proportions overall (just slightly less extreme)
- Still clearly a baby/young creature

━━━ COLORS (MUST BE IDENTICAL) ━━━
- EXACT SAME {color} as Stages 2-5
- NO color shifting or changes

━━━ EXPRESSION ━━━
- Playful and happy
- Growing confidence
- Still innocent and young

REAL-WORLD COMPARISON: A 3-month-old puppy - growing but still very much a baby.`
  },
  7: {
    name: "Kit",
    prompt: `A young {spirit} kit, NEARLY IDENTICAL to Stage 6 with early growth signs.

━━━ SIZE ━━━
- 28-30% of adult size
- Still clearly young and small

━━━ CHANGES FROM STAGE 6 (ONLY THESE 2-3 CHANGES) ━━━
1. Limbs proportionally slightly longer
2. Species-specific features becoming slightly clearer
3. Slightly more athletic movement capability
4. If wings: now visible small wings, about 40% of adult wing size

━━━ EVERYTHING ELSE IDENTICAL TO PREVIOUS STAGES ━━━
- Same cute youthful face with expressive eyes
- Same soft texture (maybe slightly less fluffy)
- Same innocent expression
- Still clearly a young creature, NOT an adolescent or teen

━━━ COLORS (SAME, SLIGHTLY MORE VIBRANT) ━━━
- {color} - same base palette
- Perhaps VERY slightly more vibrant (5% more saturated)

━━━ EXPRESSION ━━━
- Growing curiosity and playfulness
- Still young and innocent
- Beginning to show personality

REAL-WORLD COMPARISON: A 5-month-old puppy - growing taller but still very puppy-like.`
  },

  // === ADOLESCENT/YOUNG ADULT STAGES 8-12 ===
  8: {
    name: "Juvenile",
    prompt: `An adolescent {spirit} showing first signs of approaching maturity.

━━━ SIZE ━━━
- 35-40% of adult size
- No longer a baby but not yet adult

━━━ TRANSITION FROM BABY TO ADOLESCENT ━━━
- Body proportions shifting toward adult (head less oversized)
- Limbs lengthening, more gangly "teenage" look
- Still soft but beginning to show future muscle definition
- If wings: 50% of adult size, can glide short distances
- Species-specific adult features beginning to emerge

━━━ APPEARANCE ━━━
- Cute but less baby-round
- Athletic potential visible
- Still some baby softness remaining
- Eyes still large but less dominating

━━━ COLORS ━━━
- {color} becoming more defined and vibrant
- Adult color patterns emerging

EXPRESSION: Curious, playful, eager, showing personality.`
  },
  9: {
    name: "Yearling",
    prompt: `A young adolescent {spirit} in the middle of growth.

━━━ SIZE ━━━
- 45-50% of adult size

━━━ ADOLESCENT FEATURES ━━━
- Gangly proportions typical of teenage growth
- Limbs long, body catching up
- Muscle definition beginning to show
- If wings: 60% of adult size, can fly short distances
- Adult features more visible but not fully developed

━━━ COLORS ━━━
- {color} fully vibrant now
- Adult color pattern established

EXPRESSION: Growing confidence, eager, adventurous.`
  },
  10: {
    name: "Young Adult",
    prompt: `A {spirit} on the cusp of full adulthood.

━━━ SIZE ━━━
- 55-65% of adult size

━━━ NEAR-ADULT FEATURES ━━━
- Proportions almost adult-like
- Athletic build developing
- Species features nearly complete
- If wings: 75% of adult size, proficient flyer
- Face maturing, less round

━━━ COLORS ━━━
- {color} at full adult vibrancy
- All markings and patterns complete

EXPRESSION: Confident, capable, on the verge of greatness.`
  },
  11: {
    name: "Prime Form",
    prompt: `A {spirit} reaching peak physical condition.

━━━ SIZE ━━━
- 75-85% of adult size

━━━ PRIME FEATURES ━━━
- Full adult proportions achieved
- Athletic, powerful build
- All species features fully developed
- If wings: 90% of adult size, strong flyer
- Peak physical beauty of species

━━━ ELEMENTAL MANIFESTATION ━━━
- {element} energy now visibly manifests around creature
- Element-specific effects becoming prominent

━━━ COLORS ━━━
- {color} rich and vibrant
- May show slight magical enhancement

EXPRESSION: Powerful, confident, majestic.`
  },
  12: {
    name: "Full Adult",
    prompt: `A fully mature {spirit} at complete adult development.

━━━ SIZE ━━━
- 100% adult size

━━━ FULL ADULT FEATURES ━━━
- Perfect species anatomy at full adult scale
- Peak muscle definition and power
- All features fully developed and refined
- If wings: full adult wingspan, powerful flight
- Magnificent specimen of species

━━━ ELEMENTAL POWER ━━━
- {element} energy clearly manifests
- Environmental effects visible

━━━ COLORS ━━━
- {color} at peak beauty
- Magical luminescence beginning

EXPRESSION: Wise, powerful, magnificent.`
  },

  // === MYTHIC STAGES 13-17 ===
  13: {
    name: "Enhanced Form",
    prompt: `A {spirit} beginning to transcend normal limits.

━━━ SIZE ━━━
- 110-120% of normal adult size

━━━ MYTHIC ENHANCEMENTS ━━━
- Core species anatomy preserved perfectly
- Size slightly enhanced beyond normal
- {element} energy now part of being
- Subtle glow emanating from creature
- May develop minor mythic additions (small horns, energy trails)

━━━ ELEMENTAL INTEGRATION ━━━
- {element} effects now integral part of appearance
- Environment responds to presence

━━━ COLORS ━━━
- {color} enhanced with magical luminescence
- Patterns may glow softly

EXPRESSION: Commanding, wise, otherworldly awareness.`
  },
  14: {
    name: "Mythic Form",
    prompt: `A {spirit} of legendary proportions and power.

━━━ SIZE ━━━
- 130-150% of normal adult size
- Imposing presence

━━━ LEGENDARY FEATURES ━━━
- Species anatomy maintained at mythic scale
- Heroic proportions and posture
- {element} effects creating environmental phenomena
- Possible additional mythic features (divine horns, energy wings on non-winged creatures)
- Ancient power radiating from form

━━━ COLORS ━━━
- {color} with divine luminescence
- Patterns pulse with power

EXPRESSION: Ancient wisdom, barely contained power.`
  },
  15: {
    name: "Titan Form",
    prompt: `A colossal {spirit} of earth-shaking presence.

━━━ SIZE ━━━
- MASSIVE - building-sized
- Titan scale

━━━ TITAN FEATURES ━━━
- Species identity clear even at colossal size
- Every anatomical detail visible at massive scale
- {element} manifesting as massive environmental effects
- Ground trembles, air crackles, water churns from presence
- Divine/mythic enhancements fully developed

━━━ ELEMENTAL POWER ━━━
- {element} creating major phenomena
- Reality bends slightly around creature

━━━ COLORS ━━━
- {color} blazing with power
- Entire form seems to glow

EXPRESSION: Ancient god-like power, terrifying majesty.`
  },
  16: {
    name: "Celestial Form",
    prompt: `A {spirit} merged with cosmic forces.

━━━ SIZE ━━━
- COLOSSAL - mountain-sized
- Celestial scale

━━━ CELESTIAL FEATURES ━━━
- Species anatomy visible through cosmic enhancement
- Stars and nebulae reflected in form
- {element} now cosmic-scale phenomenon
- Reality warping around presence
- Divine geometry patterns visible

━━━ COSMIC INTEGRATION ━━━
- Stars visible within body
- Cosmic energy flowing through form
- Celestial glow and presence

━━━ COLORS ━━━
- {color} mixed with starlight
- Nebula patterns in fur/scales/feathers

EXPRESSION: Beyond mortal comprehension, ancient cosmic awareness.`
  },
  17: {
    name: "Divine Form",
    prompt: `A {spirit} approaching godhood.

━━━ SIZE ━━━
- PLANETARY scale
- Divine proportions

━━━ DIVINE FEATURES ━━━
- Species essence visible through divine form
- Multiple dimensional echoes possible
- {element} as universal force
- Space-time distorts around presence
- Divine halos, crowns, or similar manifestations

━━━ GODLIKE POWER ━━━
- Reality reshapes to will
- Stars orbit around form
- Divine energy radiates endlessly

━━━ COLORS ━━━
- {color} as pure divine light
- Transcendent luminescence

EXPRESSION: Benevolent deity, infinite wisdom and power.`
  },

  // === COSMIC/DIVINE STAGES 18-20 ===
  18: {
    name: "Universal Form",
    prompt: `A {spirit} of universe-shaping power.

━━━ SIZE ━━━
- STELLAR scale - size of stars

━━━ UNIVERSAL FEATURES ━━━
- Species identity core to cosmic form
- Galaxies flow around and through form
- {element} as fundamental universal force
- Creates and destroys stars with presence
- Multiple form echoes through dimensions

━━━ COSMIC MANIFESTATION ━━━
- Is becoming part of universe itself
- Other celestial bodies respond to presence
- {color} light bends reality

EXPRESSION: Universal consciousness, beyond individual awareness.`
  },
  19: {
    name: "Primordial Form",
    prompt: `A {spirit} as a primordial universal force.

━━━ SIZE ━━━
- GALACTIC scale

━━━ PRIMORDIAL FEATURES ━━━
- Species essence is the core of galactic-scale being
- Existed before time, will exist after
- {element} as primordial force of creation
- Reality, time, and space bow to will
- Divine perfection in every detail

━━━ CREATION POWER ━━━
- Universes spawn in wake of movement
- Is becoming the element itself
- {color} is the color of creation

EXPRESSION: The infinite, the eternal, the primordial.`
  },
  20: {
    name: "Origin Form",
    prompt: `The ULTIMATE {spirit} - the primordial template from which all others descend.

━━━ SCALE ━━━
- UNIVERSE scale - contains multitudes

━━━ THE ORIGIN ━━━
- This is THE FIRST {spirit} - the original from which all descend
- Perfect species anatomy visible through divine cosmic form:
  - Face structure 100% {spirit}
  - Eye shape and placement exactly correct
  - Body proportions matching species perfectly
  - All species-defining features present
- Every surface glowing with {color} cosmic genesis energy
- Fur/feathers/scales shimmer like living stardust
- Background shows universes being born from presence

━━━ ELEMENTAL APOTHEOSIS ━━━
- IS the {element} - not just controls it, IS it
- All {element} in existence flows from this being

━━━ DIVINE PRESENCE ━━━
- Perfect in every biological detail
- Infinite in cosmic power
- The beloved companion ascended to absolute divine completion
- Recognizably the same creature, transcended to godhood

━━━ COLORS ━━━
- {color} as the color of reality itself
- Every hue and shade originates here

THIS IS PERFECTION INCARNATE: The Original, The First, The Eternal.`
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getDefaultAnatomy(spiritAnimal: string): CreatureAnatomy {
  // Fallback for any creature not in our database
  return {
    category: "unknown",
    limbCount: 4,
    hasWings: false,
    hasTail: true,
    bodyType: "quadruped",
    babyFeatures: "round fluffy body, oversized head, big eyes, stubby limbs",
    adultFeatures: "fully developed adult features appropriate to species",
    anatomyNotes: `Follow real-world ${spiritAnimal} anatomy exactly`,
    prohibitedFeatures: "extra limbs, multiple heads, wings (unless naturally has them)",
    realWorldRef: spiritAnimal
  };
}

function generateCharacterDNA(
  spiritAnimal: string,
  element: string,
  favoriteColor: string,
  eyeColor: string | undefined,
  furColor: string | undefined,
  stage: number
): string {
  const anatomy = CREATURE_ANATOMY[spiritAnimal] || getDefaultAnatomy(spiritAnimal);
  const isBabyStage = stage >= 2 && stage <= 7;

  return `
╔══════════════════════════════════════════════════════════════════════════════╗
║                    CHARACTER DNA - IMMUTABLE IDENTITY                        ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ SPECIES: ${spiritAnimal.toUpperCase().padEnd(65)}║
║ Category: ${anatomy.category.padEnd(64)}║
║ Body Type: ${anatomy.bodyType.padEnd(63)}║
╠══════════════════════════════════════════════════════════════════════════════╣
║                          ANATOMICAL REQUIREMENTS                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ Limb Count: EXACTLY ${anatomy.limbCount} limbs (never more, never less)${' '.repeat(39 - String(anatomy.limbCount).length)}║
║ Has Wings: ${anatomy.hasWings ? 'YES - species naturally has wings' : 'NO - do NOT add wings under any circumstances'}${' '.repeat(anatomy.hasWings ? 31 : 14)}║
║ Has Tail: ${anatomy.hasTail ? 'YES - include tail' : 'NO - no tail'}${' '.repeat(anatomy.hasTail ? 46 : 52)}║
╠══════════════════════════════════════════════════════════════════════════════╣
║                          COLOR LOCK (NEVER CHANGE)                           ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ Primary Body Color: ${favoriteColor} - THIS IS THE MAIN COLOR${' '.repeat(Math.max(0, 35 - favoriteColor.length))}║
║ Eye Color: ${(eyeColor || favoriteColor)} - SAME in EVERY stage${' '.repeat(Math.max(0, 43 - (eyeColor || favoriteColor).length))}║
║ Fur/Feather/Scale Color: ${(furColor || favoriteColor)}${' '.repeat(Math.max(0, 48 - (furColor || favoriteColor).length))}║
║ Element Effects: ${element} glow/particles ONLY (does NOT change body color)${' '.repeat(Math.max(0, 7 - element.length))}║
╠══════════════════════════════════════════════════════════════════════════════╣
║                          STAGE-SPECIFIC FEATURES                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
${isBabyStage ? `║ BABY FEATURES (Stages 2-7):                                                  ║
║ ${anatomy.babyFeatures.substring(0, 74).padEnd(74)}║` : `║ ADULT FEATURES (Stages 8+):                                                  ║
║ ${anatomy.adultFeatures.substring(0, 74).padEnd(74)}║`}
╠══════════════════════════════════════════════════════════════════════════════╣
║ ANATOMY NOTES:                                                               ║
║ ${anatomy.anatomyNotes.substring(0, 74).padEnd(74)}║
╠══════════════════════════════════════════════════════════════════════════════╣
║ REAL-WORLD REFERENCE: ${anatomy.realWorldRef.substring(0, 51).padEnd(51)}║
╠══════════════════════════════════════════════════════════════════════════════╣
║                         PROHIBITED (NEVER INCLUDE)                           ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ ${anatomy.prohibitedFeatures.substring(0, 74).padEnd(74)}║
╚══════════════════════════════════════════════════════════════════════════════╝`;
}

function getNegativePrompts(stage: number, spiritAnimal: string, anatomy: CreatureAnatomy): string {
  const base = [
    "different color than specified in Character DNA",
    "color drift or shift from previous stages",
    "wrong species features",
    "hybrid creature (unless specifically a hybrid species)",
    "human features or anthropomorphism",
    "wrong number of limbs",
    "extra heads (unless Cerberus/Hydra)",
    "merged or fused body parts"
  ];

  // Baby stages (2-7): Prevent mature appearances
  const babyNegatives = stage >= 2 && stage <= 7 ? [
    "muscular build",
    "athletic appearance",
    "adult proportions",
    "mature features",
    "battle scars or weathering",
    "fierce/intimidating expression",
    "large size",
    "fully developed wings (wings should be nubs/buds)",
    "long limbs (limbs should be stubby)"
  ] : [];

  // Adolescent stages (8-12): Prevent both baby and mythic features
  const adolescentNegatives = stage >= 8 && stage <= 12 ? [
    "baby proportions",
    "cosmic/divine features",
    "reality-warping effects",
    "planet-sized scale"
  ] : [];

  // Creature-specific negatives
  const creatureNegatives: string[] = [];
  if (!anatomy.hasWings) {
    creatureNegatives.push("wings of any kind", "feathered wings", "bat wings", "energy wings (at realistic stages)");
  }
  if (!anatomy.hasTail) {
    creatureNegatives.push("tail of any kind");
  }
  if (anatomy.limbCount === 0) {
    creatureNegatives.push("legs", "arms", "limbs of any kind");
  }

  const allNegatives = [...base, ...babyNegatives, ...adolescentNegatives, ...creatureNegatives];

  return `
━━━ NEGATIVE PROMPTS - DO NOT INCLUDE ━━━
${allNegatives.map(n => `✗ ${n}`).join('\n')}

SPECIES-SPECIFIC PROHIBITED:
✗ ${anatomy.prohibitedFeatures}`;
}

function getStoryToneModifiers(tone?: string): string {
  const selectedTone = STORY_TONE_MODIFIERS[tone as keyof typeof STORY_TONE_MODIFIERS] || STORY_TONE_MODIFIERS.epic_adventure;
  
  return `
━━━ STORY TONE STYLING ━━━
Lighting: ${selectedTone.lighting}
Atmosphere: ${selectedTone.atmosphere}
Expression: ${selectedTone.expression}
Color Enhancement: ${selectedTone.colors}`;
}

function getElementOverlay(element: string): string {
  const overlay = ELEMENT_AS_OVERLAY[element.toLowerCase()] || ELEMENT_AS_OVERLAY.light;
  
  return `
━━━ ELEMENTAL EFFECTS (OVERLAY ONLY - NOT BODY COLOR) ━━━
CRITICAL: These effects appear AROUND the creature, NOT changing its body color!
${overlay}`;
}

// ============================================================================
// MAIN SERVER
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    console.log("Generating companion image - request received");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Authentication required. Please refresh the page and try again.", code: "NO_AUTH_HEADER" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !supabaseKey) {
      console.error("Supabase configuration missing");
      return new Response(
        JSON.stringify({ error: "Server configuration error. Please contact support.", code: "SERVER_CONFIG_ERROR" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error("Authentication failed:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid authentication. Please refresh the page and try again.", code: "INVALID_AUTH" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    console.log(`User authenticated: ${user.id}`);

    const {
      spiritAnimal,
      element,
      stage,
      favoriteColor,
      eyeColor,
      furColor,
      retryAttempt = 0,
      storyTone,
      previousStageImageUrl, // NEW: For image-to-image editing
      companionId // NEW: To fetch previous stage if not provided
    } = await req.json();

    console.log(`Request params - Animal: ${spiritAnimal}, Element: ${element}, Stage: ${stage}, Color: ${favoriteColor}, Retry: ${retryAttempt}`);

    if (!spiritAnimal) throw new Error("spiritAnimal is required");
    if (!element) throw new Error("element is required");
    if (stage === undefined || stage === null) throw new Error("stage is required");
    if (!favoriteColor) throw new Error("favoriteColor is required");

    const anatomy = CREATURE_ANATOMY[spiritAnimal] || getDefaultAnatomy(spiritAnimal);
    const stageInfo = EVOLUTION_STAGES[stage as number];

    if (!stageInfo) {
      console.error(`Invalid stage provided: ${stage}`);
      throw new Error(`Invalid stage: ${stage}`);
    }

    // ========================================================================
    // IMAGE-TO-IMAGE FOR ALL STAGES 2+ (Extended from baby only)
    // ========================================================================
    let useImageToImage = false;
    let previousImageUrl: string | null = null;

    // Use image-to-image for ALL stages 2+ to maintain consistency
    if (stage >= 2) {
      // Try to get previous stage image
      if (previousStageImageUrl) {
        previousImageUrl = previousStageImageUrl;
        useImageToImage = true;
        console.log(`Using provided previous stage image for image-to-image editing (stage ${stage})`);
      } else if (companionId) {
        // Fetch from companion_evolutions table
        const previousStage = stage - 1;
        const { data: prevEvolution } = await supabase
          .from('companion_evolutions')
          .select('image_url')
          .eq('companion_id', companionId)
          .eq('stage', previousStage)
          .single();

        if (prevEvolution?.image_url) {
          previousImageUrl = prevEvolution.image_url;
          useImageToImage = true;
          console.log(`Fetched previous stage ${previousStage} image for image-to-image editing`);
        }
      }
    }
    
    // Get aging parameters for current and previous stage
    const currentAgingParams = AGING_PARAMETERS[stage as number];
    const previousAgingParams = stage > 2 ? AGING_PARAMETERS[(stage - 1) as number] : null;

    // ========================================================================
    // BUILD THE PROMPT
    // ========================================================================

    const characterDNA = generateCharacterDNA(spiritAnimal, element, favoriteColor, eyeColor, furColor, stage);
    const negativePrompts = getNegativePrompts(stage, spiritAnimal, anatomy);
    const storyToneStyle = getStoryToneModifiers(storyTone);
    const elementOverlay = getElementOverlay(element);

    // Replace template variables in stage prompt
    const stagePrompt = stageInfo.prompt
      .replace(/{spirit}/g, spiritAnimal)
      .replace(/{element}/g, element)
      .replace(/{color}/g, favoriteColor);

    // Retry enforcement
    const retryEnforcement = retryAttempt > 0 ? `

━━━ RETRY ENFORCEMENT (Attempt ${retryAttempt}) ━━━
CRITICAL - Previous attempt had anatomical errors. This time:
- EXACTLY ${anatomy.limbCount} limbs - count them carefully
- ${anatomy.hasWings ? 'Include wings as species naturally has them' : 'NO WINGS - species does not have wings'}
- SINGLE HEAD ONLY - no multiple heads or faces
- Every limb distinct and separate
- Follow EXACT ${spiritAnimal} bone structure
- Reference: Study a real ${anatomy.realWorldRef} photograph` : '';

    let fullPrompt: string;

    if (stage === 0 || stage === 1) {
      // Egg stages - special handling
      fullPrompt = `STYLIZED FANTASY ART - Digital painting style:

${stagePrompt}

${characterDNA}
${storyToneStyle}
${elementOverlay}

RENDERING STYLE:
- Stylized digital fantasy art, high-quality game illustrations
- Painterly with rich colors, soft edges
- NOT photorealistic, NOT hyper-cartoonish
- Magical and ethereal atmosphere`;

    } else if (useImageToImage && previousImageUrl && currentAgingParams) {
      // IMAGE-TO-IMAGE EDITING with quantified aging parameters for ALL stages 2+
      
      // Build the before→after aging changes
      let agingChangesPrompt = '';
      
      if (previousAgingParams) {
        agingChangesPrompt = `
━━━ AGING MODIFICATIONS TO APPLY (Before → After) ━━━
• Eye Openness: ${previousAgingParams.eyeOpenness} → ${currentAgingParams.eyeOpenness}
• Body Roundness: ${previousAgingParams.bodyRoundness} → ${currentAgingParams.bodyRoundness}
• Fur/Coat State: ${previousAgingParams.furState} → ${currentAgingParams.furState}
• Limb Development: ${previousAgingParams.limbDevelopment} → ${currentAgingParams.limbDevelopment}
• Mobility/Pose: ${previousAgingParams.mobilityLevel} → ${currentAgingParams.mobilityLevel}
• Size: ${previousAgingParams.sizePercent} → ${currentAgingParams.sizePercent}
• Muscle Definition: ${previousAgingParams.muscleDefinition} → ${currentAgingParams.muscleDefinition}
• Wing Development: ${previousAgingParams.wingDevelopment} → ${currentAgingParams.wingDevelopment}
• Elemental Power: ${previousAgingParams.elementalManifest} → ${currentAgingParams.elementalManifest}
• Cosmic Power: ${previousAgingParams.cosmicPower} → ${currentAgingParams.cosmicPower}`;
      } else {
        // Stage 2 (first baby stage, no previous aging params)
        agingChangesPrompt = `
━━━ STAGE 2 HATCHING STATE ━━━
• Eye Openness: ${currentAgingParams.eyeOpenness}
• Body Roundness: ${currentAgingParams.bodyRoundness}
• Fur/Coat State: ${currentAgingParams.furState}
• Limb Development: ${currentAgingParams.limbDevelopment}
• Mobility/Pose: ${currentAgingParams.mobilityLevel}
• Size: ${currentAgingParams.sizePercent}
• Muscle Definition: ${currentAgingParams.muscleDefinition}
• Wing Development: ${currentAgingParams.wingDevelopment}`;
      }
      
      // Stage category-specific instructions
      let stageCategory = '';
      if (stage >= 2 && stage <= 7) {
        stageCategory = `
━━━ BABY STAGE RULES ━━━
- Keep the creature looking like a BABY/INFANT
- NO muscle definition, NO athletic appearance
- Round, soft, adorable proportions
- This is "spot the difference" - barely change anything`;
      } else if (stage >= 8 && stage <= 12) {
        stageCategory = `
━━━ ADOLESCENT/ADULT STAGE RULES ━━━
- Creature is maturing physically
- Growing more athletic and capable
- Species features becoming more defined
- Maintain core identity while allowing natural growth`;
      } else if (stage >= 13 && stage <= 17) {
        stageCategory = `
━━━ MYTHIC STAGE RULES ━━━
- Creature transcending normal limits
- Add subtle magical/divine enhancements
- Elemental power becoming visible
- Growing beyond normal species size`;
      } else if (stage >= 18) {
        stageCategory = `
━━━ COSMIC/DIVINE STAGE RULES ━━━
- Creature becoming cosmic entity
- Stars, galaxies, divine light in form
- Reality-warping scale and power
- Species identity preserved at divine scale`;
      }

      fullPrompt = `IMAGE AGING INSTRUCTION - EVOLVE THE CREATURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

I am providing an image of a Stage ${stage - 1} ${spiritAnimal}.
Age/evolve this creature to Stage ${stage} (${stageInfo.name}) using the EXACT modifications below.

${agingChangesPrompt}

${stageCategory}

━━━ ABSOLUTELY LOCKED (NO CHANGE ALLOWED) ━━━
✓ Body Color: KEEP EXACT ${favoriteColor} - do not shift or alter
✓ Eye Color: KEEP EXACT ${eyeColor || favoriteColor} - identical shade
✓ Fur/Feather/Scale Color: KEEP EXACT ${furColor || favoriteColor}
✓ Species: Still a ${spiritAnimal} - same anatomy rules
✓ Art Style: Same digital painting style and quality
✓ Face Structure: Same facial features and proportions
✓ Unique Markings: Any patterns or markings must remain

━━━ STAGE ${stage} DESCRIPTION ━━━
${stagePrompt}

${characterDNA}
${elementOverlay}
${negativePrompts}

CRITICAL: This should look like the SAME creature at a slightly older/more developed stage.
Apply ONLY the percentage changes listed above. Colors must be IDENTICAL.`;

    } else {
      // Standard text-to-image generation
      fullPrompt = `STYLIZED FANTASY CREATURE - Digital painting, game art quality

${characterDNA}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EVOLUTION STAGE ${stage}: ${stageInfo.name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${stagePrompt}

${storyToneStyle}
${elementOverlay}
${retryEnforcement}
${negativePrompts}

━━━ RENDERING STYLE ━━━
- Stylized digital fantasy art like high-quality game illustrations
- Appealing and charming with expressive features
- NOT photorealistic, NOT hyper-cartoonish
- Painterly digital art with rich saturated colors
- Soft but defined edges, expressive eyes with personality`;
    }

    // ========================================================================
    // CALL AI FOR IMAGE GENERATION
    // ========================================================================

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured in environment");
      return new Response(
        JSON.stringify({ error: "AI service not configured. Please contact support.", code: "AI_SERVICE_NOT_CONFIGURED" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log(`Calling Lovable AI for ${useImageToImage ? 'image-to-image' : 'text-to-image'} generation...`);

    // Build the message content
    let messageContent: any;

    if (useImageToImage && previousImageUrl) {
      // Image-to-image editing
      messageContent = [
        { type: "text", text: fullPrompt },
        { type: "image_url", image_url: { url: previousImageUrl } }
      ];
    } else {
      // Text-to-image generation
      messageContent = fullPrompt;
    }

    let aiResponse;
    try {
      aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [{ role: "user", content: messageContent }],
          modalities: ["image", "text"]
        })
      });
    } catch (fetchError) {
      console.error("Network error calling AI service:", fetchError);
      return new Response(
        JSON.stringify({ error: "Network error. Please check your connection and try again.", code: "NETWORK_ERROR" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 503 }
      );
    }

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Lovable AI error:", errorText);

      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Insufficient AI credits. Please contact support or try again later.", code: "INSUFFICIENT_CREDITS" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 402 }
        );
      }

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI service is currently busy. Please wait a moment and try again.", code: "RATE_LIMITED" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
        );
      }

      throw new Error(`Lovable AI request failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const imageUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error("No image URL in AI response:", JSON.stringify(aiData));
      throw new Error("No image URL in response");
    }

    console.log("Image generated successfully, uploading to storage...");

    const base64Data = imageUrl.split(",")[1];
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const filePath = `${user.id}/companion_${user.id}_stage${stage}_${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("mentors-avatars")
      .upload(filePath, binaryData, { contentType: "image/png", upsert: false });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage.from("mentors-avatars").getPublicUrl(filePath);

    console.log(`Companion image uploaded successfully: ${publicUrl}`);

    return new Response(
      JSON.stringify({ imageUrl: publicUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
