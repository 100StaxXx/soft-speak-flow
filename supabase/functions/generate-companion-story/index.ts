import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  checkRateLimit,
  createRateLimitResponse,
} from "../_shared/rateLimiter.ts";
import { OutputValidator } from "../_shared/outputValidator.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import {
  buildSpiritLockPromptBlock,
  buildSpiritLockRetryFeedback,
  evaluateSpiritLockTextCompliance,
  resolveCompanionSpiritLockProfile,
} from "../_shared/companionSpiritLock.ts";
import {
  buildGracewardFormationMemory,
  resolveGracewardCompanionStoryChapter,
} from "../_shared/gracewardCompanionStory.ts";
import {
  buildCompanionSpeciesIdentityPromptBlock,
  resolveCompanionSpeciesIdentity,
} from "../_shared/companionSpeciesIdentity.ts";
import { buildCompanionStoryFallback } from "../_shared/companionStoryFallback.ts";

// Helper function to convert hex colors to descriptive names
function getColorName(color: string): string {
  if (!color) return "vibrant";

  // If it's already a color name (no # or not 6 hex chars), return it
  if (
    !color.includes("#") && !/^[0-9A-Fa-f]{6}$/.test(color.replace("#", ""))
  ) {
    return color.toLowerCase();
  }

  // Remove # if present
  const hex = color.replace("#", "").toLowerCase();

  // If not a valid hex, return as-is
  if (!/^[0-9a-f]{6}$/.test(hex)) {
    return color.toLowerCase();
  }

  const colorMap: Record<string, string> = {
    "9333ea": "purple",
    "8b5cf6": "violet",
    "a855f7": "purple",
    "6366f1": "indigo",
    "3b82f6": "blue",
    "0ea5e9": "sky blue",
    "06b6d4": "cyan",
    "14b8a6": "teal",
    "10b981": "emerald",
    "22c55e": "green",
    "84cc16": "lime",
    "eab308": "yellow",
    "f59e0b": "amber",
    "f97316": "orange",
    "ef4444": "red",
    "ec4899": "pink",
    "f43f5e": "rose",
  };

  // Return mapped color or extract RGB to approximate
  if (colorMap[hex]) return colorMap[hex];

  // Parse RGB values to determine general color
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  if (r > g && r > b) return "red";
  if (g > r && g > b) return "green";
  if (b > r && b > g) return "blue";
  if (r > 200 && g > 200 && b > 200) return "white";
  if (r < 50 && g < 50 && b < 50) return "black";
  return "vibrant";
}

// Failsafe: Remove any hex color codes that slip through AI generation
function sanitizeHexCodes(text: string): string {
  if (!text) return text;

  // Match hex codes with or without # (e.g., #9333ea, 9333ea, #fff, abc123)
  const hexPattern = /#?[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b/g;

  return text.replace(hexPattern, (match) => {
    const colorName = getColorName(match);
    console.log(`Failsafe: Replaced hex "${match}" with "${colorName}"`);
    return colorName;
  });
}

// Species anatomical traits for accuracy - ALL 66 ANIMALS SUPPORTED
const SPECIES_TRAITS: Record<string, string> = {
  // Graceward biblical-symbolic companions
  "Lamb":
    "Natural four-legged lamb with dense white wool, broad gentle ears, a short sheep muzzle, cloven hooves, and soft attentive movements",
  "Stag":
    "Natural red stag with four long deer legs, cloven hooves, a long deer face, large alert ears, and age-appropriate symmetrical branching antlers",
  "Dove":
    "Natural compact white dove with two pink legs, two feathered wings, a small pale beak, round dark eyes, and a short fan tail",
  // Canines
  "Wolf":
    "Four-legged canine with powerful legs, flowing fur, pointed ears, and a long bushy tail",
  "Fox":
    "Four-legged canine with slender build, pointed ears, bushy tail, and agile movements",
  "Arctic Fox":
    "Four-legged canine with dense white fur, small rounded ears, fluffy tail, and compact body for cold climates",
  "Fennec Fox":
    "Four-legged canine with oversized ears, sandy coat, bushy tail, and delicate frame built for desert life",
  "Dog":
    "Four-legged canine with loyal eyes, wagging tail, varied coat, and expressive face",

  // Felines
  "Tiger":
    "Four-legged feline with muscular build, striped coat, retractable claws, and a long tail for balance",
  "Lion":
    "Four-legged feline with golden mane (males), muscular body, sharp claws, and commanding presence",
  "Panther":
    "Four-legged feline with sleek black coat, retractable claws, long tail, and silent movement",
  "Cat":
    "Four-legged feline with graceful movements, retractable claws, whiskers, and expressive tail",
  "Cheetah":
    "Four-legged feline with slender aerodynamic build, spotted coat, long tail, and non-retractable claws for speed",
  "Jaguar":
    "Four-legged feline with stocky muscular build, rosette-spotted coat, powerful jaws, and swimming ability",
  "Snow Leopard":
    "Four-legged feline with thick fur, long bushy tail, large paws, and smoky gray coat with dark rosettes",
  "Puma / Cougar":
    "Four-legged feline with tawny coat, powerful hind legs, long tail, and solitary hunting prowess",
  "Lynx":
    "Four-legged feline with tufted ears, short tail, powerful legs, and thick winter coat",

  // Bears & Large Mammals
  "Bear":
    "Four-legged ursine with massive frame, thick fur, powerful claws, and a short tail",
  "Gorilla":
    "Knuckle-walking primate with massive arms, powerful chest, expressive face, and intelligent eyes",
  "Elephant":
    "Four-legged pachyderm with massive body, long trunk, large ears, and ivory tusks",
  "Hippo":
    "Four-legged semi-aquatic herbivore with barrel-shaped body, massive jaws, thick skin, and webbed feet",
  "Rhino":
    "Four-legged herbivore with thick armored hide, one or two horns, stocky build, and massive weight",
  "Mammoth":
    "Four-legged prehistoric elephant with long curved tusks, thick shaggy fur, and massive size",

  // Equines
  "Unicorn":
    "Four-legged equine with single spiraling horn, flowing mane and tail, and graceful hooves",
  "Horse (Stallion)":
    "Four-legged equine with muscular build, flowing mane and tail, powerful legs, and noble bearing",
  "Pegasus":
    "Winged equine with four legs, feathered wings, flowing mane and tail, and hooves",
  "Reindeer":
    "Four-legged cervine with branching antlers, thick fur, wide hooves for snow, and endurance for migration",

  // Birds & Winged Creatures
  "Eagle":
    "Winged raptor with sharp talons, hooked beak, feathered wings, and keen forward-facing eyes",
  "Phoenix":
    "Mythic bird with fiery plumage, long tail feathers, powerful wings, and a crest of flame",
  "Owl":
    "Winged nocturnal bird with forward-facing eyes, silent flight feathers, sharp talons, and rotating head",
  "Falcon":
    "Winged raptor with streamlined body, sharp talons, hooked beak, and incredible speed",
  "Hawk":
    "Winged raptor with broad wings, sharp vision, hooked beak, and powerful talons",
  "Raven":
    "Winged corvid with black feathers, sharp beak, intelligent eyes, and grasping talons",
  "Parrot":
    "Winged bird with vibrant plumage, curved beak, zygodactyl feet, and vocal mimicry ability",
  "Penguin":
    "Flightless seabird with flipper-like wings, streamlined body, webbed feet, and tuxedo-like coloring",
  "Hummingbird":
    "Tiny winged bird with iridescent feathers, long beak, rapid wing beats, and hovering flight",
  "Butterfly":
    "Winged insect with four colorful wings, slender body, antennae, and delicate flight",
  "Thunderbird":
    "Mythic winged bird with massive wingspan, storm-summoning power, lightning-wreathed feathers, and elemental presence",

  // Dragons & Mythical Reptiles
  "Dragon":
    "Winged reptilian with four legs, scales, horns, long tail, and wings emerging from shoulder blades",
  "Wyvern":
    "Winged reptilian with two legs, barbed tail, wings doubling as front limbs, and serpentine neck",
  "Mechanical Dragon":
    "Clockwork dragon with metallic scales, gear-driven wings, steam-powered breath, and articulated joints",
  "Basilisk":
    "Serpentine reptile with deadly gaze, crown-like crest, venomous fangs, and petrifying presence",

  // Hybrids & Chimeras
  "Griffin":
    "Hybrid with eagle head and wings, lion body and legs, sharp talons, and a long tail",
  "Gryphon":
    "Hybrid with eagle head and wings, lion body and legs, sharp talons, and a long tail",
  "Hippogriff":
    "Hybrid with eagle head and wings, horse body and legs, sharp talons on front limbs, and hooves on hind legs",
  "Sphinx":
    "Winged lion oracle with a regal feline face, feathered wings, poised posture, and riddle-speaking intelligence",
  "Cerberus":
    "Three-headed canine with muscular body, multiple snarling heads, serpent tail, and guardian instinct",
  "Hydra":
    "Multi-headed serpentine dragon with regenerating heads, venomous breath, long necks, and aquatic build",
  "Fenrir":
    "Massive wolf with apocalyptic size, chain-breaking strength, iron fangs, and prophesied destiny",

  // Marine Creatures
  "Dolphin":
    "Sleek marine mammal with streamlined body, dorsal fin, flippers, and a playful intelligence",
  "Shark":
    "Streamlined predator with dorsal fin, powerful tail, rows of teeth, and gill slits",
  "Orca":
    "Marine mammal with black and white coloring, dorsal fin, powerful tail flukes, and intelligent mind",
  "Sea Turtle":
    "Marine reptile with protective shell, paddle-like flippers, streamlined form, and ancient wisdom",
  "Octopus":
    "Eight-armed cephalopod with soft body, intelligent eyes, color-changing skin, and beak",
  "Kraken":
    "Massive cephalopod with eight giant tentacles, large mantle, powerful beak, and ship-destroying strength",
  "Leviathan":
    "Colossal sea serpent with titanic length, armored scales, tidal power, and primordial oceanic dominance",
  "Manta Ray":
    "Graceful marine creature with wing-like fins, flat body, cephalic fins, and elegant gliding motion",
  "Jellyfish":
    "Marine invertebrate with translucent bell, trailing tentacles, and graceful pulsing movement",
  "Blue Whale":
    "Largest marine mammal with streamlined body, massive size, baleen plates, and haunting song",

  // Reptiles & Amphibians
  "Snake":
    "Legless reptile with long sinuous body, scales, forked tongue, and flexible spine",
  "Crocodile":
    "Four-legged reptile with armored scales, powerful jaws, muscular tail, and semi-aquatic nature",
  "Salamander":
    "Four-legged amphibian with long tail, moist skin, delicate limbs, and regenerative abilities",

  // Dinosaurs
  "T-Rex":
    "Bipedal dinosaur with massive jaws, tiny arms, powerful tail for balance, and thick scales",
  "Velociraptor":
    "Bipedal dinosaur with sickle claws, feathered body, long tail, and pack intelligence",

  // Small Mammals & Marsupials
  "Kangaroo":
    "Bipedal marsupial with powerful hind legs, long tail for balance, pouch, and hopping locomotion",
  "Sloth":
    "Arboreal mammal with long claws, slow movement, shaggy fur, and perpetual calm demeanor",
  "Wolverine":
    "Four-legged mustelid with stocky build, powerful jaws, thick fur, and fearless ferocity",
  "Hyena":
    "Four-legged carnivore with sloping back, powerful jaws, spotted coat, and pack intelligence",

  // Mythical & Folkloric
  "Kitsune":
    "Mystical fox with multiple tails, shapeshifting ability, fox-fire magic, and ancient wisdom",
  "Tanuki":
    "Magical raccoon-dog with transformative powers, a round playful silhouette, mischievous charm, and trickster spirit",
  "Egg":
    "A living elemental egg with a smooth shell, swirling inner light, subtle warmth, and dormant potential",
};

const getSpeciesTraits = (creature: string): string => {
  return SPECIES_TRAITS[creature] ||
    `A ${creature.toLowerCase()} with its natural anatomical structure and movement patterns`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const { companionId, stage } = await req.json();

    if (!companionId || stage === undefined) {
      throw new Error("companionId and stage are required");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );

    // Get user
    const { data: { user }, error: userError } = await supabaseClient.auth
      .getUser();
    if (userError || !user) throw new Error("Unauthorized");

    // Resolve ownership and return an existing chapter before spending another
    // provider request. Companion creation can enqueue the prologue while the
    // user also opens the journal, so retries need to be idempotent.
    const { data: companion, error: companionError } = await supabaseClient
      .from("user_companion")
      .select("*")
      .eq("id", companionId)
      .maybeSingle();

    if (companionError || !companion) throw new Error("Companion not found");
    if (companion.user_id !== user.id) throw new Error("Unauthorized");

    const { data: existingStory, error: existingStoryError } =
      await supabaseClient
        .from("companion_stories")
        .select("*")
        .eq("companion_id", companionId)
        .eq("stage", stage)
        .maybeSingle();

    if (existingStoryError) throw new Error("Failed to check existing story");
    if (existingStory) {
      return new Response(JSON.stringify(existingStory), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limiting check - prevent abuse (15 new stories per 24 hours)
    const rateLimitResult = await checkRateLimit(
      supabaseClient,
      user.id,
      "companion-story",
      { maxCalls: 15, windowHours: 24 },
    );

    if (!rateLimitResult.allowed) {
      console.warn(
        `Rate limit exceeded for user ${user.id} on companion-story generation`,
      );
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    // Use companion's stored tone preference
    const tonePreference = companion.story_tone || "epic_adventure";

    // Get user profile for personality and goals
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("onboarding_data")
      .eq("id", user.id)
      .maybeSingle();

    const onboardingData = profile?.onboarding_data || {};
    const accountEmail = typeof user.app_metadata?.account_email === "string"
      ? user.app_metadata.account_email
      : typeof user.user_metadata?.account_email === "string"
      ? user.user_metadata.account_email
      : user.email;
    const userName = onboardingData.userName || accountEmail?.split("@")[0] ||
      "Hero";
    const userGoal = onboardingData.userGoal || "achieving personal growth";
    const userPersonality = onboardingData.userPersonality || "determined";
    const creaturePersonality = onboardingData.creaturePersonality ||
      "loyal and brave";
    const storyChapter = resolveGracewardCompanionStoryChapter(stage);
    const isCosmiqCompanion = companion.product_mode === "cosmiq";
    const productName = isCosmiqCompanion ? "Cosmiq" : "Graceward";
    const productStoryPrinciples = isCosmiqCompanion
      ? `COSMIQ STORY PRINCIPLES:
• The companion grows through the user's progress, choices, quests, and returning bond.
• Preserve the selected Cosmiq species, element, anatomy, and established fantasy identity across every chapter.
• Keep wonder playful and adventurous without importing Graceward-specific faith language, formation claims, or Guide theology.
• Avoid punitive streak language, fear-based grinding, chosen-one clichés, and empty power escalation.`
      : `GRACEWARD STORY PRINCIPLES:
• The companion grows because the user keeps taking honest daily steps, not because of grinding, fear, or perfection.
• The Guide offers encouragement and reflection; the companion remembers, reacts, plays, and travels beside the user. Keep those roles connected but distinct.
• Make the world feel explorable, surprising, and alive while grounding the emotional meaning in grace, courage, stewardship, hope, and faithful return.
• Never imply that the companion is divine, speaks for God, grants spiritual authority, or should be worshiped.
• Avoid occult ritual, cosmic destiny claims, punitive streak language, and empty power escalation.`;
    const productWritingRules = isCosmiqCompanion
      ? `• Say Cosmiq when the product world needs a name; never say Graceward.
• Use the shared eight-stage progression while preserving the companion's existing Cosmiq lineage.
• Keep the user and creature as companions, not commander and tool.`
      : `• Say Graceward when the product world needs a name; never say Cosmiq.
• Use the current eight-stage Graceward progression only.
• Keep the user and creature as companions, not commander and tool.
• Keep physical behavior true to the selected animal. A Lamb nuzzles and steps on cloven hooves; a Lion stretches and uses feline paws; a Stag bows and listens with ears and antlers; a Dove hops, bobs, and settles its wings; an Eagle mantles, turns, and grips with talons; a Wolf scents, play-bows, and sweeps its tail.`;

    const { data: recentDailyThreads, error: dailyThreadError } =
      await supabaseClient
        .from("daily_guide_threads")
        .select(
          "thread_date, mentor_name, focus_label, companion_answer_label, encouragement_completed_at, practice_completed_at, evening_reflected_at",
        )
        .eq("user_id", user.id)
        .order("thread_date", { ascending: false })
        .limit(5);
    if (dailyThreadError) {
      console.warn(
        "Recent Graceward formation memory was unavailable:",
        dailyThreadError.message,
      );
    }
    const formationMemory = buildGracewardFormationMemory(recentDailyThreads);

    // Get previous chapters for continuity with smart truncation
    let memoryNotes = "This is the beginning of your journey.";
    if (stage > 0) {
      const { data: previousStories } = await supabaseClient
        .from("companion_stories")
        .select(
          "stage, chapter_title, main_story, bond_moment, lore_expansion, next_hook",
        )
        .eq("companion_id", companionId)
        .lt("stage", stage)
        .order("stage", { ascending: true });

      if (previousStories && previousStories.length > 0) {
        // Smart memory strategy: Last 5 stories in detail + summary of older ones
        const recentStories = previousStories.slice(-5);
        const olderStories = previousStories.slice(0, -5);

        const memoryParts: string[] = [];

        // Summary of older stories if they exist
        if (olderStories.length > 0) {
          const oldestStage = olderStories[0].stage;
          const oldestToNewest = olderStories[olderStories.length - 1].stage;
          const keyEvents = olderStories.map((s) => s.chapter_title).join(", ");
          memoryParts.push(
            `Early Journey (Stages ${oldestStage}-${oldestToNewest}): ${keyEvents}`,
          );
        }

        // Detailed memory of recent 5 stories
        const recentMemory = recentStories
          .map((s: any) => {
            const loreItems = Array.isArray(s.lore_expansion)
              ? s.lore_expansion.slice(0, 2).join("; ")
              : "";
            const storySnippet = s.main_story?.substring(0, 150) || "";
            return `Stage ${s.stage} - "${s.chapter_title}":\n${storySnippet}...\nBond: ${s.bond_moment}\nNext: ${s.next_hook}`;
          })
          .join("\n\n");

        memoryParts.push(recentMemory);
        memoryNotes = memoryParts.join("\n\n---\n\n");
      }
    }

    const speciesTraits = getSpeciesTraits(companion.spirit_animal);
    const speciesIdentity = resolveCompanionSpeciesIdentity(
      companion.spirit_animal,
    );
    const speciesIdentityPromptBlock = speciesIdentity
      ? buildCompanionSpeciesIdentityPromptBlock(speciesIdentity)
      : null;
    const spiritLockProfile = resolveCompanionSpiritLockProfile(
      companion.spirit_animal,
    );
    const spiritLockPromptBlock = spiritLockProfile
      ? buildSpiritLockPromptBlock(spiritLockProfile, "story")
      : null;

    console.log("[SpiritLock]", {
      species: companion.spirit_animal,
      profile_match: spiritLockProfile?.id ?? null,
      function: "generate-companion-story",
      stage,
    });

    // Keep installed Cosmiq lineages available without leaking Graceward's
    // product identity or formation theology into their legacy story content.
    const storyPrompt =
      `You are the ${productName.toUpperCase()} COMPANION STORY ENGINE. Write one emotionally resonant chapter in a growing game-like world shared by the user and their living creature companion.

${productStoryPrinciples}
• Preserve the creature's species and anatomy. Growth can add maturity, confidence, movement, markings, and elemental expression—not a different species.
${speciesIdentityPromptBlock ? `\n${speciesIdentityPromptBlock}\n` : ""}

USER AND COMPANION:
- User Name: ${userName}
- Creature Species: ${companion.spirit_animal}
- Species Traits: ${speciesTraits}
- Element: ${companion.core_element}
- Primary Color: A vibrant ${getColorName(companion.favorite_color)} hue
- Secondary Color: ${
        companion.fur_color
          ? `A ${getColorName(companion.fur_color)} tone`
          : `A ${getColorName(companion.favorite_color)} tone`
      }
- Eye Color: ${
        companion.eye_color
          ? getColorName(companion.eye_color)
          : `glowing ${getColorName(companion.favorite_color)}`
      }
- Creature Personality: ${creaturePersonality}
- User Personality: ${userPersonality}
- User Goal: ${userGoal}
- ${productName} Level: ${stage}
- Visual Form: Stage ${storyChapter.visualStage} • ${storyChapter.formName}
- Chapter Frame: ${storyChapter.chapterTitle}
- Chapter Theme: ${storyChapter.theme}
- World Scale: ${storyChapter.worldScale}
- Bond Development: ${storyChapter.bondDevelopment}
- Tone Preference: ${tonePreference}

RECENT ${isCosmiqCompanion ? "ACTIVITY" : "GUIDE-LED FORMATION"}:
${formationMemory}

PREVIOUS STORY MEMORY:
${memoryNotes}

CHAPTER STRUCTURE:

1. **Chapter Title**
   A vivid title that belongs naturally inside the “${storyChapter.chapterTitle}” chapter frame.

2. **Intro Line (1–2 sentences)**
   Open on movement, discovery, or a creature behavior—not an abstract summary.

3. **Main Story (100–160 words)**
   Focus on one playable-feeling moment with a place, a choice, a complication, and a companion reaction. The chapter must:
   • embody “${storyChapter.theme}” at the scale of ${storyChapter.worldScale}
   ${
        stage === 0
          ? "• Keep the companion inside the EGG. Show warmth, wobbling, listening, light, and the first response to the user; do not reveal a formed creature."
          : ""
      }
   ${
        stage === 1
          ? "• Show the first hatch and vulnerable species-faithful movement. Let trust matter more than spectacle."
          : ""
      }
   • use species-faithful behavior based on: ${speciesTraits}
   • let ${companion.core_element} appear through atmosphere and expression rather than changing anatomy
   • mirror the real-life goal “${userGoal}” through a concrete choice
   • use one true recent formation signal when available, but never claim the user completed something absent from the data
   ${
        stage > 0
          ? "• preserve at least one meaningful continuity detail from previous chapters when available"
          : ""
      }
   • deepen the bond through action, play, attention, protection, or gentle return
   • end with the world slightly more open than before

4. **Bond Moment (1–2 sentences)**
   Show an observable creature interaction: a nuzzle, listening tilt, wing/tail/ear movement, shared stillness, playful invitation, protective stance, or species-specific signature.

5. **Life Lesson (1–2 sentences)**
   Offer a gentle insight connected to the user's actual goal. Never shame unfinished work.

6. **Lore Expansion (3–5 bullet points)**
   Include one World Truth, one remembered Historical Reference, and one Foreshadowing Seed. Keep lore coherent and discoverable rather than encyclopedic.

7. **Next Evolution Hook (1–2 sentences)**
   Open a question, place, relationship, or mystery that can continue. At Grand, open a new horizon rather than declaring a final ending.

WRITING RULES:
${productWritingRules}
• Show the creature doing something physically expressive in every chapter.
• Keep wonder warm and specific; avoid generic “chosen one,” universe-saving, and ultimate-power clichés.
• Maintain continuity through Previous Story Memory and Recent Guide-led Formation.
${
        spiritLockPromptBlock
          ? `• SPIRIT LOCK (MANDATORY):\n${
            spiritLockPromptBlock.replace(/\n/g, "\n  ")
          }`
          : ""
      }

CRITICAL: Respond ONLY in valid JSON format:
{
  "chapter_title": "...",
  "intro_line": "...",
  "main_story": "...",
  "bond_moment": "...",
  "life_lesson": "...",
  "lore_expansion": [
    "World Truth: ...",
    "Historical Reference: ...",
    "Foreshadowing Seed: ...",
    "Additional Lore: ...",
    "Additional Lore: ..."
  ],
  "next_hook": "..."
}

Generate now:`;

    const validator = new OutputValidator({
      outputFormat: "json",
      requiredFields: [
        "chapter_title",
        "intro_line",
        "main_story",
        "bond_moment",
        "life_lesson",
        "lore_expansion",
        "next_hook",
      ],
      forbiddenPhrases: [
        "As an AI",
        "I cannot",
        "I apologize",
        "Sorry, I",
        "I'm unable",
      ],
    }, {
      toneMarkers: ["epic", "mythic", "adventure", "bond", "journey"],
    });

    // Call OpenAI
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    const generateStoryPayload = async (prompt: string) => {
      if (!OPENAI_API_KEY) throw new Error("AI provider unavailable");

      const aiResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: isCosmiqCompanion
                  ? "You are the Cosmiq Companion Story Engine. Create warm, playable fantasy chapters about an ever-growing creature bond. Preserve continuity, element, and creature biology. Never use Graceward branding or faith-specific formation claims. Always respond with valid JSON only."
                  : "You are the Graceward Companion Story Engine. Create warm, playable-feeling chapters about an ever-growing creature bond shaped by honest daily formation. Preserve continuity and creature biology. Never use Cosmiq branding. Always respond with valid JSON only.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.85,
            max_tokens: 1200,
          }),
        },
      );

      if (!aiResponse.ok) {
        const error = await aiResponse.text();
        console.error("AI API error:", error);
        throw new Error(`AI generation failed: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const generatedText = aiData.choices?.[0]?.message?.content;
      if (
        typeof generatedText !== "string" || generatedText.trim().length === 0
      ) {
        throw new Error("Failed to parse story data");
      }

      let parsedData;
      try {
        const cleanedText = generatedText.replace(/```json\n?/g, "").replace(
          /```\n?/g,
          "",
        ).trim();
        parsedData = JSON.parse(cleanedText);
      } catch (_error) {
        console.error("Failed to parse AI response:", generatedText);
        throw new Error("Failed to parse story data");
      }

      if (
        !parsedData.chapter_title || !parsedData.intro_line ||
        !parsedData.main_story ||
        !parsedData.bond_moment || !parsedData.life_lesson ||
        !parsedData.next_hook
      ) {
        throw new Error("Invalid story data: missing required fields");
      }

      const mainStoryLength = (parsedData.main_story || "").length;
      if (mainStoryLength < 100) {
        console.warn(`Story too short: ${mainStoryLength} chars`);
        throw new Error("Generated story is too short. Please try again.");
      }
      if (mainStoryLength > 1500) {
        console.warn(`Story too long: ${mainStoryLength} chars`);
        throw new Error("Generated story is too long. Please try again.");
      }

      const validationResult = validator.validate(parsedData);
      if (!validationResult.isValid) {
        console.error("Story validation failed:", validationResult.errors);
        throw new Error("Generated story does not meet quality standards");
      }

      if (validationResult.warnings.length > 0) {
        console.warn("Story validation warnings:", validationResult.warnings);
      }

      const loreExpansion = Array.isArray(parsedData.lore_expansion)
        ? parsedData.lore_expansion.map((item: string) =>
          sanitizeHexCodes(item)
        )
        : [];

      return {
        chapter_title: sanitizeHexCodes(parsedData.chapter_title),
        intro_line: sanitizeHexCodes(parsedData.intro_line),
        main_story: sanitizeHexCodes(parsedData.main_story),
        bond_moment: sanitizeHexCodes(parsedData.bond_moment),
        life_lesson: sanitizeHexCodes(parsedData.life_lesson),
        lore_expansion: loreExpansion,
        next_hook: sanitizeHexCodes(parsedData.next_hook),
      };
    };

    const buildStoryFallback = () =>
      buildCompanionStoryFallback({
        stage,
        userName,
        species: companion.spirit_animal,
        element: companion.core_element,
        chapterTitle: storyChapter.chapterTitle,
        chapterTheme: storyChapter.theme,
        worldScale: storyChapter.worldScale,
        isCosmiqCompanion,
      });

    let storyData: ReturnType<typeof buildCompanionStoryFallback>;
    try {
      storyData = await generateStoryPayload(storyPrompt);
    } catch (generationError) {
      console.warn(
        "[Story Engine] AI generation unavailable; saving deterministic fallback",
        {
          stage,
          reason: generationError instanceof Error
            ? generationError.message
            : "Unknown generation error",
        },
      );
      storyData = buildStoryFallback();
    }

    if (spiritLockProfile) {
      const serializeStoryForCompliance = (value: typeof storyData): string =>
        [
          value.chapter_title,
          value.intro_line,
          value.main_story,
          value.bond_moment,
          value.life_lesson,
          ...(Array.isArray(value.lore_expansion) ? value.lore_expansion : []),
          value.next_hook,
        ].join(" ");

      let compliance = evaluateSpiritLockTextCompliance(
        serializeStoryForCompliance(storyData),
        spiritLockProfile,
      );

      console.log("[SpiritLock]", {
        species: companion.spirit_animal,
        profile_match: spiritLockProfile.id,
        function: "generate-companion-story",
        stage,
        phase: "first_pass",
        compliant: compliance.isCompliant,
        violations: compliance.violations,
      });

      if (!compliance.isCompliant) {
        const retryPrompt = `${storyPrompt}\n\n${
          buildSpiritLockRetryFeedback(spiritLockProfile, compliance)
        }\nReturn complete JSON in the same schema.`;
        console.log("[SpiritLock]", {
          species: companion.spirit_animal,
          profile_match: spiritLockProfile.id,
          function: "generate-companion-story",
          stage,
          phase: "retry_start",
        });

        try {
          const retriedStoryData = await generateStoryPayload(retryPrompt);
          compliance = evaluateSpiritLockTextCompliance(
            serializeStoryForCompliance(retriedStoryData),
            spiritLockProfile,
          );

          console.log("[SpiritLock]", {
            species: companion.spirit_animal,
            profile_match: spiritLockProfile.id,
            function: "generate-companion-story",
            stage,
            phase: "retry_result",
            compliant: compliance.isCompliant,
            violations: compliance.violations,
          });

          storyData = compliance.isCompliant
            ? retriedStoryData
            : buildStoryFallback();
        } catch (retryError) {
          console.error(
            "[SpiritLock] story retry failed, applying deterministic fallback",
            retryError,
          );
          storyData = buildStoryFallback();
        }
      }
    }

    const loreExpansion = Array.isArray(storyData.lore_expansion)
      ? storyData.lore_expansion
      : [];

    // Save to database
    const { data: savedStory, error: saveError } = await supabaseClient
      .from("companion_stories")
      .upsert({
        companion_id: companionId,
        user_id: user.id,
        stage: stage,
        chapter_title: storyData.chapter_title,
        intro_line: storyData.intro_line,
        main_story: storyData.main_story,
        bond_moment: storyData.bond_moment,
        life_lesson: storyData.life_lesson,
        lore_expansion: loreExpansion,
        next_hook: storyData.next_hook,
        tone_preference: tonePreference,
      }, {
        onConflict: "companion_id,stage",
      })
      .select()
      .single();

    if (saveError) {
      console.error("Save error:", saveError);
      throw new Error("Failed to save story");
    }

    return new Response(JSON.stringify(savedStory), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-companion-story:", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
