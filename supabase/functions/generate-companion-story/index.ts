import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, createRateLimitResponse } from "../_shared/rateLimiter.ts";
import { OutputValidator } from "../_shared/outputValidator.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

// Helper function to convert hex colors to descriptive names
function getColorName(color: string): string {
  if (!color) return 'vibrant';
  
  // If it's already a color name (no # or not 6 hex chars), return it
  if (!color.includes('#') && !/^[0-9A-Fa-f]{6}$/.test(color.replace('#', ''))) {
    return color.toLowerCase();
  }
  
  // Remove # if present
  const hex = color.replace('#', '').toLowerCase();
  
  // If not a valid hex, return as-is
  if (!/^[0-9a-f]{6}$/.test(hex)) {
    return color.toLowerCase();
  }
  
  const colorMap: Record<string, string> = {
    '9333ea': 'purple',
    '8b5cf6': 'violet', 
    'a855f7': 'purple',
    '6366f1': 'indigo',
    '3b82f6': 'blue',
    '0ea5e9': 'sky blue',
    '06b6d4': 'cyan',
    '14b8a6': 'teal',
    '10b981': 'emerald',
    '22c55e': 'green',
    '84cc16': 'lime',
    'eab308': 'yellow',
    'f59e0b': 'amber',
    'f97316': 'orange',
    'ef4444': 'red',
    'ec4899': 'pink',
    'f43f5e': 'rose',
  };
  
  // Return mapped color or extract RGB to approximate
  if (colorMap[hex]) return colorMap[hex];
  
  // Parse RGB values to determine general color
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  if (r > g && r > b) return 'red';
  if (g > r && g > b) return 'green';
  if (b > r && b > g) return 'blue';
  if (r > 200 && g > 200 && b > 200) return 'white';
  if (r < 50 && g < 50 && b < 50) return 'black';
  return 'vibrant';
}

const EVOLUTION_THEMES = [
  "Fate sleeping",              // Stage 0: Egg
  "First awakening",            // Stage 1: Hatchling
  "Tender growth",              // Stage 2: Sproutling
  "Young courage",              // Stage 3: Cub
  "Coming of age",              // Stage 4: Juvenile
  "Training begins",            // Stage 5: Apprentice
  "Swift explorer",             // Stage 6: Scout
  "Wings unfurled",             // Stage 7: Fledgling
  "Battle-forged",              // Stage 8: Warrior
  "Sacred protector",           // Stage 9: Guardian
  "Glory earned",               // Stage 10: Champion
  "Transcendent shift",         // Stage 11: Ascended
  "Vanguard rises",             // Stage 12: Vanguard
  "Colossal might",             // Stage 13: Titan
  "Mythic power",               // Stage 14: Mythic
  "Apex mastery",               // Stage 15: Prime
  "Royal majesty",              // Stage 16: Regal
  "Timeless sovereign",         // Stage 17: Eternal
  "Reality transcends",         // Stage 18: Transcendent
  "Apex achieved",              // Stage 19: Apex
  "Ultimate existence"          // Stage 20: Ultimate
];

// Species anatomical traits for accuracy - ALL 66 ANIMALS SUPPORTED
const SPECIES_TRAITS: Record<string, string> = {
  // Canines
  "Wolf": "Four-legged canine with powerful legs, flowing fur, pointed ears, and a long bushy tail",
  "Fox": "Four-legged canine with slender build, pointed ears, bushy tail, and agile movements",
  "Arctic Fox": "Four-legged canine with dense white fur, small rounded ears, fluffy tail, and compact body for cold climates",
  "Fennec Fox": "Four-legged canine with oversized ears, sandy coat, bushy tail, and delicate frame built for desert life",
  "Dog": "Four-legged canine with loyal eyes, wagging tail, varied coat, and expressive face",
  
  // Felines
  "Tiger": "Four-legged feline with muscular build, striped coat, retractable claws, and a long tail for balance",
  "Lion": "Four-legged feline with golden mane (males), muscular body, sharp claws, and commanding presence",
  "Panther": "Four-legged feline with sleek black coat, retractable claws, long tail, and silent movement",
  "Cat": "Four-legged feline with graceful movements, retractable claws, whiskers, and expressive tail",
  "Cheetah": "Four-legged feline with slender aerodynamic build, spotted coat, long tail, and non-retractable claws for speed",
  "Jaguar": "Four-legged feline with stocky muscular build, rosette-spotted coat, powerful jaws, and swimming ability",
  "Snow Leopard": "Four-legged feline with thick fur, long bushy tail, large paws, and smoky gray coat with dark rosettes",
  "Puma / Cougar": "Four-legged feline with tawny coat, powerful hind legs, long tail, and solitary hunting prowess",
  "Lynx": "Four-legged feline with tufted ears, short tail, powerful legs, and thick winter coat",
  
  // Bears & Large Mammals
  "Bear": "Four-legged ursine with massive frame, thick fur, powerful claws, and a short tail",
  "Gorilla": "Knuckle-walking primate with massive arms, powerful chest, expressive face, and intelligent eyes",
  "Elephant": "Four-legged pachyderm with massive body, long trunk, large ears, and ivory tusks",
  "Hippo": "Four-legged semi-aquatic herbivore with barrel-shaped body, massive jaws, thick skin, and webbed feet",
  "Rhino": "Four-legged herbivore with thick armored hide, one or two horns, stocky build, and massive weight",
  "Mammoth": "Four-legged prehistoric elephant with long curved tusks, thick shaggy fur, and massive size",
  
  // Equines
  "Unicorn": "Four-legged equine with single spiraling horn, flowing mane and tail, and graceful hooves",
  "Horse (Stallion)": "Four-legged equine with muscular build, flowing mane and tail, powerful legs, and noble bearing",
  "Pegasus": "Winged equine with four legs, feathered wings, flowing mane and tail, and hooves",
  "Reindeer": "Four-legged cervine with branching antlers, thick fur, wide hooves for snow, and endurance for migration",
  
  // Birds & Winged Creatures
  "Eagle": "Winged raptor with sharp talons, hooked beak, feathered wings, and keen forward-facing eyes",
  "Phoenix": "Mythic bird with fiery plumage, long tail feathers, powerful wings, and a crest of flame",
  "Owl": "Winged nocturnal bird with forward-facing eyes, silent flight feathers, sharp talons, and rotating head",
  "Falcon": "Winged raptor with streamlined body, sharp talons, hooked beak, and incredible speed",
  "Hawk": "Winged raptor with broad wings, sharp vision, hooked beak, and powerful talons",
  "Raven": "Winged corvid with black feathers, sharp beak, intelligent eyes, and grasping talons",
  "Parrot": "Winged bird with vibrant plumage, curved beak, zygodactyl feet, and vocal mimicry ability",
  "Penguin": "Flightless seabird with flipper-like wings, streamlined body, webbed feet, and tuxedo-like coloring",
  "Hummingbird": "Tiny winged bird with iridescent feathers, long beak, rapid wing beats, and hovering flight",
  "Butterfly": "Winged insect with four colorful wings, slender body, antennae, and delicate flight",
  "Thunderbird": "Mythic winged bird with massive wingspan, storm-summoning power, lightning-wreathed feathers, and elemental presence",
  
  // Dragons & Mythical Reptiles
  "Dragon": "Winged reptilian with four legs, scales, horns, long tail, and wings emerging from shoulder blades",
  "Wyvern": "Winged reptilian with two legs, barbed tail, wings doubling as front limbs, and serpentine neck",
  "Mechanical Dragon": "Clockwork dragon with metallic scales, gear-driven wings, steam-powered breath, and articulated joints",
  "Basilisk": "Serpentine reptile with deadly gaze, crown-like crest, venomous fangs, and petrifying presence",
  
  // Hybrids & Chimeras
  "Griffin": "Hybrid with eagle head and wings, lion body and legs, sharp talons, and a long tail",
  "Gryphon": "Hybrid with eagle head and wings, lion body and legs, sharp talons, and a long tail",
  "Hippogriff": "Hybrid with eagle head and wings, horse body and legs, sharp talons on front limbs, and hooves on hind legs",
  "Sphinx": "Hybrid with human head, lion body, eagle wings, and riddle-speaking intelligence",
  "Cerberus": "Three-headed canine with muscular body, multiple snarling heads, serpent tail, and guardian instinct",
  "Hydra": "Multi-headed serpentine dragon with regenerating heads, venomous breath, long necks, and aquatic build",
  "Fenrir": "Massive wolf with apocalyptic size, chain-breaking strength, iron fangs, and prophesied destiny",
  
  // Marine Creatures
  "Dolphin": "Sleek marine mammal with streamlined body, dorsal fin, flippers, and a playful intelligence",
  "Shark": "Streamlined predator with dorsal fin, powerful tail, rows of teeth, and gill slits",
  "Orca": "Marine mammal with black and white coloring, dorsal fin, powerful tail flukes, and intelligent mind",
  "Sea Turtle": "Marine reptile with protective shell, paddle-like flippers, streamlined form, and ancient wisdom",
  "Octopus": "Eight-armed cephalopod with soft body, intelligent eyes, color-changing skin, and beak",
  "Kraken": "Massive cephalopod with eight giant tentacles, large mantle, powerful beak, and ship-destroying strength",
  "Leviathan": "Colossal sea serpent with titanic length, armored scales, tidal power, and primordial oceanic dominance",
  "Manta Ray": "Graceful marine creature with wing-like fins, flat body, cephalic fins, and elegant gliding motion",
  "Jellyfish": "Marine invertebrate with translucent bell, trailing tentacles, and graceful pulsing movement",
  "Blue Whale": "Largest marine mammal with streamlined body, massive size, baleen plates, and haunting song",
  
  // Reptiles & Amphibians
  "Snake": "Legless reptile with long sinuous body, scales, forked tongue, and flexible spine",
  "Crocodile": "Four-legged reptile with armored scales, powerful jaws, muscular tail, and semi-aquatic nature",
  "Salamander": "Four-legged amphibian with long tail, moist skin, delicate limbs, and regenerative abilities",
  
  // Dinosaurs
  "T-Rex": "Bipedal dinosaur with massive jaws, tiny arms, powerful tail for balance, and thick scales",
  "Velociraptor": "Bipedal dinosaur with sickle claws, feathered body, long tail, and pack intelligence",
  
  // Small Mammals & Marsupials
  "Kangaroo": "Bipedal marsupial with powerful hind legs, long tail for balance, pouch, and hopping locomotion",
  "Sloth": "Arboreal mammal with long claws, slow movement, shaggy fur, and perpetual calm demeanor",
  "Wolverine": "Four-legged mustelid with stocky build, powerful jaws, thick fur, and fearless ferocity",
  "Hyena": "Four-legged carnivore with sloping back, powerful jaws, spotted coat, and pack intelligence",
  
  // Mythical & Folkloric
  "Kitsune": "Mystical fox with multiple tails, shapeshifting ability, fox-fire magic, and ancient wisdom",
  "Tanuki": "Magical raccoon-dog with transformative powers, large testicles (folkloric), playful nature, and trickster spirit",
};

const getSpeciesTraits = (creature: string): string => {
  return SPECIES_TRAITS[creature] || `A ${creature.toLowerCase()} with its natural anatomical structure and movement patterns`;
};


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const { companionId, stage } = await req.json();

    if (!companionId || stage === undefined) {
      throw new Error('companionId and stage are required');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    // Rate limiting check - prevent abuse (15 stories per 24 hours)
    const rateLimitResult = await checkRateLimit(
      supabaseClient,
      user.id,
      'companion-story',
      { maxCalls: 15, windowHours: 24 }
    );

    if (!rateLimitResult.allowed) {
      console.warn(`Rate limit exceeded for user ${user.id} on companion-story generation`);
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    // Get companion details including story_tone
    const { data: companion, error: companionError } = await supabaseClient
      .from('user_companion')
      .select('*')
      .eq('id', companionId)
      .maybeSingle();

    if (companionError || !companion) throw new Error('Companion not found');
    if (companion.user_id !== user.id) throw new Error('Unauthorized');

    // Use companion's stored tone preference
    const tonePreference = companion.story_tone || 'epic_adventure';

    // Get user profile for personality and goals
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('onboarding_data')
      .eq('id', user.id)
      .maybeSingle();

    const onboardingData = profile?.onboarding_data || {};
    const userName = onboardingData.userName || user.email?.split('@')[0] || 'Hero';
    const userGoal = onboardingData.userGoal || "achieving personal growth";
    const userPersonality = onboardingData.userPersonality || "determined";
    const creaturePersonality = onboardingData.creaturePersonality || "loyal and brave";

    // Get previous chapters for continuity with smart truncation
    let memoryNotes = "This is the beginning of your journey.";
    if (stage > 0) {
      const { data: previousStories } = await supabaseClient
        .from('companion_stories')
        .select('stage, chapter_title, main_story, bond_moment, lore_expansion, next_hook')
        .eq('companion_id', companionId)
        .lt('stage', stage)
        .order('stage', { ascending: true });

      if (previousStories && previousStories.length > 0) {
        // Smart memory strategy: Last 5 stories in detail + summary of older ones
        const recentStories = previousStories.slice(-5);
        const olderStories = previousStories.slice(0, -5);
        
        const memoryParts: string[] = [];
        
        // Summary of older stories if they exist
        if (olderStories.length > 0) {
          const oldestStage = olderStories[0].stage;
          const oldestToNewest = olderStories[olderStories.length - 1].stage;
          const keyEvents = olderStories.map(s => s.chapter_title).join(', ');
          memoryParts.push(`Early Journey (Stages ${oldestStage}-${oldestToNewest}): ${keyEvents}`);
        }
        
        // Detailed memory of recent 5 stories
        const recentMemory = recentStories
          .map((s: any) => {
            const loreItems = Array.isArray(s.lore_expansion) ? s.lore_expansion.slice(0, 2).join('; ') : '';
            const storySnippet = s.main_story?.substring(0, 150) || '';
            return `Stage ${s.stage} - "${s.chapter_title}":\n${storySnippet}...\nBond: ${s.bond_moment}\nNext: ${s.next_hook}`;
          })
          .join('\n\n');
        
        memoryParts.push(recentMemory);
        memoryNotes = memoryParts.join('\n\n---\n\n');
      }
    }

    const speciesTraits = SPECIES_TRAITS[companion.spirit_animal] || `A ${companion.spirit_animal.toLowerCase()} with its natural anatomical structure and movement patterns`;

    // Build the V2 story generation prompt
    const storyPrompt = `You are STORY ENGINE V2 — a refined mythic adventure generator that produces a single chapter of a personalized hero journey for the user and their evolving creature companion.

Your goals:
• tell a consistent, emotionally resonant story
• preserve anatomical accuracy of the chosen creature
• escalate scale, stakes, and epicness with each evolution stage
• mirror the user's real-life goal in symbolic story beats
• maintain continuity with previous chapters
• deepen the bond between user and creature
• introduce clean lore that gets richer as the story progresses
• integrate elemental, species-specific, and color-specific visuals naturally
• NEVER alter creature anatomy; only grow or enhance it

USER VARIABLES:
- User Name: ${userName}
- Creature Species: ${companion.spirit_animal}
- Species Traits: ${speciesTraits}
- Element: ${companion.core_element}
- Primary Color: A vibrant ${getColorName(companion.favorite_color)} hue
- Secondary Color: ${companion.fur_color ? `A ${getColorName(companion.fur_color)} tone` : `A ${getColorName(companion.favorite_color)} tone`}
- Eye Color: ${companion.eye_color ? getColorName(companion.eye_color) : `glowing ${getColorName(companion.favorite_color)}`}
- Creature Personality: ${creaturePersonality}
- User Personality: ${userPersonality}
- User Goal: ${userGoal}
- Evolution Stage: ${stage} (${EVOLUTION_THEMES[stage]})
- Tone: ${tonePreference}
- Memory Notes: ${memoryNotes}

STRUCTURE FOR EACH CHAPTER:

1. **Chapter Title**
   One cinematic, emotionally charged title aligned with the evolution stage theme.

2. **Intro Line (1–2 sentences)**
   A bold opening that instantly sets the mood and tone for this chapter.

3. **Main Story (80–120 words)**
   A concise but powerful chapter that captures the essence of this evolution stage. Focus on ONE key moment. The chapter must:
   • reflect the evolution stage theme (${EVOLUTION_THEMES[stage]})
   ${stage === 0 ? '• CRITICAL: The companion is an EGG at this stage - NOT a formed creature yet\n   • Describe the egg itself: its appearance, colors, warmth, subtle movements or energy\n   • The user discovers/receives this mysterious egg - their first meeting with their future companion\n   • The egg should feel alive with potential, humming with dormant power\n   • Refer to it as "the egg" or similar - NEVER as the fully-formed creature\n   • Set the tone for an epic journey about to hatch into existence' : ''}
   ${stage === 1 ? '• THE HATCHING: The creature emerges for the first time - small, vulnerable, but clearly showing its species traits' : ''}
   • show clear, species-faithful physical evolution
   • keep the creature anatomically consistent with ${speciesTraits}
   • incorporate ${companion.favorite_color}, ${companion.fur_color}, and ${companion.eye_color} subtly and beautifully
   • display elemental effects appropriate to ${companion.core_element}
   • include at least one "Goal Mirror Moment" tied to "${userGoal}"
   ${stage > 0 ? `• reference at least one detail from: ${memoryNotes}` : ''}
   • escalate danger appropriate to stage tier:
       ∙ Stages 0–5: local/natural threats
       ∙ Stages 6–10: named foes or magical dangers
      ∙ Stages 11–14: ancient/legendary forces
      ∙ Stages 15–20: cosmiq/titanic threats
   • deepen the bond between user and creature
   • feel like part of a larger mythic arc

4. **Bond Moment (1–2 sentences)**
   A ritual-like emotional connection unique to this chapter.

5. **Life Lesson (1–2 sentences)**
   A metaphorical lesson that subtly reinforces the user's real-life goal: "${userGoal}"

6. **Lore Expansion (3–7 bullet points)**
   Must include:
   • ONE "World Truth"
   • ONE "Historical Reference"
   • ONE "Foreshadowing Seed" for future chapters
   • optional: elemental lore, species lore, geography, old myths

7. **Next Evolution Hook (1–2 sentences)**
   A cliffhanger leading directly into the next chapter's evolution theme.

WRITING RULES:
• Never contradict previous lore or biology
• Never force evolution changes inappropriate for the species
• Element is decoration, mood, and power — not transformation
• Tone scales with stage + theme intensity
• The story must feel handcrafted, not generic
• Always keep the user at the emotional center
• Creature growth mirrors user growth
• Build a mythic epic chapter by chapter
• Avoid repetition across stages
• Use vivid but controlled sensory imagery
• Maintain continuity through Memory Notes

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

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are STORY ENGINE V2, a master mythic storyteller. You create personalized hero journeys that maintain perfect continuity, anatomical accuracy, and emotional resonance. Always respond with valid JSON only. Never alter creature biology.'
          },
          {
            role: 'user',
            content: storyPrompt
          }
        ],
        temperature: 0.85,
        max_tokens: 1200,
      }),
    });

    if (!aiResponse.ok) {
      const error = await aiResponse.text();
      console.error('AI API error:', error);
      throw new Error(`AI generation failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const generatedText = aiData.choices[0].message.content;

    // Parse the JSON response
    let storyData;
    try {
      // Clean the response if it has markdown code blocks
      const cleanedText = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      storyData = JSON.parse(cleanedText);
    } catch (e) {
      console.error('Failed to parse AI response:', generatedText);
      throw new Error('Failed to parse story data');
    }

    // Validate story data using OutputValidator
    const validator = new OutputValidator({
      outputFormat: 'json',
      requiredFields: [
        'chapter_title',
        'intro_line',
        'main_story',
        'bond_moment',
        'life_lesson',
        'lore_expansion',
        'next_hook'
      ],
      forbiddenPhrases: ['As an AI', 'I cannot', 'I apologize', 'Sorry, I', 'I\'m unable'],
    }, {
      toneMarkers: ['epic', 'mythic', 'adventure', 'bond', 'journey']
    });

    // Validate required fields
    if (!storyData.chapter_title || !storyData.intro_line || !storyData.main_story || 
        !storyData.bond_moment || !storyData.life_lesson || !storyData.next_hook) {
      throw new Error('Invalid story data: missing required fields');
    }

    // Validate main story length (80-150 words approximately = 400-900 chars)
    const mainStoryLength = (storyData.main_story || '').length;
    if (mainStoryLength < 100) {
      console.warn(`Story too short: ${mainStoryLength} chars`);
      throw new Error('Generated story is too short. Please try again.');
    }
    if (mainStoryLength > 1500) {
      console.warn(`Story too long: ${mainStoryLength} chars`);
      throw new Error('Generated story is too long. Please try again.');
    }

    // Run validation checks
    const validationResult = validator.validate(storyData);
    if (!validationResult.isValid) {
      console.error('Story validation failed:', validationResult.errors);
      throw new Error('Generated story does not meet quality standards');
    }
    
    if (validationResult.warnings.length > 0) {
      console.warn('Story validation warnings:', validationResult.warnings);
    }

    // Ensure lore_expansion is an array
    const loreExpansion = Array.isArray(storyData.lore_expansion) 
      ? storyData.lore_expansion 
      : [];

    // Save to database
    const { data: savedStory, error: saveError } = await supabaseClient
      .from('companion_stories')
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
        onConflict: 'companion_id,stage'
      })
      .select()
      .single();

    if (saveError) {
      console.error('Save error:', saveError);
      throw new Error('Failed to save story');
    }

    return new Response(JSON.stringify(savedStory), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-companion-story:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
