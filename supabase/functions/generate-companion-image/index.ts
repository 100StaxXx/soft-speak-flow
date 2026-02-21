import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import {
  getCompanionFastRetryLimits,
  isCompanionFastPathEligible,
  resolveCompanionImageSizeForUser,
} from "../_shared/companionImagePolicy.ts";

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
  "canine": { limbCount: 4, hasWings: false, hasTail: true, bodyType: "quadruped", prohibitedBase: ["wings", "horns", "scales"] },
  "feline": { limbCount: 4, hasWings: false, hasTail: true, bodyType: "quadruped", prohibitedBase: ["wings", "floppy ears", "blunt face"] },
  "dragon": { limbCount: 4, hasWings: true, hasTail: true, bodyType: "quadruped-winged", prohibitedBase: ["fur", "feathers"] },
  "bird": { limbCount: 2, hasWings: true, hasTail: true, bodyType: "biped-winged", prohibitedBase: ["4 legs", "teeth", "fur"] },
  "equine": { limbCount: 4, hasWings: false, hasTail: true, bodyType: "quadruped", prohibitedBase: ["wings", "claws", "split hooves"] },
  "reptile": { limbCount: 4, hasWings: false, hasTail: true, bodyType: "quadruped", prohibitedBase: ["wings", "fur", "feathers"] },
  "aquatic": { limbCount: 0, hasWings: false, hasTail: true, bodyType: "aquatic-streamlined", prohibitedBase: ["legs", "wings", "fur"] },
  "mammal": { limbCount: 4, hasWings: false, hasTail: true, bodyType: "quadruped", prohibitedBase: ["wings", "scales"] },
  "primate": { limbCount: 4, hasWings: false, hasTail: false, bodyType: "quadruped-knuckle", prohibitedBase: ["wings", "tail"] },
  "invertebrate": { limbCount: 8, hasWings: false, hasTail: false, bodyType: "aquatic-tentacle", prohibitedBase: ["skeleton", "fur"] },
  "mythical": { limbCount: 4, hasWings: false, hasTail: true, bodyType: "quadruped", prohibitedBase: [] },
  "insect": { limbCount: 6, hasWings: true, hasTail: false, bodyType: "insect-winged", prohibitedBase: ["4 legs", "tail", "fur", "vertebrate skeleton"] }
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
const CREATURE_DATA: Record<string, { cat: string; baby: string; adult: string; notes: string; prohibited?: string; ref?: string; wings?: boolean; limbs?: number; tail?: boolean; body?: string }> = {
  // === CANINES ===
  "Wolf": { cat: "canine", baby: "oversized floppy ears, round snout, fluffy round body, huge paws, soft puppy fur", adult: "pointed erect ears, long elegant snout, thick fur ruff, bushy tail, muscular shoulders", notes: "Digitigrade legs, 4 toes with non-retractable claws, golden/amber eyes typical", ref: "grey wolf" },
  "Fox": { cat: "canine", baby: "ENORMOUS ears relative to tiny head, button nose, fluffy round body", adult: "large pointed triangular ears, slender build, extremely bushy tail, narrow snout, white chest", notes: "Distinctive ear-to-head ratio is KEY, vertical slit pupils", prohibited: "wings, multiple tails, blunt snout", ref: "red fox" },
  "Arctic Fox": { cat: "canine", baby: "pure white fluffy ball, tiny dark nose, small rounded ears", adult: "thick white/silver coat, compact body, small rounded ears, bushy tail wraps around body", notes: "Compact body, SHORTER snout than red fox, SMALL ears (heat retention)", prohibited: "wings, long ears", ref: "arctic fox" },
  "Fennec Fox": { cat: "canine", baby: "ABSOLUTELY ENORMOUS ears even as baby, tiny cream-colored fluffy body", adult: "MASSIVE bat-like ears (larger than head width), tiny body, cream/sand coloring, large dark eyes", notes: "SMALLEST canine, ears are 6 inches on 8-inch body - ears MUST be comically oversized", prohibited: "wings, small ears, large body", ref: "fennec fox" },
  "Dog": { cat: "canine", baby: "floppy ears, round puppy face, oversized paws, soft puppy fur", adult: "friendly expression, floppy or erect ears, wagging tail, loyal loving eyes", notes: "Domesticated wolf descendant, expressive face, 4 toes visible per foot", ref: "golden retriever" },
  "Hyena": { cat: "canine", baby: "spotted fluffy fur, rounded ears, short snout, compact round body", adult: "sloped back (front higher than rear), large rounded ears, powerful jaw, spotted coat, mane along spine", notes: "UNIQUE sloped back profile, large rounded ears, powerful neck and jaw", prohibited: "wings, level back, wolf proportions", ref: "spotted hyena" },
  "Tanuki": { cat: "canine", baby: "round fluffy body, dark mask markings around eyes, stubby legs", adult: "raccoon-like mask markings, fluffy body, bushy striped tail, round face, short legs", notes: "Japanese raccoon dog - NOT a raccoon, rounder body than fox, dark eye mask", prohibited: "wings, raccoon hands, tall legs", ref: "tanuki" },
  
  // === MYTHICAL CANINES ===
  "Fenrir": { cat: "canine", baby: "oversized wolf pup with fierce eyes, dark/shadow fur, tiny fangs visible", adult: "MASSIVE wolf of world-ending scale, chains/bindings, enormous fangs, cosmic-dark fur", notes: "Norse giant wolf - WOLF anatomy at colossal scale, glowing fierce eyes", ref: "Norse giant wolf" },
  "Cerberus": { cat: "canine", baby: "THREE adorable puppy heads sharing one body, dark fur, red/orange eyes", adult: "THREE fierce dog heads on one muscular body, dark fur, hellfire eyes, serpent tail possible", notes: "EXACTLY THREE HEADS (no more, no less), single powerful body", prohibited: "wings, two heads, one head, more than three heads", ref: "Greek hellhound", body: "quadruped-multihead" },
  
  // === FELINES ===
  "Cat": { cat: "feline", baby: "huge eyes relative to face, tiny triangle ears, fluffy round body", adult: "elegant slender body, pointed triangle ears, expressive almond eyes, long graceful tail", notes: "Retractable claws, vertical slit pupils, whiskers, 5 front toes 4 back", ref: "domestic cat" },
  "Lion": { cat: "feline", baby: "spotted fluffy cub, oversized paws, round face, no mane yet", adult: "MALES: magnificent mane framing face, powerful muscular build, tufted tail", notes: "Largest African cat, males have mane, tufted tail tip, rounded ears", prohibited: "wings, stripes, mane on females", ref: "African lion" },
  "Tiger": { cat: "feline", baby: "fluffy striped cub, oversized paws, round face, blue eyes", adult: "bold black stripes on orange coat, white chest/belly, powerful build", notes: "STRIPES are unique like fingerprints, white spots behind ears, amber eyes", prohibited: "wings, spots, mane, solid color", ref: "Bengal tiger" },
  "Panther": { cat: "feline", baby: "solid dark fluffy cub, golden/green eyes stand out against dark fur", adult: "sleek solid black coat, muscular build, glowing golden or green eyes", notes: "Melanistic leopard/jaguar - may have faint rosettes, extremely muscular", prohibited: "wings, obvious spots, mane", ref: "black panther" },
  "Snow Leopard": { cat: "feline", baby: "fluffy grey-white spotted cub, EXTREMELY long fluffy tail", adult: "pale grey coat with black rosettes, EXTREMELY LONG thick tail, small rounded ears", notes: "SIGNATURE: Tail almost as long as body and very thick/fluffy, GREEN eyes", prohibited: "wings, short tail, orange coloring", ref: "snow leopard" },
  "Cheetah": { cat: "feline", baby: "fluffy grey mane down back, spotted coat, black tear marks on face", adult: "LEAN athletic build, solid black spots, distinctive black tear marks from eyes to mouth", notes: "LEANEST cat - built for speed, solid spots NOT rosettes, tear lines SIGNATURE", prohibited: "wings, bulky build, rosettes", ref: "cheetah", body: "quadruped-lean" },
  "Jaguar": { cat: "feline", baby: "fluffy spotted cub with rosettes, stocky build even as baby", adult: "stocky powerful build, rosettes with spots inside them, massive jaw muscles", notes: "STOCKIEST big cat, rosettes have SPOTS INSIDE them, massive head and jaw", prohibited: "wings, lean build, solid spots", ref: "jaguar" },
  "Lynx": { cat: "feline", baby: "fluffy spotted kitten, ear tufts already visible, short stubby tail", adult: "distinctive black EAR TUFTS, spotted coat, very short bobbed tail, facial ruff", notes: "SIGNATURE: Black tufts on ear tips, very SHORT tail, facial ruff", prohibited: "wings, long tail, missing ear tufts", ref: "Eurasian lynx" },
  "Puma / Cougar": { cat: "feline", baby: "SPOTTED cubs (lose spots as adults), blue eyes, oversized paws", adult: "solid tawny/tan coat (NO spots as adult), small round head, long tail with dark tip", notes: "Adults are SOLID colored, small head relative to body, long thick tail", prohibited: "wings, spots on adults, mane", ref: "mountain lion" },
  
  // === MYTHICAL FELINES ===
  "Sphinx": { cat: "feline", baby: "lion cub body with small wing nubs, human-like wise eyes", adult: "lion body with large eagle/feathered wings, serene wise expression, regal posture", notes: "Egyptian: lion body + wings + wise expression, majestic feathered wings", wings: true, body: "quadruped-winged", ref: "Egyptian sphinx" },
  "Kitsune": { cat: "canine", baby: "adorable fox kit with 1-2 small fluffy tails, white/golden fur", adult: "elegant fox with MULTIPLE flowing tails (up to 9), white/golden/silver fur, mystical flames", notes: "Japanese fox spirit - MORE TAILS = MORE POWERFUL (1-9 tails), fox fire flames", body: "quadruped-multitail", ref: "nine-tailed fox" },
  
  // === DRAGONS & REPTILES ===
  "Dragon": { cat: "dragon", baby: "small cute dragon with oversized head, tiny wing nubs, stubby tail", adult: "4 legs + 2 wings (6 limbs), scales, horns, powerful tail, fire breath, majestic wingspan", notes: "Western dragon: 4 legs + 2 wings = 6 limbs, scales, horns on head, long neck", ref: "Western dragon" },
  "Wyvern": { cat: "dragon", baby: "small wyvern with oversized wings that serve as front limbs, 2 back legs", adult: "2 back legs ONLY, wings ARE the front limbs (like a bat), barbed tail", notes: "ONLY 2 legs + 2 wings (4 limbs), wings double as front limbs", prohibited: "4 legs, front legs separate from wings", limbs: 2, body: "biped-winged", ref: "wyvern" },
  "Hydra": { cat: "dragon", baby: "small serpentine creature with 2-3 small heads, scales", adult: "MULTIPLE serpentine heads (5-9) on long necks from one body, reptilian, no wings", notes: "MULTIPLE HEADS on long serpentine necks, regenerating heads in myth", prohibited: "wings, single head, fur", wings: false, body: "quadruped-multihead", ref: "Greek Hydra" },
  "Basilisk": { cat: "reptile", baby: "small serpent with crown-like crest on head, scales, deadly eyes", adult: "massive serpent with crown/crest, deadly gaze, iridescent scales, no limbs", notes: "King of serpents - crown-like crest, deadly gaze, serpentine body NO legs", prohibited: "legs, chicken features", limbs: 0, body: "serpent", ref: "basilisk serpent" },
  "T-Rex": { cat: "reptile", baby: "adorable baby T-Rex with oversized head, tiny arms, fluffy feathers", adult: "massive bipedal dinosaur, TINY arms with 2 fingers, enormous head with massive teeth", notes: "Bipedal on 2 powerful legs, TINY useless arms, massive skull and teeth", prohibited: "wings, long arms, quadruped stance", limbs: 4, body: "biped", ref: "Tyrannosaurus Rex" },
  "Velociraptor": { cat: "reptile", baby: "small feathered raptor, big intelligent eyes, tiny claws", adult: "sleek feathered raptor, large sickle claw on each foot, intelligent eyes, FEATHERS", notes: "Actually had FEATHERS, sickle-shaped killing claw, intelligent, turkey-sized", prohibited: "wings, scales, large size", limbs: 4, body: "biped", ref: "feathered velociraptor" },
  "Crocodile": { cat: "reptile", baby: "tiny croc with oversized head, eyes on top of head, little teeth", adult: "armored scaly body, long snout with visible teeth, eyes and nostrils on top", notes: "Low-slung body, eyes/nostrils on TOP of head, interlocking teeth, armored scales", prohibited: "wings, fur, upright stance", body: "quadruped-low", ref: "saltwater crocodile" },
  "Snake": { cat: "reptile", baby: "small coiled serpent, tiny scales, curious forked tongue", adult: "elegant serpent body, scales, forked tongue, no limbs, mesmerizing eyes", notes: "NO LIMBS at all, scales covering body, forked tongue for sensing", prohibited: "legs, arms, wings, fur, ears", limbs: 0, body: "serpent", ref: "python, cobra" },
  "Sea Turtle": { cat: "reptile", baby: "tiny turtle with oversized shell, flipper limbs, big dark eyes", adult: "large domed shell, powerful flipper limbs (NOT legs), beak-like mouth", notes: "FLIPPERS not legs, domed shell, beak-like mouth without teeth", prohibited: "legs/feet, teeth, wings", body: "quadruped-flippers", ref: "green sea turtle" },
  
  // === BIRDS ===
  "Eagle": { cat: "bird", baby: "fluffy grey/white chick, oversized beak, downy feathers, wobbly stance", adult: "powerful hooked beak, fierce golden eyes, massive wingspan, sharp talons", notes: "2 legs with powerful talons, 2 wings, hooked beak, fierce forward-facing eyes", ref: "bald eagle" },
  "Falcon": { cat: "bird", baby: "fluffy white chick, oversized head, dark eyes, downy feathers", adult: "sleek aerodynamic body, pointed wings, dark facial markings, extremely fast", notes: "FASTEST animal alive, pointed swept-back wings, dark mustache marks", prohibited: "4 legs, rounded wings, bulky build", ref: "peregrine falcon" },
  "Hawk": { cat: "bird", baby: "fluffy chick with large eyes, downy feathers, oversized feet", adult: "broad rounded wings, keen eyes, hooked beak, banded tail feathers", notes: "Broader wings than falcon, red-tailed variety has rust-colored tail", ref: "red-tailed hawk" },
  "Owl": { cat: "bird", baby: "round fluffy owlet, ENORMOUS eyes, heart-shaped or round face", adult: "round flat face, ENORMOUS forward-facing eyes, ear tufts, silent flight feathers", notes: "HUGE forward-facing eyes, flat facial disc, can rotate head 270°", prohibited: "4 legs, small eyes, side-facing eyes", ref: "great horned owl" },
  "Raven": { cat: "bird", baby: "fluffy black chick, large beak, curious intelligent eyes", adult: "glossy black feathers with iridescent sheen, large curved beak, intelligent eyes", notes: "Larger than crow, wedge-shaped tail, iridescent black plumage", ref: "common raven" },
  "Parrot": { cat: "bird", baby: "fluffy colorful chick, oversized curved beak, pin feathers", adult: "vibrant colorful plumage, large curved beak, zygodactyl feet (2 forward, 2 back)", notes: "CURVED beak for cracking seeds, zygodactyl feet for climbing, vibrant colors", ref: "macaw" },
  "Hummingbird": { cat: "bird", baby: "absolutely TINY fluffy chick, long thin beak already visible", adult: "TINY body, extremely fast-beating wings (blur when flying), long thin beak", notes: "SMALLEST bird, wings move in figure-8 (can hover), needle-like beak", prohibited: "large size, 4 legs, short beak, slow wings", body: "biped-winged-tiny", ref: "ruby-throated hummingbird" },
  "Penguin": { cat: "bird", baby: "fluffy grey/brown chick, oversized head, stubby flipper wings", adult: "tuxedo black and white coloring, flipper wings (cannot fly), upright waddling stance", notes: "CANNOT FLY - wings are flippers for swimming, upright stance, webbed feet", prohibited: "flight capability, 4 legs, colorful plumage", body: "biped-flightless", ref: "emperor penguin" },
  
  // === MYTHICAL BIRDS ===
  "Phoenix": { cat: "bird", baby: "tiny bird made of gentle flames, ember eyes, small wing nubs, warm glow", adult: "majestic fire bird, flaming plumage in reds/oranges/golds, long elegant tail feathers", notes: "Bird of fire and rebirth, flames instead of or merged with feathers", prohibited: "4 legs, ice/cold colors, no flames, dark coloring", ref: "mythological phoenix" },
  "Thunderbird": { cat: "bird", baby: "storm-colored fluffy chick, crackling feathers, bright electric eyes", adult: "MASSIVE eagle-like bird, storm clouds in wings, lightning crackling, thunder with wingbeats", notes: "Native American myth - enormous eagle that controls storms, lightning in feathers", prohibited: "4 legs, small size, no storm elements, fire element", body: "biped-winged-giant", ref: "Native American thunderbird" },
  
  // === EQUINES ===
  "Horse (Stallion)": { cat: "equine", baby: "long-legged wobbly foal, oversized head, fuzzy coat, tiny mane", adult: "powerful muscular build, flowing mane and tail, elegant long legs", notes: "Single-toed hooves, flowing mane down neck, long tail from dock", ref: "Arabian horse" },
  "Unicorn": { cat: "equine", baby: "adorable foal with tiny horn nub on forehead, flowing mane, pure coat", adult: "elegant horse with SINGLE SPIRAL HORN on forehead, flowing ethereal mane", notes: "SINGLE spiral horn center of forehead, often white/silver, cloven hooves possible", prohibited: "wings (that's pegasus), multiple horns, no horn", ref: "mythological unicorn" },
  "Pegasus": { cat: "equine", baby: "adorable foal with small fluffy wing nubs, soft coat, oversized hooves", adult: "majestic horse with LARGE FEATHERED WINGS, powerful build, flowing mane/tail", notes: "Horse with FEATHERED BIRD WINGS (4 legs + 2 wings = 6 limbs), typically white", prohibited: "horn (that's an alicorn), bat wings", wings: true, body: "quadruped-winged", ref: "Greek Pegasus" },
  
  // === AQUATIC ===
  "Dolphin": { cat: "aquatic", baby: "small sleek calf, oversized head, playful expression", adult: "streamlined body, dorsal fin, tail flukes (horizontal), curved beak-like snout", notes: "NO LEGS - only fins, horizontal tail flukes (mammal), dorsal fin, blowhole", ref: "bottlenose dolphin" },
  "Shark": { cat: "aquatic", baby: "small shark pup, all fins present, large dark eyes, tiny teeth", adult: "powerful streamlined body, multiple fins, VERTICAL tail (fish), multiple rows of teeth", notes: "NO LEGS - only fins, VERTICAL tail fin (fish), gill slits, cartilage skeleton", prohibited: "legs, horizontal tail, lungs", ref: "great white shark" },
  "Orca": { cat: "aquatic", baby: "small calf with black and white pattern, orange tint to white patches", adult: "black and white pattern, tall dorsal fin, horizontal tail flukes, white eye patch", notes: "NO LEGS - flippers only, distinctive black/white pattern, TALL dorsal fin", ref: "killer whale" },
  "Blue Whale": { cat: "aquatic", baby: "relatively small calf (still huge), mottled blue-grey, horizontal flukes", adult: "ENORMOUS blue-grey body, mottled pattern, tiny dorsal fin, horizontal flukes", notes: "LARGEST ANIMAL EVER, NO LEGS, blue-grey mottled, baleen plates not teeth", prohibited: "legs, teeth, large dorsal fin", ref: "blue whale" },
  "Jellyfish": { cat: "invertebrate", baby: "tiny translucent bell, developing tentacles, gentle pulsing", adult: "translucent bell-shaped body, flowing tentacles beneath, bioluminescent glow", notes: "NO skeleton, translucent bell body, trailing tentacles, no brain, pulses to move", prohibited: "legs, skeleton, eyes, solid body", limbs: 0, body: "aquatic-bell", ref: "moon jellyfish" },
  
  // === INSECTS ===
  "Buttercat": { cat: "mythical", baby: "tiny fuzzy kitten with budding wing nubs, soft fur with butterfly patterns, playful curious eyes", adult: "adorable cat with large butterfly wings, soft fur with intricate wing patterns, cat ears and whiskers, graceful flight", notes: "Cat body with butterfly wings, 4 cat legs, 2 large patterned wings, cat tail, antennae optional, whimsical hybrid", prohibited: "6 legs, insect body, no fur, proboscis, compound eyes", limbs: 4, wings: true, tail: true, body: "quadruped-winged", ref: "fantasy butterfly cat hybrid" },
  "Octopus": { cat: "invertebrate", baby: "tiny translucent octopus, oversized head, 8 tiny tentacles", adult: "bulbous head, 8 suckered tentacles, color-changing skin, highly intelligent eyes", notes: "EXACTLY 8 tentacles with suckers, bulbous head/mantle, beak in center, very intelligent", prohibited: "legs, more or fewer than 8 tentacles, 10 limbs (that's squid)", ref: "giant Pacific octopus" },
  "Manta Ray": { cat: "aquatic", baby: "small ray with developing wing-like fins, long thin tail", adult: "MASSIVE flat diamond body, wing-like pectoral fins, cephalic fins near mouth", notes: "Flat diamond shape, NO LEGS, wing-like fins, horn-like cephalic fins, filter feeder", prohibited: "legs, thick body, stinger", body: "aquatic-flat", ref: "giant manta ray" },
  
  // === MYTHICAL AQUATIC ===
  "Kraken": { cat: "invertebrate", baby: "small but fierce cephalopod, 8 tentacles, glowing eyes, dark coloring", adult: "MASSIVE octopus/squid hybrid, 8-10 enormous tentacles, glowing eyes, ship-destroying size", notes: "Giant cephalopod of myth, 8-10 massive tentacles, enormous eyes, deep sea monster", prohibited: "legs, fur, small size, friendly appearance", body: "aquatic-tentacle-giant", ref: "mythological kraken" },
  "Leviathan": { cat: "aquatic", baby: "small sea serpent, scales, glowing eyes, serpentine body", adult: "COLOSSAL sea serpent/dragon, massive scales, world-ending size, primordial ocean god", notes: "Biblical sea monster, serpentine body, may have fins, enormous beyond comprehension", prohibited: "legs, small size, cute appearance", body: "aquatic-serpent-giant", ref: "Biblical Leviathan" },
  
  // === OTHER MAMMALS ===
  "Bear": { cat: "mammal", baby: "tiny fluffy cub, oversized paws, round face, curious eyes, playful", adult: "massive heavy build, thick fur, powerful paws with claws, small rounded ears", notes: "Plantigrade feet (walks on whole foot), powerful shoulders, small ears, very short tail", prohibited: "wings, long tail, digitigrade legs, thin build", body: "quadruped-heavy", ref: "grizzly bear" },
  "Elephant": { cat: "mammal", baby: "adorable baby elephant, oversized ears, tiny trunk, fuzzy sparse hair", adult: "MASSIVE body, long prehensile trunk, large fan-like ears, tusks, thick legs", notes: "Trunk is extended nose/lip, large ears for cooling, column-like legs, tusks are teeth", prohibited: "wings, no trunk, no ears, thin legs", body: "quadruped-heavy", ref: "African elephant" },
  "Gorilla": { cat: "primate", baby: "small infant gorilla, expressive face, clinging posture, large eyes", adult: "powerful muscular build, silver back (males), knuckle-walking posture, intelligent face", notes: "NO TAIL (great apes lack tails), knuckle-walking, silver back on males", prohibited: "wings, tail, fur-covered face", ref: "mountain gorilla" },
  "Rhino": { cat: "mammal", baby: "small rhino calf, tiny horn nub, thick skin, oversized head", adult: "massive armored-looking body, 1-2 HORNS on snout, thick grey skin, small ears", notes: "Horn made of keratin (hair protein), thick folded skin, 3 toes per foot", prohibited: "wings, smooth skin, no horn, fur", body: "quadruped-heavy", ref: "white rhino" },
  "Hippo": { cat: "mammal", baby: "small pink/grey calf, oversized head, stubby legs, in water", adult: "MASSIVE barrel body, huge mouth with tusks, eyes/ears on top of head, short legs", notes: "Eyes/ears/nostrils on TOP of head (for water), ENORMOUS mouth opening 180°", prohibited: "wings, long legs, small mouth", body: "quadruped-heavy", ref: "hippopotamus" },
  "Mammoth": { cat: "mammal", baby: "fluffy baby mammoth, long shaggy fur, tiny curved tusks, cute trunk", adult: "massive elephant-like body, LONG SHAGGY FUR, huge curved tusks, trunk, small ears", notes: "Like elephant but with LONG WOOLLY FUR, tusks curve MORE, SMALLER ears (cold)", prohibited: "wings, no fur, straight tusks, large ears", body: "quadruped-heavy", ref: "woolly mammoth" },
  "Kangaroo": { cat: "mammal", baby: "tiny joey, oversized back legs developing, may peek from pouch", adult: "powerful back legs for hopping, small arms, large ears, thick balancing tail, pouch", notes: "HOPS on powerful back legs, small front arms, THICK muscular tail for balance", prohibited: "wings, small tail, equal leg sizes", body: "biped-hopping", ref: "red kangaroo" },
  "Koala": { cat: "mammal", baby: "tiny fluffy koala joey, large round nose, clinging to imaginary parent", adult: "fluffy grey body, large round nose, round fluffy ears, no tail visible, climbing claws", notes: "Marsupial NOT a bear, large spoon-shaped nose, 2 thumbs on hands, eucalyptus diet", prohibited: "wings, tail, bear-like body, small nose", body: "quadruped-arboreal", ref: "koala" },
  "Red Panda": { cat: "mammal", baby: "tiny fluffy red and white cub, mask markings, oversized round ears", adult: "red-brown fur with white face markings, long bushy striped tail, round face, cute", notes: "NOT related to giant panda, bushy striped tail, white facial markings, tree-dwelling", prohibited: "wings, black/white coloring, short tail, ground-dwelling", body: "quadruped-arboreal", ref: "red panda" },
  "Panda": { cat: "mammal", baby: "tiny pink and white cub, slowly developing black markings, helpless", adult: "distinctive black and white pattern, black eye patches and ears, round face, bamboo diet", notes: "Black and white markings are DISTINCTIVE, black eye patches, round body, pseudo-thumb", prohibited: "wings, colored fur, non-bear body", body: "quadruped-heavy", ref: "giant panda" },
  "Sloth": { cat: "mammal", baby: "tiny sloth clinging to parent, long arms, small face, perpetual smile", adult: "long arms with curved claws, slow movements, algae-tinted fur, perpetual smile", notes: "Extremely slow, long curved claws, may have green algae in fur, hangs upside down", prohibited: "wings, fast movements, short arms, no claws", body: "quadruped-arboreal-slow", ref: "three-toed sloth" },
  "Rabbit": { cat: "mammal", baby: "tiny fluffy bunny, oversized long ears, twitching nose, round body", adult: "soft fluffy body, long upright ears, cotton tail, large back feet, twitching nose", notes: "Long UPRIGHT ears (not floppy unless lop breed), powerful back legs, cotton tail", prohibited: "wings, short ears, no cotton tail, carnivore features", body: "quadruped-hopping", ref: "rabbit" },
  "Mouse": { cat: "mammal", baby: "tiny pink hairless baby, closed eyes, oversized ears forming", adult: "small round body, large round ears, long thin tail, whiskers, tiny paws", notes: "SMALL size, large round ears, long thin tail, whiskers, constantly twitching nose", prohibited: "wings, large size, short tail, no whiskers", body: "quadruped-tiny", ref: "house mouse" },
  "Chinchilla": { cat: "mammal", baby: "tiny fluffy ball, oversized round ears, dense soft fur", adult: "extremely fluffy dense fur, large round ears, bushy tail, round body", notes: "DENSEST fur of any land animal, large round ears, bushy tail, dust baths", prohibited: "wings, thin fur, small ears, long legs", body: "quadruped-fluffy", ref: "chinchilla" },
  "Raccoon": { cat: "mammal", baby: "tiny masked baby, ringed tail, nimble paw fingers forming", adult: "grey fur with black mask, ringed bushy tail, dexterous hand-like paws", notes: "Distinctive black mask, ringed tail, human-like hand dexterity, nocturnal", prohibited: "wings, no mask, no ringed tail, non-dexterous paws", ref: "raccoon" },
  "Bat": { cat: "mammal", baby: "tiny bat pup, wing membranes developing, large ears, clinging", adult: "wing membranes between elongated fingers, large ears, nocturnal, echolocation", notes: "ONLY flying mammal, wings are skin between fingers, large ears for echolocation", prohibited: "feathered wings, small ears, bird features", wings: true, body: "flying-mammal", ref: "fruit bat" },
  "Deer": { cat: "mammal", baby: "spotted fawn, long wobbly legs, large eyes, oversized ears", adult: "graceful body, long legs, antlers (males), large eyes, twitching ears", notes: "Spotted fawns, males grow ANTLERS (not horns), graceful and alert, cloven hooves", prohibited: "wings, horns, short legs, predator features", ref: "white-tailed deer" }
};

// Function to expand compact data into full CreatureAnatomy
function getCreatureAnatomy(spiritAnimal: string): CreatureAnatomy {
  const data = CREATURE_DATA[spiritAnimal];
  if (!data) return getDefaultAnatomy(spiritAnimal);
  
  const categoryDefaults = CATEGORY_DEFAULTS[data.cat] || CATEGORY_DEFAULTS["mythical"];
  
  return {
    category: data.cat,
    limbCount: data.limbs ?? categoryDefaults.limbCount,
    hasWings: data.wings ?? categoryDefaults.hasWings,
    hasTail: data.tail ?? categoryDefaults.hasTail,
    bodyType: data.body ?? categoryDefaults.bodyType,
    babyFeatures: data.baby,
    adultFeatures: data.adult,
    anatomyNotes: data.notes,
    prohibitedFeatures: data.prohibited || categoryDefaults.prohibitedBase.join(", "),
    realWorldRef: data.ref || spiritAnimal
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
    prohibitedFeatures: "extra limbs, multiple heads, wings (unless naturally has them)",
    realWorldRef: spiritAnimal
  };
}

// ============================================================================
// SIMPLIFIED AGING PARAMETERS - Numeric values with description generator
// ============================================================================

interface AgingValues {
  eyes: number; body: number; fur: number; limbs: number; mobility: number;
  size: string; muscle: number; wings: number; element: number; cosmic: number;
}

const AGING_DATA: Record<number, AgingValues> = {
  2:  { eyes: 5,   body: 95, fur: 20,  limbs: 10, mobility: 0,   size: "8%",   muscle: 0,  wings: 0,   element: 0,  cosmic: 0 },
  3:  { eyes: 100, body: 92, fur: 70,  limbs: 15, mobility: 5,   size: "10%",  muscle: 0,  wings: 5,   element: 0,  cosmic: 0 },
  4:  { eyes: 100, body: 88, fur: 90,  limbs: 20, mobility: 15,  size: "12%",  muscle: 0,  wings: 10,  element: 0,  cosmic: 0 },
  5:  { eyes: 100, body: 82, fur: 100, limbs: 30, mobility: 30,  size: "18%",  muscle: 5,  wings: 20,  element: 5,  cosmic: 0 },
  6:  { eyes: 100, body: 75, fur: 100, limbs: 40, mobility: 50,  size: "22%",  muscle: 8,  wings: 30,  element: 8,  cosmic: 0 },
  7:  { eyes: 100, body: 68, fur: 100, limbs: 50, mobility: 65,  size: "28%",  muscle: 12, wings: 40,  element: 12, cosmic: 0 },
  8:  { eyes: 100, body: 55, fur: 100, limbs: 65, mobility: 80,  size: "38%",  muscle: 25, wings: 50,  element: 20, cosmic: 0 },
  9:  { eyes: 100, body: 45, fur: 100, limbs: 75, mobility: 90,  size: "48%",  muscle: 40, wings: 60,  element: 30, cosmic: 0 },
  10: { eyes: 100, body: 35, fur: 100, limbs: 85, mobility: 100, size: "60%",  muscle: 55, wings: 75,  element: 45, cosmic: 0 },
  11: { eyes: 100, body: 25, fur: 100, limbs: 95, mobility: 100, size: "80%",  muscle: 70, wings: 90,  element: 60, cosmic: 5 },
  12: { eyes: 100, body: 20, fur: 100, limbs: 100, mobility: 100, size: "100%", muscle: 80, wings: 100, element: 75, cosmic: 10 },
  13: { eyes: 100, body: 18, fur: 100, limbs: 100, mobility: 100, size: "115%", muscle: 85, wings: 110, element: 85, cosmic: 25 },
  14: { eyes: 100, body: 15, fur: 100, limbs: 100, mobility: 100, size: "140%", muscle: 90, wings: 125, element: 95, cosmic: 40 },
  15: { eyes: 100, body: 12, fur: 100, limbs: 100, mobility: 100, size: "TITAN", muscle: 95, wings: 150, element: 100, cosmic: 55 },
  16: { eyes: 100, body: 10, fur: 100, limbs: 100, mobility: 100, size: "CELESTIAL", muscle: 98, wings: 175, element: 100, cosmic: 70 },
  17: { eyes: 100, body: 8,  fur: 100, limbs: 100, mobility: 100, size: "DIVINE", muscle: 100, wings: 200, element: 100, cosmic: 85 },
  18: { eyes: 100, body: 5,  fur: 100, limbs: 100, mobility: 100, size: "STELLAR", muscle: 100, wings: 999, element: 100, cosmic: 92 },
  19: { eyes: 100, body: 2,  fur: 100, limbs: 100, mobility: 100, size: "GALACTIC", muscle: 100, wings: 999, element: 100, cosmic: 98 },
  20: { eyes: 100, body: 0,  fur: 100, limbs: 100, mobility: 100, size: "ORIGIN", muscle: 100, wings: 999, element: 100, cosmic: 100 }
};

function describeAgingParam(key: string, value: number): string {
  const descriptions: Record<string, (v: number) => string> = {
    eyes: v => v < 50 ? `${v}% - barely open, squinting` : "100% - fully open, curious",
    body: v => v > 80 ? `${v}% spherical baby fat` : v > 50 ? `${v}% - round but elongating` : v > 20 ? `${v}% - approaching adult proportions` : `${v}% - lean adult form`,
    fur: v => v < 50 ? `${v}% dry - still damp from egg` : "100% - fully developed coat",
    limbs: v => v < 30 ? `${v}% - tiny nubs pressed to body` : v < 60 ? `${v}% - short but visible` : v < 90 ? `${v}% - near adult proportions` : "100% - fully developed",
    mobility: v => v < 10 ? `${v}% - cannot move, curled` : v < 30 ? `${v}% - can lift head` : v < 60 ? `${v}% - wobbly walking` : "100% - full mobility",
    muscle: v => v === 0 ? "0% - pure baby fat" : v < 30 ? `${v}% - hint of definition` : v < 70 ? `${v}% - athletic build emerging` : `${v}% - peak condition`,
    wings: v => v === 0 ? "0% - invisible nubs" : v < 30 ? `${v}% - small buds` : v < 70 ? `${v}% - can glide` : v < 100 ? `${v}% - proficient flight` : v > 100 ? "MYTHIC - enhanced wings" : "100% - full wingspan",
    element: v => v === 0 ? "0% - no effects" : v < 30 ? `${v}% - subtle hints` : v < 70 ? `${v}% - visible aura` : v < 100 ? `${v}% - commanding presence` : "100% - IS the element",
    cosmic: v => v === 0 ? "0%" : v < 30 ? `${v}% - first hints of power` : v < 60 ? `${v}% - reality bending` : v < 90 ? `${v}% - divine power` : "100% - THE ORIGIN"
  };
  return descriptions[key]?.(value) || `${value}%`;
}

// ============================================================================
// STAGE TEMPLATES - Category-based prompt generation
// ============================================================================

type StageCategory = "egg" | "baby" | "adolescent" | "adult" | "mythic" | "cosmic";

function getStageCategory(stage: number): StageCategory {
  if (stage <= 1) return "egg";
  if (stage <= 7) return "baby";
  if (stage <= 10) return "adolescent";
  if (stage <= 12) return "adult";
  if (stage <= 17) return "mythic";
  return "cosmic";
}

const STAGE_NAMES: Record<number, string> = {
  0: "Dormant Egg", 1: "Cracking Awakening", 2: "Hatchling", 3: "Nestling", 4: "Fledgling",
  5: "Cub", 6: "Pup", 7: "Kit", 8: "Juvenile", 9: "Yearling", 10: "Young Adult",
  11: "Prime Form", 12: "Full Adult", 13: "Enhanced Form", 14: "Mythic Form",
  15: "Titan Form", 16: "Celestial Form", 17: "Divine Form", 18: "Universal Form",
  19: "Primordial Form", 20: "Origin Form"
};

function generateStagePrompt(stage: number, spirit: string, element: string, color: string): string {
  const category = getStageCategory(stage);
  const name = STAGE_NAMES[stage] || `Stage ${stage}`;
  const agingData = AGING_DATA[stage];
  
  const templates: Record<StageCategory, () => string> = {
    egg: () => stage === 0 
      ? `A mystical egg floating in gentle ${element} energy.\n\nEGG APPEARANCE:\n- Smooth opalescent surface with subtle iridescent shimmer\n- ${color} undertones glowing softly throughout shell\n- Semi-translucent crystalline quality\n- Size of a large ostrich egg\n\nSILHOUETTE WITHIN:\n- Deep inside, a DARK SHADOWY SILHOUETTE of a powerful, mature ${spirit} is barely visible\n- Just a dark featureless shadow - mysterious and intriguing\n\nENVIRONMENT:\n- Floating in soft ${element} energy particles\n- Gentle magical glow surrounding the egg`
      : `The same mystical egg now with luminous cracks spreading across its surface.\n\nCRACKING EGG:\n- Same egg from Stage 0, but now with glowing cracks spreading\n- ${color} light emanating from fractures\n- ${element} energy leaking through the cracks\n- Shell beginning to fragment but not yet broken\n\nSILHOUETTE WITHIN:\n- Through the cracks, the shadowy silhouette of the ULTIMATE form of a ${spirit} is MORE visible\n- Still a dark, featureless shadow but now stirring slightly`,
    
    baby: () => `A TINY ${spirit} baby at ${name} stage.\n\n━━━ SIZE ━━━\n- ${agingData?.size || '15%'} of adult size - very small\n\n━━━ BABY APPEARANCE ━━━\n- Body: ${describeAgingParam('body', agingData?.body || 85)}\n- Eyes: ${describeAgingParam('eyes', agingData?.eyes || 100)}\n- Limbs: ${describeAgingParam('limbs', agingData?.limbs || 20)}\n- Mobility: ${describeAgingParam('mobility', agingData?.mobility || 10)}\n- Fur/Coat: ${describeAgingParam('fur', agingData?.fur || 80)}\n\n━━━ COLORS ━━━\n- ${color} in soft, muted, newborn tones\n\n━━━ EXPRESSION ━━━\n- Completely helpless, vulnerable, precious, pure innocence\n\nREAL-WORLD COMPARISON: A young puppy/kitten - clearly a baby.`,
    
    adolescent: () => `A young adolescent ${spirit} in ${name} stage.\n\n━━━ SIZE ━━━\n- ${agingData?.size || '50%'} of adult size\n\n━━━ ADOLESCENT FEATURES ━━━\n- Body: ${describeAgingParam('body', agingData?.body || 45)}\n- Limbs: ${describeAgingParam('limbs', agingData?.limbs || 75)}\n- Muscle: ${describeAgingParam('muscle', agingData?.muscle || 40)}\n- Wings: ${describeAgingParam('wings', agingData?.wings || 60)}\n- Elemental: ${describeAgingParam('element', agingData?.element || 30)}\n\n━━━ COLORS ━━━\n- ${color} fully vibrant now\n- Adult color pattern established\n\nEXPRESSION: Growing confidence, eager, adventurous.`,
    
    adult: () => `A fully mature ${spirit} at ${name} stage.\n\n━━━ SIZE ━━━\n- ${agingData?.size || '100%'} adult size\n\n━━━ ADULT FEATURES ━━━\n- Perfect species anatomy at full adult scale\n- Muscle: ${describeAgingParam('muscle', agingData?.muscle || 80)}\n- Wings: ${describeAgingParam('wings', agingData?.wings || 100)}\n- Elemental: ${describeAgingParam('element', agingData?.element || 75)}\n\n━━━ ELEMENTAL POWER ━━━\n- ${element} energy clearly manifests\n- Environmental effects visible\n\n━━━ COLORS ━━━\n- ${color} at peak beauty\n- Magical luminescence beginning\n\nEXPRESSION: Wise, powerful, magnificent.`,
    
    mythic: () => `A ${spirit} of legendary proportions at ${name} stage.\n\n━━━ SIZE ━━━\n- ${agingData?.size || 'MASSIVE'} - beyond normal limits\n\n━━━ MYTHIC FEATURES ━━━\n- Species anatomy preserved at mythic scale\n- Elemental: ${describeAgingParam('element', agingData?.element || 95)}\n- Cosmic: ${describeAgingParam('cosmic', agingData?.cosmic || 40)}\n- ${element} effects creating environmental phenomena\n- Possible additional mythic features (divine horns, energy aura)\n\n━━━ COLORS ━━━\n- ${color} with divine luminescence\n- Patterns pulse with power\n\nEXPRESSION: Ancient wisdom, barely contained power.`,
    
    cosmic: () => `The ULTIMATE ${spirit} at ${name} stage - ${stage === 20 ? 'THE ORIGIN, the primordial template from which all others descend' : 'a being of universal power'}.\n\n━━━ SCALE ━━━\n- ${agingData?.size || 'COSMIC'} - universal scale\n\n━━━ COSMIC FEATURES ━━━\n- Species essence visible through divine cosmic form\n- Perfect ${spirit} anatomy visible through divine form\n- Galaxies flow around and through form\n- ${element} as primordial force of creation\n- Reality, time, and space bow to will\n- Cosmic: ${describeAgingParam('cosmic', agingData?.cosmic || 100)}\n\n━━━ COLORS ━━━\n- ${color} as the color of reality itself\n- Nebulae and galaxies visible in form\n\n${stage === 20 ? 'THIS IS PERFECTION INCARNATE: The Original, The First, The Eternal.' : 'EXPRESSION: Beyond mortal comprehension, ancient cosmic awareness.'}`
  };
  
  return templates[category]();
}

// ============================================================================
// STORY TONE MODIFIERS
// ============================================================================

const STORY_TONES: Record<string, { lighting: string; atmosphere: string; palette: string; expression: string }> = {
  "whimsical": { lighting: "soft golden sunlight with sparkles", atmosphere: "magical fairy-tale, wonder", palette: "warm pastels with rainbow accents", expression: "curious, delighted, wonder" },
  "epic": { lighting: "dramatic rim light, volumetric rays", atmosphere: "heroic, momentous", palette: "rich saturated colors with metallic highlights", expression: "determined, noble, fierce" },
  "cozy": { lighting: "warm firelight, soft ambient glow", atmosphere: "safe, nurturing, comforting", palette: "warm earth tones, autumnal colors", expression: "content, peaceful, sleepy" },
  "mysterious": { lighting: "moonlight with misty atmosphere", atmosphere: "enigmatic, secretive, magical", palette: "deep blues, purples, silver accents", expression: "knowing, secretive, wise" },
  "triumphant": { lighting: "golden hour with lens flares", atmosphere: "victorious, celebratory", palette: "gold, white, vibrant accent colors", expression: "proud, joyful, accomplished" },
  "melancholic": { lighting: "soft diffused overcast", atmosphere: "reflective, bittersweet", palette: "muted tones, gentle grays with color accents", expression: "thoughtful, gentle sadness" },
  "playful": { lighting: "bright and cheerful daylight", atmosphere: "fun, energetic, silly", palette: "bright primary colors, candy hues", expression: "mischievous, happy, laughing" }
};

// Map UI story tone values to internal values
function normalizeStoryTone(tone?: string): string | undefined {
  if (!tone) return undefined;
  
  const mapping: Record<string, string> = {
    // UI values -> edge function values
    'soft_gentle': 'cozy',
    'epic_adventure': 'epic',
    'emotional_heartfelt': 'melancholic',
    'dark_intense': 'mysterious',
    'whimsical_playful': 'whimsical',
    // Direct matches (if already normalized)
    'whimsical': 'whimsical',
    'epic': 'epic',
    'cozy': 'cozy',
    'mysterious': 'mysterious',
    'triumphant': 'triumphant',
    'melancholic': 'melancholic',
    'playful': 'playful',
  };
  
  return mapping[tone.toLowerCase()] || tone;
}

function getStoryToneModifiers(tone?: string): string {
  if (!tone || !STORY_TONES[tone]) return "";
  const t = STORY_TONES[tone];
  return `\n━━━ STORY TONE: ${tone.toUpperCase()} ━━━\nLighting: ${t.lighting}\nAtmosphere: ${t.atmosphere}\nColor Enhancement: ${t.palette}\nExpression: ${t.expression}`;
}

// ============================================================================
// ELEMENT OVERLAY
// ============================================================================

const ELEMENT_EFFECTS: Record<string, string> = {
  "Fire": "Warm glow, ember particles, heat shimmer, small flames licking around paws/form",
  "Water": "Water droplets, misty aura, ripple effects, subtle blue luminescence",
  "Earth": "Tiny floating rocks, moss/crystal accents, earthy particles, grounded energy",
  "Air": "Swirling wind currents, floating feathers/leaves, light airy particles",
  "Lightning": "Electric sparks, crackling energy, static-charged fur/feathers",
  "Ice": "Frost crystals, cold mist, snowflakes, icy blue shimmer",
  "Nature": "Growing vines, flower petals, green leaf particles, life energy",
  "Shadow": "Dark wispy tendrils, mysterious darkness, purple/black energy",
  "Light": "Golden radiance, light beams, glowing aura, holy shine",
  "Cosmic": "Stars and nebulae, space energy, galaxy patterns, universal glow"
};

function getElementOverlay(element: string): string {
  const effect = ELEMENT_EFFECTS[element] || `${element} energy particles and magical glow`;
  return `\n━━━ ELEMENTAL OVERLAY: ${element.toUpperCase()} ━━━\nEffect: ${effect}\nNOTE: Element adds ambient effects AROUND creature, does NOT change body/fur color!`;
}

const DEFAULT_INTERNAL_RETRIES = 2;
const STAGE_ZERO_INTERNAL_RETRIES = 1;
const MAX_ALLOWED_RETRIES = 3;
const GENERATION_FETCH_TIMEOUT_MS = 75_000;
const AUXILIARY_FETCH_TIMEOUT_MS = 25_000;

type CompanionImageFlowType = "onboarding" | "regenerate" | "evolution" | "background" | "admin";

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
function ensureValidHex(color: string | undefined | null, fallback: string): string {
  if (!color) return fallback;
  const hexPattern = /^#[0-9A-Fa-f]{6}$/;
  const cleanColor = color.trim();
  if (hexPattern.test(cleanColor)) return cleanColor;
  // Try adding # if missing
  if (/^[0-9A-Fa-f]{6}$/.test(cleanColor)) return `#${cleanColor}`;
  return fallback;
}

function createTimedRequestError(code: TimeoutCode, timeoutMs: number): TimedRequestError {
  const err = new Error(`Request timed out after ${timeoutMs}ms`) as TimedRequestError;
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
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
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
  return "background";
}

function generateCharacterDNA(spiritAnimal: string, element: string, favoriteColor: string, eyeColor: string | undefined, furColor: string | undefined, stage: number): string {
  const anatomy = getCreatureAnatomy(spiritAnimal);
  const isBabyStage = stage >= 2 && stage <= 7;

  return `
╔══════════════════════════════════════════════════════════════════════════════╗
║                    CHARACTER DNA - IMMUTABLE IDENTITY                        ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ SPECIES: ${spiritAnimal.toUpperCase().padEnd(65)}║
║ Body Type: ${anatomy.bodyType.padEnd(63)}║
╠══════════════════════════════════════════════════════════════════════════════╣
║ Limb Count: EXACTLY ${anatomy.limbCount} limbs | Wings: ${anatomy.hasWings ? 'YES' : 'NO'} | Tail: ${anatomy.hasTail ? 'YES' : 'NO'}${' '.repeat(28)}║
╠══════════════════════════════════════════════════════════════════════════════╣
║ Primary Color: ${favoriteColor.padEnd(59)}║
║ Eye Color: ${(eyeColor || favoriteColor).padEnd(63)}║
║ Fur/Scale Color: ${(furColor || favoriteColor).padEnd(56)}║
║ Element: ${element} (ambient effects ONLY, NOT body color)${' '.repeat(Math.max(0, 32 - element.length))}║
╠══════════════════════════════════════════════════════════════════════════════╣
║ ${isBabyStage ? 'BABY' : 'ADULT'} FEATURES: ${(isBabyStage ? anatomy.babyFeatures : anatomy.adultFeatures).substring(0, 60).padEnd(60)}║
║ REAL-WORLD REF: ${anatomy.realWorldRef.substring(0, 58).padEnd(58)}║
║ PROHIBITED: ${anatomy.prohibitedFeatures.substring(0, 62).padEnd(62)}║
╚══════════════════════════════════════════════════════════════════════════════╝`;
}

function getNegativePrompts(stage: number, spiritAnimal: string): string {
  const anatomy = getCreatureAnatomy(spiritAnimal);
  const base = ["different color than specified", "wrong species features", "hybrid creature", "human features", "wrong number of limbs"];
  
  const stageNegatives = stage >= 2 && stage <= 7 
    ? ["muscular build", "adult proportions", "fierce expression", "large size", "fully developed wings"]
    : stage >= 8 && stage <= 12 
    ? ["baby proportions", "cosmic/divine features", "reality-warping effects"]
    : [];
  
  const creatureNegatives = [
    ...(!anatomy.hasWings ? ["wings of any kind"] : []),
    ...(!anatomy.hasTail ? ["tail of any kind"] : []),
    ...(anatomy.limbCount === 0 ? ["legs", "arms"] : [])
  ];

  return `\n━━━ DO NOT INCLUDE ━━━\n${[...base, ...stageNegatives, ...creatureNegatives].map(n => `✗ ${n}`).join('\n')}\n✗ ${anatomy.prohibitedFeatures}`;
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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return timedResponse(
        new Response(JSON.stringify({ error: "No authorization header", code: "NO_AUTH_HEADER" }), 
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }),
        "auth_missing_header",
      );
    }

    const authStartedAt = Date.now();
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    authDurationMs = Date.now() - authStartedAt;
    console.log(`[CompanionImageTiming] auth_ms=${authDurationMs}`);
    if (authError || !user) {
      return timedResponse(
        new Response(JSON.stringify({ error: "Invalid authentication", code: "INVALID_AUTH" }), 
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }),
        "auth_invalid",
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
      maxInternalRetries,
      storyTone,
      previousStageImageUrl,
      companionId,
      flowType,
      debug = false,
      image_size,
    } = await req.json();

    console.log(`Request - Animal: ${spiritAnimal}, Element: ${element}, Stage: ${stage}, Color: ${favoriteColor}`);

    if (!spiritAnimal) throw new Error("spiritAnimal is required");
    if (!element) throw new Error("element is required");
    if (stage === undefined || stage === null) throw new Error("stage is required");
    if (!favoriteColor) throw new Error("favoriteColor is required");

    const anatomy = getCreatureAnatomy(spiritAnimal);
    const stageName = STAGE_NAMES[stage as number];
    if (!stageName) throw new Error(`Invalid stage: ${stage}`);
    const normalizedFlowType = normalizeFlowType(flowType);
    const fastPathEligible = isCompanionFastPathEligible(user.id);
    const imageSize = resolveCompanionImageSizeForUser(user.id, image_size);
    const fastRetryLimits = getCompanionFastRetryLimits();
    console.log(
      `[CompanionImagePolicy] user=${user.id} flow=${normalizedFlowType} fast_path=${fastPathEligible} image_size=${imageSize} stage0_fast_retries=${fastRetryLimits.stage0} non_stage0_fast_retries=${fastRetryLimits.nonStage0}`,
    );

    // ========================================================================
    // VISUAL METADATA EXTRACTION FOR CONSISTENCY (Stages 2-14)
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

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY not configured");
      return timedResponse(
        new Response(JSON.stringify({ error: "AI service not configured.", code: "AI_SERVICE_NOT_CONFIGURED" }), 
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }),
        "ai_key_missing",
      );
    }

    if (stage >= 2 && stage <= 14) {
      if (previousStageImageUrl) {
        previousImageUrl = previousStageImageUrl;
        console.log(`Will extract metadata from provided previous stage image (stage ${stage})`);
      } else if (companionId) {
        const { data: prevEvolution } = await supabase
          .from('companion_evolutions')
          .select('image_url')
          .eq('companion_id', companionId)
          .eq('stage', stage - 1)
          .single();

        if (prevEvolution?.image_url) {
          previousImageUrl = prevEvolution.image_url;
          console.log(`Fetched previous stage ${stage - 1} image for metadata extraction`);
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
              description: "Extract detailed visual characteristics from a creature image for consistency in evolution chain",
              parameters: {
                type: "object",
                properties: {
                  hexPrimaryColor: { type: "string", description: "Exact hex code of the primary body/fur color (e.g., #FF6B35)" },
                  hexEyeColor: { type: "string", description: "Exact hex code of the eye color (e.g., #FFD700)" },
                  hexAccentColor: { type: "string", description: "Exact hex code of any accent/secondary color (e.g., #FFFFFF)" },
                  primaryColorDesc: { type: "string", description: "Description of primary color (e.g., warm orange-red)" },
                  eyeColorDesc: { type: "string", description: "Description of eye color (e.g., golden amber)" },
                  markings: { type: "string", description: "Description of patterns, spots, stripes, or unique markings" },
                  viewingAngle: { type: "string", enum: ["front", "side", "3/4 view", "rear 3/4"], description: "Camera angle viewing the creature" },
                  pose: { type: "string", enum: ["sitting", "standing", "lying down", "action/dynamic", "curled up"], description: "Body pose of the creature" },
                  expression: { type: "string", enum: ["happy", "curious", "fierce", "serene", "playful", "alert"], description: "Facial expression" },
                  lightingDirection: { type: "string", enum: ["from above", "from side", "from below", "ambient/soft", "dramatic"], description: "Main light source direction" },
                  artStyle: { type: "string", description: "Rendering style description (e.g., painterly digital art, soft cel shading)" },
                  distinctiveFeatures: { type: "string", description: "Unique physical features that identify this specific creature" },
                  overallDescription: { type: "string", description: "Detailed paragraph describing exactly how this creature looks" }
                },
                required: ["hexPrimaryColor", "hexEyeColor", "primaryColorDesc", "eyeColorDesc", "markings", "viewingAngle", "pose", "expression", "lightingDirection", "artStyle", "distinctiveFeatures", "overallDescription"],
                additionalProperties: false
              }
            }
          };

          const analysisResponse = await fetchWithTimeout(
            "https://api.openai.com/v1/chat/completions",
            {
              method: "POST",
              headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [{
                  role: "user",
                  content: [
                    { type: "text", text: `Analyze this ${spiritAnimal} creature image and extract its visual characteristics for consistent evolution. Be precise with hex colors and descriptive with features.` },
                    { type: "image_url", image_url: { url: previousImageUrl } }
                  ]
                }],
                tools: [extractionTool],
                tool_choice: { type: "function", function: { name: "extract_visual_metadata" } }
              }),
            },
            AUXILIARY_FETCH_TIMEOUT_MS,
            "AI_TIMEOUT",
          );

          if (analysisResponse.ok) {
            const analysisData = await analysisResponse.json();
            const toolCall = analysisData.choices?.[0]?.message?.tool_calls?.[0];
            
            if (toolCall?.function?.arguments) {
              try {
                extractedMetadata = JSON.parse(toolCall.function.arguments);
                console.log("Successfully extracted visual metadata via tool calling:", extractedMetadata);
              } catch (parseError) {
                console.warn("Failed to parse tool call arguments:", parseError);
              }
            }
            
            // Fallback to content parsing if tool calling didn't return expected format
            if (!extractedMetadata) {
              const content = analysisData.choices?.[0]?.message?.content || "";
              if (content) {
                try {
                  let cleanedText = content.trim();
                  if (cleanedText.startsWith("```json")) cleanedText = cleanedText.slice(7);
                  else if (cleanedText.startsWith("```")) cleanedText = cleanedText.slice(3);
                  if (cleanedText.endsWith("```")) cleanedText = cleanedText.slice(0, -3);
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
                hexEyeColor: ensureValidHex(eyeColor || favoriteColor, "#FFD700"),
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
                overallDescription: `A ${spiritAnimal} creature with ${favoriteColor} coloring`
              };
            }
            
            // Sanitize extracted hex colors
            if (extractedMetadata) {
              extractedMetadata.hexPrimaryColor = ensureValidHex(extractedMetadata.hexPrimaryColor, favoriteColor);
              extractedMetadata.hexEyeColor = ensureValidHex(extractedMetadata.hexEyeColor, eyeColor || favoriteColor);
              if (extractedMetadata.hexAccentColor) {
                extractedMetadata.hexAccentColor = ensureValidHex(extractedMetadata.hexAccentColor, "#FFFFFF");
              }
            }
          } else {
            console.warn("Metadata extraction API call failed, proceeding without reference");
          }
        } catch (metadataError) {
          if (isTimedRequestError(metadataError)) {
            console.warn("Metadata extraction timed out, proceeding without reference");
          } else {
            console.warn("Error extracting metadata:", metadataError);
          }
        }
      }
    }
    
    const currentAging = AGING_DATA[stage as number];
    const previousAging = stage > 2 ? AGING_DATA[(stage - 1) as number] : null;

    // ========================================================================
    // BUILD THE PROMPT
    // ========================================================================

    const promptBuildStartedAt = Date.now();
    const characterDNA = generateCharacterDNA(spiritAnimal, element, favoriteColor, eyeColor, furColor, stage);
    const negativePrompts = getNegativePrompts(stage, spiritAnimal);
    const storyToneStyle = getStoryToneModifiers(normalizeStoryTone(storyTone));
    const elementOverlay = getElementOverlay(element);
    const stagePrompt = generateStagePrompt(stage, spiritAnimal, element, favoriteColor);

    const retryEnforcement = retryAttempt > 0 ? `\n━━━ RETRY (Attempt ${retryAttempt}) ━━━\nCRITICAL - Previous had errors:\n- EXACTLY ${anatomy.limbCount} limbs\n- ${anatomy.hasWings ? 'Include wings' : 'NO WINGS'}\n- SINGLE HEAD ONLY\n- Reference: ${anatomy.realWorldRef}` : '';

    let fullPrompt: string;

    if (stage === 0 || stage === 1) {
      // Egg stages
      fullPrompt = `STYLIZED FANTASY ART - Digital painting:\n\n${stagePrompt}\n\n${characterDNA}\n${storyToneStyle}\n${elementOverlay}\n\nRENDERING: Stylized digital fantasy art, painterly, rich colors, magical atmosphere, slightly brighter exposure with lifted midtones and readable highlights, with a very subtle creature-collecting game illustration charm (not chibi).`;

    } else if (extractedMetadata && stage >= 2 && stage <= 14) {
      // Text-to-image with extracted visual metadata from previous stage
      const categoryRules = stage <= 7 
        ? "━━━ BABY STAGE RULES ━━━\n- Keep BABY/INFANT appearance\n- NO muscle, round soft adorable\n- Proportions should be youthful"
        : stage <= 12 
        ? "━━━ ADOLESCENT/ADULT RULES ━━━\n- Creature maturing physically\n- Growing athletic and capable\n- More defined features"
        : "━━━ MYTHIC RULES ━━━\n- Transcending normal limits\n- Subtle magical enhancements\n- Elemental power visible";

      fullPrompt = `STYLIZED FANTASY CREATURE - Text-to-image with Visual Reference
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generate a Stage ${stage} (${stageName}) ${spiritAnimal} that MATCHES this visual reference:

━━━ EXACT COLOR PALETTE (MANDATORY) ━━━
┌─────────────────────────────────────────────┐
│ PRIMARY: ${extractedMetadata.hexPrimaryColor} (${extractedMetadata.primaryColorDesc})
│ EYES:    ${extractedMetadata.hexEyeColor} (${extractedMetadata.eyeColorDesc})
│ ACCENT:  ${extractedMetadata.hexAccentColor || '#FFFFFF'}
└─────────────────────────────────────────────┘
⚠️ USE THESE EXACT HEX COLORS - DO NOT DEVIATE

━━━ MARKINGS & PATTERNS ━━━
${extractedMetadata.markings}

━━━ POSE & COMPOSITION (MATCH PREVIOUS) ━━━
• Viewing Angle: ${extractedMetadata.viewingAngle} (KEEP SAME)
• Pose: ${extractedMetadata.pose} (KEEP SAME)
• Expression: ${extractedMetadata.expression} (MAINTAIN)
• Lighting: ${extractedMetadata.lightingDirection}

━━━ ART STYLE TO MAINTAIN ━━━
${extractedMetadata.artStyle}

━━━ DISTINCTIVE FEATURES TO PRESERVE ━━━
${extractedMetadata.distinctiveFeatures}

━━━ REFERENCE DESCRIPTION ━━━
${extractedMetadata.overallDescription}

${categoryRules}

${characterDNA}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EVOLUTION STAGE ${stage}: ${stageName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${stagePrompt}

${storyToneStyle}
${elementOverlay}
${retryEnforcement}
${negativePrompts}

━━━ SELF-VERIFICATION CHECKLIST ━━━
□ PRIMARY COLOR is ${extractedMetadata.hexPrimaryColor} - verified
□ EYE COLOR is ${extractedMetadata.hexEyeColor} - verified
□ POSE matches: ${extractedMetadata.pose} - verified
□ VIEWING ANGLE matches: ${extractedMetadata.viewingAngle} - verified
□ EXPRESSION matches: ${extractedMetadata.expression} - verified
□ Limb count is EXACTLY ${anatomy.limbCount} - verified
□ ${anatomy.hasWings ? 'Wings present' : 'NO wings'} - correct
□ Recognizable as the SAME creature, just evolved
□ Art style matches reference

━━━ RENDERING STYLE ━━━
Stylized digital fantasy art, appealing and charming, expressive features.
MUST use the exact color palette specified above.
Match the art style: ${extractedMetadata.artStyle}
Painterly digital art with rich saturated colors, soft but defined edges.
Slightly lifted midtones and clean highlights; avoid muddy shadows with a very subtle creature-game readability touch (Neopets/P&D-adjacent, not chibi).`;

    } else {
      // Text-to-image (egg stages, cosmic stages 15-20, or when no previous image/metadata)
      fullPrompt = `STYLIZED FANTASY CREATURE - Digital painting, game art quality

${characterDNA}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EVOLUTION STAGE ${stage}: ${stageName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${stagePrompt}

${storyToneStyle}
${elementOverlay}
${retryEnforcement}
${negativePrompts}

━━━ SELF-VERIFICATION CHECKLIST ━━━
□ Body color is ${favoriteColor} - correct
□ Limb count is EXACTLY ${anatomy.limbCount} - verified
□ ${anatomy.hasWings ? 'Wings present' : 'NO wings'} - correct
□ Looks like a real ${anatomy.realWorldRef}

━━━ RENDERING STYLE ━━━
Stylized digital fantasy art, appealing and charming, expressive features.
NOT photorealistic; avoid extreme/chibi cartoon exaggeration.
Painterly digital art with rich saturated colors, soft but defined edges.
Slightly brighter exposure with lifted midtones and clearer highlights for readability.`;
    }
    promptBuildDurationMs = Date.now() - promptBuildStartedAt;
    console.log(`[CompanionImageTiming] prompt_build_ms=${promptBuildDurationMs}`);

    // ========================================================================
    // CALL AI FOR IMAGE GENERATION WITH AUTO-RETRY ON LOW QUALITY
    // ========================================================================

    const stageNumber = Number(stage);
    const adaptiveRetryDefault = fastPathEligible
      ? (stageNumber === 0 ? fastRetryLimits.stage0 : fastRetryLimits.nonStage0)
      : (stageNumber === 0 ? STAGE_ZERO_INTERNAL_RETRIES : DEFAULT_INTERNAL_RETRIES);
    const requestedRetries =
      typeof maxInternalRetries === "number" && Number.isFinite(maxInternalRetries)
        ? Math.max(0, Math.min(MAX_ALLOWED_RETRIES, Math.floor(maxInternalRetries)))
        : adaptiveRetryDefault;
    const MAX_INTERNAL_RETRIES = requestedRetries;
    let currentAttempt = 0;
    let imageUrl: string | null = null;
    let qualityScore: { 
      overall: number; 
      limbCount: number; 
      speciesFidelity: number; 
      colorMatch: number;
      issues: string[];
      shouldRetry: boolean;
    } | null = null;

    while (currentAttempt <= MAX_INTERNAL_RETRIES) {
      console.log(`Calling AI for T2I generation (stage ${stage}, attempt ${currentAttempt + 1}/${MAX_INTERNAL_RETRIES + 1}, ${extractedMetadata ? 'with metadata' : 'no metadata'})...`);

      const messageContent = currentAttempt > 0 
        ? `${fullPrompt}\n\n━━━ QUALITY RETRY #${currentAttempt} ━━━\nPrevious attempt had issues: ${qualityScore?.issues?.join(', ') || 'low quality'}\nPAY EXTRA ATTENTION to anatomical correctness. Ensure EXACTLY ${anatomy.limbCount} limbs.`
        : fullPrompt;

      let aiResponse;
      const generationAttemptStartedAt = Date.now();
      try {
        aiResponse = await fetchWithTimeout(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-image-preview",
              messages: [{ role: "user", content: messageContent }],
              modalities: ["image", "text"],
              image_size: imageSize,
            })
          },
          GENERATION_FETCH_TIMEOUT_MS,
          "GENERATION_TIMEOUT",
        );
        generationCallDurationMs += Date.now() - generationAttemptStartedAt;
      } catch (fetchError) {
        generationCallDurationMs += Date.now() - generationAttemptStartedAt;
        if (isTimedRequestError(fetchError)) {
          console.error("AI generation timed out:", fetchError);
          return timedResponse(
            new Response(JSON.stringify({ error: "AI generation timed out. Try again.", code: fetchError.code }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 504 }),
            "generation_timeout",
          );
        }
        console.error("Network error:", fetchError);
        return timedResponse(
          new Response(JSON.stringify({ error: "Network error. Try again.", code: "NETWORK_ERROR" }), 
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 503 }),
          "generation_network_error",
        );
      }
      console.log(`[CompanionImageTiming] generation_attempt_ms=${Date.now() - generationAttemptStartedAt} attempt=${currentAttempt + 1}`);

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("AI error:", errorText);

        if (aiResponse.status === 400) {
          const payload: Record<string, unknown> = {
            error: "AI request was rejected by provider.",
            code: "AI_BAD_REQUEST",
          };
          if (debug === true) {
            payload.providerError = errorText.slice(0, 1000);
            payload.imageSize = imageSize;
            payload.flowType = normalizedFlowType;
          }
          return timedResponse(
            new Response(JSON.stringify(payload), 
              { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 502 }),
            "generation_bad_request",
          );
        }

        if (aiResponse.status === 402) {
          return timedResponse(
            new Response(JSON.stringify({ error: "Insufficient AI credits.", code: "INSUFFICIENT_CREDITS" }), 
              { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 402 }),
            "generation_insufficient_credits",
          );
        }
        if (aiResponse.status === 429) {
          return timedResponse(
            new Response(JSON.stringify({ error: "AI service busy. Try again.", code: "RATE_LIMITED" }), 
              { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }),
            "generation_rate_limited",
          );
        }
        throw new Error(`AI request failed: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      imageUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

      if (!imageUrl) {
        console.error("No image URL in response:", JSON.stringify(aiData));
        throw new Error("No image URL in response");
      }

      console.log("Image generated, running quality analysis...");

      // ========================================================================
      // QUALITY SCORING - Analyze generated image for anatomical correctness
      // ========================================================================
      qualityScore = null;
      const qualityStartedAt = Date.now();

      try {
        const qualityTool = {
          type: "function",
          function: {
            name: "score_image_quality",
            description: "Score the quality and correctness of a generated creature image",
            parameters: {
              type: "object",
              properties: {
                limbCountScore: { type: "number", description: "Score 0-100: Does the creature have the correct number of limbs? 100 = correct, 0 = wrong count" },
                actualLimbCount: { type: "number", description: "How many limbs does the creature appear to have?" },
                speciesFidelityScore: { type: "number", description: "Score 0-100: How well does this look like the intended species?" },
                colorMatchScore: { type: "number", description: "Score 0-100: How well do the colors match the expected palette?" },
                anatomyIssues: { type: "array", items: { type: "string" }, description: "List any anatomical issues (extra limbs, wrong body parts, mutations)" },
                overallQuality: { type: "number", description: "Overall quality score 0-100 considering all factors" }
              },
              required: ["limbCountScore", "actualLimbCount", "speciesFidelityScore", "colorMatchScore", "anatomyIssues", "overallQuality"],
              additionalProperties: false
            }
          }
        };

        const qualityPrompt = `Analyze this ${spiritAnimal} creature image for quality and correctness.

Expected characteristics:
- Species: ${spiritAnimal}
- Expected limbs: ${anatomy.limbCount}
- Wings expected: ${anatomy.hasWings ? 'YES' : 'NO'}
- Body type: ${anatomy.bodyType}
- Primary color should be: ${favoriteColor}
${extractedMetadata ? `- Reference eye color: ${extractedMetadata.hexEyeColor}` : ''}

Score each aspect from 0-100 and list any issues.`;

        const qualityResponse = await fetchWithTimeout(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [{
                role: "user",
                content: [
                  { type: "text", text: qualityPrompt },
                  { type: "image_url", image_url: { url: imageUrl } }
                ]
              }],
              tools: [qualityTool],
              tool_choice: { type: "function", function: { name: "score_image_quality" } }
            })
          },
          AUXILIARY_FETCH_TIMEOUT_MS,
          "AI_TIMEOUT",
        );
        qualityCallDurationMs += Date.now() - qualityStartedAt;
        console.log(`[CompanionImageTiming] quality_attempt_ms=${Date.now() - qualityStartedAt} attempt=${currentAttempt + 1}`);

        if (qualityResponse.ok) {
          const qualityData = await qualityResponse.json();
          const toolCall = qualityData.choices?.[0]?.message?.tool_calls?.[0];
          
          if (toolCall?.function?.arguments) {
            const scores = JSON.parse(toolCall.function.arguments);
            qualityScore = {
              overall: scores.overallQuality || 0,
              limbCount: scores.limbCountScore || 0,
              speciesFidelity: scores.speciesFidelityScore || 0,
              colorMatch: scores.colorMatchScore || 0,
              issues: scores.anatomyIssues || [],
              shouldRetry: scores.overallQuality < 60 || scores.limbCountScore < 50
            };
            console.log("Quality analysis:", qualityScore);
          }
        }
      } catch (qualityError) {
        qualityCallDurationMs += Date.now() - qualityStartedAt;
        console.log(`[CompanionImageTiming] quality_attempt_ms=${Date.now() - qualityStartedAt} attempt=${currentAttempt + 1} status=error`);
        if (isTimedRequestError(qualityError)) {
          console.warn("Quality analysis timed out (non-blocking)");
        } else {
          console.warn("Quality analysis failed (non-blocking):", qualityError);
        }
      }

      // Check if we should retry
      if (qualityScore?.shouldRetry && currentAttempt < MAX_INTERNAL_RETRIES) {
        console.log(`Quality too low (overall: ${qualityScore.overall}, limbs: ${qualityScore.limbCount}), retrying... (${currentAttempt + 1}/${MAX_INTERNAL_RETRIES})`);
        currentAttempt++;
        continue;
      }

      // Quality acceptable or max retries reached
      if (qualityScore?.shouldRetry) {
        console.log(`Accepting image after ${currentAttempt + 1} attempts despite quality issues`);
      }
      break;
    }

    // ========================================================================
    // UPLOAD TO STORAGE
    // ========================================================================
    if (!imageUrl) {
      throw new Error("No image was generated after all attempts");
    }
    
    console.log("Uploading to storage...");
    const storageStartedAt = Date.now();

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
    storageUploadDurationMs = Date.now() - storageStartedAt;
    console.log(`[CompanionImageTiming] storage_ms=${storageUploadDurationMs}`);

    console.log(`Uploaded: ${publicUrl}`);

    // Return response with quality score
    const responseData: Record<string, unknown> = {
      imageUrl: publicUrl,
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
      new Response(JSON.stringify(responseData), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }),
      "success",
    );

  } catch (error) {
    if (isTimedRequestError(error)) {
      return timedResponse(
        new Response(
          JSON.stringify({ error: "AI request timed out. Please try again.", code: error.code }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 504 },
        ),
        "timed_request_error",
      );
    }
    console.error("Error:", error);
    return timedResponse(
      new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }),
      "unhandled_error",
    );
  }
});
