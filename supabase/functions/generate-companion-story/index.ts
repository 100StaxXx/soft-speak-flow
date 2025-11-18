import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EVOLUTION_THEMES = [
  "Fate sleeping",
  "Awakening",
  "New beginning",
  "Fragility & courage",
  "First trial",
  "Journey begins",
  "Guardian awakening",
  "The oath",
  "The world pushes back",
  "Rise of protector",
  "Scars of experience",
  "Lift of hope",
  "Ascension",
  "Unity of souls",
  "Primordial ancestry",
  "Colossus awakening",
  "Cosmic purpose",
  "Astral power",
  "Universal sovereignty",
  "Mythic apex",
  "Origin of Creation"
];

// Species anatomical traits for accuracy - comprehensive coverage for all companions
const SPECIES_TRAITS: Record<string, string> = {
  // Canines & Wolves
  "Wolf": "Four-legged canine with powerful legs, flowing fur, pointed ears, and a long bushy tail",
  "Fox": "Four-legged canine with slender build, pointed ears, bushy tail, and agile movements",
  "Dog": "Four-legged canine companion with floppy or pointed ears, expressive eyes, and wagging tail",
  "Hyena": "Four-legged canine with powerful jaws, sloping back, spotted or striped coat, and cackling vocalization",
  
  // Big Cats
  "Tiger": "Four-legged feline with muscular build, striped coat, retractable claws, and a long tail for balance",
  "Lion": "Four-legged feline with golden mane (males), muscular body, sharp claws, and commanding presence",
  "Panther": "Four-legged feline with sleek black coat, retractable claws, long tail, and silent movement",
  "Jaguar": "Four-legged feline with powerful build, rosette-patterned coat, strong jaws, and swimming ability",
  "Snow Leopard": "Four-legged feline with thick fur, long tail for balance, large paws, and mountain-adapted build",
  "Cheetah": "Four-legged feline with slender aerodynamic build, spotted coat, non-retractable claws, and incredible speed",
  "Puma / Cougar": "Four-legged feline with tawny coat, powerful hind legs, long tail, and solitary nature",
  "Lynx": "Four-legged feline with tufted ears, short tail, powerful legs, and thick winter coat",
  "Cat": "Four-legged feline with retractable claws, whiskers, flexible spine, and graceful movements",
  
  // Bears & Large Mammals
  "Bear": "Four-legged ursine with massive frame, thick fur, powerful claws, and a short tail",
  "Gorilla": "Bipedal primate with massive chest, long arms, knuckle-walking gait, and intelligent eyes",
  "Elephant": "Four-legged pachyderm with trunk, large ears, tusks, and thick wrinkled skin",
  "Hippo": "Four-legged semi-aquatic mammal with massive jaws, barrel-shaped body, and webbed feet",
  "Rhino": "Four-legged mammal with armored skin, one or two horns, massive build, and sturdy legs",
  
  // Birds of Prey
  "Eagle": "Winged raptor with sharp talons, hooked beak, feathered wings, and keen forward-facing eyes",
  "Falcon": "Winged raptor with streamlined body, sharp talons, hooked beak, and incredible speed",
  "Hawk": "Winged raptor with broad wings, sharp talons, hooked beak, and excellent hunting vision",
  "Owl": "Winged nocturnal bird with forward-facing eyes, silent flight feathers, sharp talons, and rotating head",
  
  // Other Birds
  "Raven": "Winged corvid with black feathers, sharp beak, intelligent eyes, and grasping talons",
  "Parrot": "Winged bird with curved beak, colorful plumage, zygodactyl feet, and vocal mimicry ability",
  "Penguin": "Flightless bird with flipper-like wings, webbed feet, waterproof feathers, and upright waddle",
  "Hummingbird": "Tiny winged bird with iridescent feathers, long beak, rapid wing beats, and hovering flight",
  
  // Marine Mammals
  "Dolphin": "Sleek marine mammal with streamlined body, dorsal fin, flippers, and a playful intelligence",
  "Orca": "Marine mammal with black and white coloring, dorsal fin, powerful tail flukes, and intelligent mind",
  
  // Fish & Aquatic
  "Shark": "Streamlined predator with dorsal fin, powerful tail, rows of teeth, and gill slits",
  "Sea Turtle": "Marine reptile with hard shell, flippers, streamlined body, and ancient lineage",
  
  // Cephalopods
  "Octopus": "Eight-armed cephalopod with soft body, intelligent eyes, color-changing skin, and beak",
  "Kraken": "Massive legendary cephalopod with multiple tentacles, large mantle, powerful beak, and ocean dominance",
  
  // Equines
  "Unicorn": "Four-legged equine with single spiraling horn, flowing mane and tail, and graceful hooves",
  "Pegasus": "Winged equine with four legs, feathered wings, flowing mane and tail, and hooves",
  "Horse (Stallion)": "Four-legged equine with powerful muscular build, flowing mane and tail, and strong hooves",
  
  // Mythical Fire/Sky
  "Phoenix": "Mythic bird with fiery plumage, long tail feathers, powerful wings, and a crest of flame",
  "Dragon": "Winged reptilian with four legs, scales, horns, long tail, and wings emerging from shoulder blades",
  "Gryphon": "Hybrid with eagle head and wings, lion body and legs, sharp talons, and a long tail",
  
  // Serpentine & Reptiles
  "Snake": "Legless reptile with long sinuous body, scales, forked tongue, and flexible spine",
  "Basilisk": "Mythical serpent with lethal gaze, crowned head, serpentine body, and venomous nature",
  
  // Multi-headed Mythicals
  "Hydra": "Multi-headed serpentine dragon with regenerating heads, long necks, scales, and aquatic adaptation",
  
  // Sea Monsters
  "Leviathan": "Colossal sea serpent with massive scaled body, powerful tail, ancient presence, and ocean supremacy",
  
  // Marsupials & Unique
  "Kangaroo": "Bipedal marsupial with powerful hind legs, long tail for balance, pouch, and hopping locomotion",
  "Sloth": "Four-limbed mammal with long curved claws, shaggy fur, slow deliberate movements, and tree-dwelling nature",
  
  // Mystical Canines
  "Kitsune": "Magical fox spirit with multiple tails, shapeshifting ability, mystical fire, and ancient wisdom",
  
  // Other Mammals
  "Stag": "Four-legged cervine with branching antlers, powerful legs, hooves, and graceful posture",
  
  // Invertebrates
  "Jellyfish": "Marine invertebrate with translucent bell, trailing tentacles, and graceful pulsing movement",
  "Butterfly": "Winged insect with four colorful wings, slender body, antennae, and delicate flight",
  
  // Amphibians
  "Salamander": "Four-legged amphibian with long tail, moist skin, delicate limbs, and regenerative abilities",
  
  // Dinosaurs
  "T-Rex": "Bipedal dinosaur with massive jaws, tiny arms, powerful tail for balance, and thick scales",
  "Velociraptor": "Bipedal dinosaur with sickle claws, feathered body, long tail, and pack intelligence",
  "Mammoth": "Four-legged prehistoric elephant with long curved tusks, thick fur, and massive size"
};

const getSpeciesTraits = (creature: string): string => {
  return SPECIES_TRAITS[creature] || `A ${creature.toLowerCase()} with its natural anatomical structure and movement patterns`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companionId, stage, tonePreference = 'heroic', themeIntensity = 'moderate' } = await req.json();

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

    // Get companion details
    const { data: companion, error: companionError } = await supabaseClient
      .from('user_companion')
      .select('*')
      .eq('id', companionId)
      .single();

    if (companionError || !companion) throw new Error('Companion not found');
    if (companion.user_id !== user.id) throw new Error('Unauthorized');

    // Get user profile for personality and goals
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('onboarding_data')
      .eq('id', user.id)
      .single();

    const onboardingData = profile?.onboarding_data || {};
    const userGoal = onboardingData.userGoal || "achieving personal growth";
    const userPersonality = onboardingData.userPersonality || "determined";
    const creaturePersonality = onboardingData.creaturePersonality || "loyal and brave";

    // Get previous chapter for memory notes
    let memoryNotes = "This is the beginning of your journey.";
    if (stage > 0) {
      const { data: prevStory } = await supabaseClient
        .from('companion_stories')
        .select('main_story, lore_expansion')
        .eq('companion_id', companionId)
        .eq('stage', stage - 1)
        .maybeSingle();

      if (prevStory) {
        // Extract key details from previous chapter for continuity
        const loreItems = Array.isArray(prevStory.lore_expansion) ? prevStory.lore_expansion : [];
        const lastSentence = prevStory.main_story?.split('.').slice(-2, -1)[0] || '';
        memoryNotes = `Previous chapter: ${lastSentence}. ${loreItems.slice(0, 2).join(' ')}`;
      }
    }

    const speciesTraits = getSpeciesTraits(companion.spirit_animal);

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
- User Name: ${user.email?.split('@')[0] || 'Hero'}
- Creature Species: ${companion.spirit_animal}
- Species Traits: ${speciesTraits}
- Element: ${companion.core_element}
- Primary Color: ${companion.favorite_color}
- Secondary Color: ${companion.fur_color || companion.favorite_color}
- Eye Color: ${companion.eye_color || `glowing ${companion.favorite_color}`}
- Creature Personality: ${creaturePersonality}
- User Personality: ${userPersonality}
- User Goal: ${userGoal}
- Evolution Stage: ${stage} (${EVOLUTION_THEMES[stage]})
- Tone: ${tonePreference}
- Theme Intensity: ${themeIntensity}
- Memory Notes: ${memoryNotes}

STRUCTURE FOR EACH CHAPTER:

1. **Chapter Title**
   One cinematic, emotionally charged title aligned with the evolution stage theme.

2. **Intro Line (1–2 sentences)**
   A bold opening that instantly sets the mood and tone for this chapter.

3. **Main Story (250–400 words)**
   The chapter must:
   • reflect the evolution stage theme (${EVOLUTION_THEMES[stage]})
   ${stage === 0 ? '• establish the ORIGIN: describe the creature as newly formed, vulnerable, taking its first breath in this world\n   • introduce the first meeting between user and creature - a fateful encounter\n   • set the tone for a legendary journey about to begin' : ''}
   ${stage === 1 ? '• build DIRECTLY from Stage 0: the creature from the origin chapter is now awakening to its true potential\n   • reference specific details from the Stage 0 origin story\n   • show the first signs of growth and power emerging' : ''}
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
       ∙ Stages 15–20: cosmic/titanic threats
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
        max_tokens: 2500,
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
        lore_expansion: storyData.lore_expansion,
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
