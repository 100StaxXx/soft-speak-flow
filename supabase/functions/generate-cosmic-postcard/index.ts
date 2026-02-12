import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mentorNarrativeProfiles, getMentorNarrativeProfile, type MentorNarrativeProfile } from "../_shared/mentorNarrativeProfiles.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Species type preferences for location matching
type SpeciesTag = 'aquatic' | 'flying' | 'land' | 'mythic' | 'all';

interface CosmicLocation {
  name: string;
  description: string;
  tags?: SpeciesTag[];
}

// Cosmic locations organized by milestone tier with species tags
const cosmicLocations: Record<number, CosmicLocation[]> = {
  25: [
    { name: "Nebula Gardens", description: "A swirling star nursery painted in purple and gold cosmic dust clouds, with newborn stars glittering within", tags: ['all'] },
    { name: "Crystal Moon", description: "A frozen moon with colossal radiant crystal towers reflecting starlight in rainbow hues", tags: ['land', 'flying'] },
    { name: "Aurora Valley", description: "Twin suns casting endless auroras over rolling violet fields of cosmic grass", tags: ['land'] },
    { name: "Comet's Tail Drift", description: "Riding glowing streams of comet dust through the vastness of space", tags: ['flying', 'mythic'] },
    { name: "The Luminous Prairie", description: "Galactic grasslands shimmering with bioluminescent petals under a canopy of stars", tags: ['land'] },
    { name: "Whispering Meteor Plains", description: "Flatlands dotted with ancient meteor shards that hum softly with cosmic energy", tags: ['land'] },
    { name: "Star Lantern Marsh", description: "Floating star-orbs drifting over misty cosmic wetlands with glowing lily pads", tags: ['aquatic', 'land'] },
    { name: "Velvet Cloud Terrace", description: "Soft, floating cloud islands glowing pink and lavender in eternal sunset light", tags: ['flying'] },
    { name: "Halcyon Reef", description: "An ocean of floating coral clusters drifting in low gravity, teeming with stellar fish", tags: ['aquatic'] },
    { name: "Sapphire Breeze Ridge", description: "A windy blue cliff world surrounded by drifting mini-moons and cosmic butterflies", tags: ['flying', 'land'] },
  ],
  50: [
    { name: "Quantum Falls", description: "A waterfall of pure shimmering energy cascading across dimensions, rainbow light refracting everywhere", tags: ['aquatic', 'all'] },
    { name: "Stellar Archipelago", description: "A chain of floating islands orbiting a warm dwarf sun, connected by light bridges", tags: ['flying', 'land'] },
    { name: "The Mirror Sea", description: "A perfect silver ocean reflecting infinite galaxies, calm and impossibly beautiful", tags: ['aquatic'] },
    { name: "Phosphor Woods", description: "Glowing teal forests on a twilight-locked planet, mushrooms pulsing with soft light", tags: ['land'] },
    { name: "Plasma Vine Canyon", description: "Vast red canyons wrapped in glowing plasma vines that pulse with energy", tags: ['land', 'flying'] },
    { name: "Titan Petal Desert", description: "Golden dunes where gigantic flower petals fall from the sky like gentle snow", tags: ['land'] },
    { name: "Symphony Ridge", description: "Floating mountains that emit musical harmonics, resonating with the cosmos", tags: ['flying', 'mythic'] },
    { name: "Ecliptic Lake", description: "A circular lake perfectly carved by orbital lines, its waters reflecting cosmic alignments", tags: ['aquatic', 'land'] },
    { name: "Astral Greenhouse", description: "A giant spherical biodome drifting through space, filled with alien flora", tags: ['all'] },
    { name: "Ion Orchard", description: "A grove of trees made from crackling electric arcs, sparking with gentle energy", tags: ['mythic', 'flying'] },
  ],
  75: [
    { name: "Dragon Nebula Core", description: "A star-forge shaped like a colossal cosmic dragon, where new stars are forged in fire", tags: ['mythic', 'flying'] },
    { name: "Chrono Spire", description: "A spiraling ancient tower at the event horizon of a black hole where time flows like honey", tags: ['mythic'] },
    { name: "The Singing Rings", description: "Vast planetary rings vibrating with celestial sound and harmonic frequencies", tags: ['flying', 'all'] },
    { name: "Void Blossom Garden", description: "Light-flowers blooming in total intergalactic darkness, each petal a tiny star", tags: ['all'] },
    { name: "Riftstep Plateau", description: "A stone mesa split by dimensional tears of blue fire, reality rippling at the edges", tags: ['land', 'mythic'] },
    { name: "Stormforge Citadel", description: "A floating fortress generating endless cosmic thunderstorms of purple lightning", tags: ['flying', 'mythic'] },
    { name: "Ember Star Wasteland", description: "A scorched world lit by a dying red giant's embers, beautiful in its twilight", tags: ['land'] },
    { name: "Glass Horizon Fields", description: "Miles of reflective glass plains catching starlight, each step creating ripples of light", tags: ['land'] },
    { name: "Aether Serpent Trench", description: "A deep canyon shaped by an invisible cosmic serpent, energy coiling through it", tags: ['aquatic', 'mythic'] },
    { name: "Cosmic Whale Graveyard", description: "Ancient giant astral whale skeletons drifting in silence, hauntingly beautiful", tags: ['aquatic', 'mythic'] },
  ],
  100: [
    // Grand/Transcendent locations
    { name: "Galactic Throne", description: "A luminous seat of starlight at the galaxy's heart, surrounded by a crown of a million stars", tags: ['mythic'] },
    { name: "Genesis Point", description: "Where new universes spark into existence, reality shimmering with infinite possibility", tags: ['mythic', 'all'] },
    { name: "Cosmic Apex", description: "The highest cosmic peak overlooking all reality, where you can see the entire universe", tags: ['flying', 'land'] },
    { name: "Eternal Dawn", description: "Where the universe's first light endlessly rises, golden and magnificent forever", tags: ['all'] },
    { name: "Halo of the First Star", description: "A radiant ringworld orbiting the first star ever born, ancient and sacred", tags: ['flying', 'mythic'] },
    { name: "Infinity Bridge", description: "A glowing walkway stretching infinitely through time, connecting all moments", tags: ['all'] },
    { name: "Celestial Crown Realm", description: "A cluster of golden star-crowns orbiting a brilliant white sun", tags: ['flying', 'mythic'] },
    { name: "The Prism Citadel", description: "A crystal palace refracting reality into colors unseen by mortal eyes", tags: ['mythic'] },
    { name: "Prime Singularity Gardens", description: "Tranquil gardens grown around stabilized black holes, gravity creating impossible beauty", tags: ['all'] },
    { name: "The Ascendant Sea", description: "A massive ocean made of liquid cosmic consciousness, shimmering with wisdom", tags: ['aquatic', 'mythic'] },
    // Cozy/Intimate alternatives for variety
    { name: "The Eternal Hearth", description: "A cozy cosmic cottage where stardust settles like snow and nebulas glow like firelight", tags: ['all'] },
    { name: "Starlight Sanctuary", description: "A peaceful garden where the gentlest stars come to rest, warm and welcoming", tags: ['all'] },
    { name: "The Dreamer's Alcove", description: "A soft hammock of woven starlight suspended in a pocket of peaceful cosmos", tags: ['all'] },
    { name: "Aurora's Embrace", description: "A warm valley where auroras wrap around you like a blanket of light", tags: ['land', 'all'] },
  ],
};

// Bonus pool of ultra-unique locations that can supplement any tier
const bonusLocations: CosmicLocation[] = [
  { name: "Neon Lotus Orbit", description: "Giant neon lotus flowers floating serenely in space, petals glowing pink and cyan", tags: ['aquatic', 'flying'] },
  { name: "Frostwave Cathedral", description: "A frozen temple echoing with time vibrations, ice pillars singing ancient songs", tags: ['land', 'mythic'] },
  { name: "Carbon Spire Expanse", description: "Jet-black obelisks rising from glowing sand, mysterious and majestic", tags: ['land'] },
  { name: "Aurora Coral Sanctuary", description: "Coral reefs made of pure aurora light, shifting colors constantly", tags: ['aquatic'] },
  { name: "Dustwind Monastery", description: "A silent monk temple on a drifting asteroid, peaceful and timeless", tags: ['land', 'flying'] },
  { name: "Sapphire Nebula Caverns", description: "Cave systems filled with glowing blue fog and crystalline formations", tags: ['land', 'aquatic'] },
  { name: "Ethereal Clockwork Plains", description: "Planet-sized gears turning beneath the ground, the machinery of time itself", tags: ['land', 'mythic'] },
  { name: "Sunforge Bridge", description: "A golden bridge suspended across two stars, warmth radiating from both sides", tags: ['flying'] },
  { name: "Shadow Pearl Archipelago", description: "Dark islands orbiting a pale moon, mysterious yet beautiful", tags: ['aquatic', 'land'] },
  { name: "The Living Constellation", description: "A land shaped from stars forming creatures, the sky come alive", tags: ['mythic', 'all'] },
  { name: "Featherfall Expanse", description: "Gravity-defying cosmic feathers raining gently from the sky", tags: ['flying'] },
  { name: "Dreamwave Hollow", description: "A valley where thoughts manifest as fog shapes, imagination made visible", tags: ['all'] },
  { name: "Hologram Wildlands", description: "Terrain constantly glitching into new beautiful forms, reality shifting", tags: ['mythic'] },
  { name: "The Spiral Observatory", description: "A floating stairway leading to a cosmic observatory among the stars", tags: ['flying', 'mythic'] },
  { name: "Riftfire Marsh", description: "Marshes lit by blue and pink dimension flames, otherworldly and serene", tags: ['aquatic', 'land'] },
  { name: "Starbreath Canyon", description: "A canyon exhaling starlight like warm fog, gentle and mystical", tags: ['land'] },
  { name: "Ion Prism Fields", description: "Rainbow polygons floating like flowers in low gravity, kaleidoscopic beauty", tags: ['flying', 'all'] },
  { name: "Golden Spore Woods", description: "Forest releasing glowing floating spores that drift like fireflies", tags: ['land'] },
  { name: "Skyvine Citadel", description: "A giant tree fortress reaching into space, roots in stars and branches in nebulas", tags: ['land', 'flying'] },
  { name: "Pulse Ocean", description: "A sea that beats with the heartbeat of the universe, rhythmic and alive", tags: ['aquatic'] },
];

// Determine species type from spirit animal
function getSpeciesType(spiritAnimal: string): SpeciesTag {
  const animal = spiritAnimal?.toLowerCase() || '';
  
  // Aquatic creatures
  if (['whale', 'dolphin', 'shark', 'fish', 'octopus', 'jellyfish', 'seahorse', 'turtle', 'seal', 'otter', 'penguin', 'ray', 'eel'].some(a => animal.includes(a))) {
    return 'aquatic';
  }
  
  // Flying creatures
  if (['eagle', 'hawk', 'owl', 'phoenix', 'dragon', 'butterfly', 'hummingbird', 'raven', 'crow', 'falcon', 'dove', 'swan', 'bat', 'moth', 'firefly', 'parrot', 'crane', 'heron'].some(a => animal.includes(a))) {
    return 'flying';
  }
  
  // Mythic creatures (that aren't primarily flying/aquatic)
  if (['unicorn', 'griffin', 'chimera', 'sphinx', 'basilisk', 'hydra', 'cerberus', 'pegasus', 'thunderbird'].some(a => animal.includes(a))) {
    return 'mythic';
  }
  
  // Default to land
  return 'land';
}

// Select a location weighted by species compatibility
function selectLocation(locations: CosmicLocation[], speciesType: SpeciesTag): CosmicLocation {
  // Filter to locations that match species type or are tagged 'all'
  const compatibleLocations = locations.filter(loc => 
    !loc.tags || loc.tags.length === 0 || loc.tags.includes(speciesType) || loc.tags.includes('all')
  );
  
  // If we have compatible locations, use those; otherwise fall back to all locations
  const pool = compatibleLocations.length > 0 ? compatibleLocations : locations;
  
  // 20% chance to include a bonus location for variety
  if (Math.random() < 0.2) {
    const compatibleBonus = bonusLocations.filter(loc => 
      !loc.tags || loc.tags.length === 0 || loc.tags.includes(speciesType) || loc.tags.includes('all')
    );
    if (compatibleBonus.length > 0) {
      return compatibleBonus[Math.floor(Math.random() * compatibleBonus.length)];
    }
  }
  
  return pool[Math.floor(Math.random() * pool.length)];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, companionId, epicId, milestonePercent, chapterNumber } = await req.json();

    if (!userId || !companionId || !milestonePercent) {
      throw new Error("Missing required fields: userId, companionId, milestonePercent");
    }

    console.log(`[Cosmic Postcard] Starting for user ${userId}, companion ${companionId}, milestone ${milestonePercent}%, chapter ${chapterNumber || 'N/A'}`);

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if postcard already exists for this milestone
    const { data: existingPostcard } = await supabase
      .from('companion_postcards')
      .select('id, image_url')
      .eq('user_id', userId)
      .eq('companion_id', companionId)
      .eq('epic_id', epicId)
      .eq('milestone_percent', milestonePercent)
      .maybeSingle();

    if (existingPostcard) {
      console.log('[Cosmic Postcard] Already exists for this milestone');
      return new Response(
        JSON.stringify({ success: true, postcard: existingPostcard, cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch companion's actual image from database
    const { data: companion, error: companionError } = await supabase
      .from('user_companion')
      .select('current_image_url, spirit_animal, core_element, favorite_color, eye_color, fur_color')
      .eq('id', companionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (companionError || !companion) {
      console.error('[Cosmic Postcard] Failed to fetch companion:', companionError);
      throw new Error("Companion not found");
    }

    if (!companion.current_image_url) {
      console.error('[Cosmic Postcard] Companion has no image');
      throw new Error("Companion has no image to use for postcard");
    }

    console.log(`[Cosmic Postcard] Using companion image for ${companion.spirit_animal}`);

    // Fetch epic with story_seed if epicId provided
    let storySeed: any = null;
    let chapterBlueprint: any = null;
    let epicData: any = null;
    
    if (epicId) {
      const { data: epic, error: epicError } = await supabase
        .from('epics')
        .select('story_seed, book_title, story_type_slug, total_chapters')
        .eq('id', epicId)
        .maybeSingle();
      
      if (!epicError && epic?.story_seed) {
        epicData = epic;
        storySeed = epic.story_seed;
        
        // Find the chapter blueprint for this chapter number
        if (chapterNumber && storySeed.chapter_blueprints) {
          chapterBlueprint = storySeed.chapter_blueprints.find(
            (cb: any) => cb.chapter === chapterNumber
          );
          console.log(`[Cosmic Postcard] Found chapter blueprint for chapter ${chapterNumber}`);
        }
      }
    }

    // Fetch user's mentor for narrative voice
    let mentorProfile: MentorNarrativeProfile | null = null;
    const { data: profile } = await supabase
      .from('profiles')
      .select('selected_mentor_id')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.selected_mentor_id) {
      const { data: mentor } = await supabase
        .from('mentors')
        .select('slug, name')
        .eq('id', profile.selected_mentor_id)
        .maybeSingle();
      
      if (mentor?.slug) {
        mentorProfile = getMentorNarrativeProfile(mentor.slug);
        console.log(`[Cosmic Postcard] Using mentor voice: ${mentor.name}`);
      }
    }

    // Default to Eli's nurturing voice if no mentor selected
    if (!mentorProfile) {
      mentorProfile = mentorNarrativeProfiles.eli;
    }
    const speciesType = getSpeciesType(companion.spirit_animal);
    console.log(`[Cosmic Postcard] Species type: ${speciesType}`);

    // Select location weighted by species compatibility
    const tierLocations = cosmicLocations[milestonePercent as keyof typeof cosmicLocations] || cosmicLocations[25];
    const location = selectLocation(tierLocations, speciesType);

    console.log(`[Cosmic Postcard] Selected location: ${location.name}`);

    // Build image editing prompt that preserves exact companion appearance
    const editPrompt = `Place this EXACT companion creature into a cosmic postcard scene.

LOCATION: ${location.name} - ${location.description}

CRITICAL - PRESERVE COMPLETELY (DO NOT CHANGE):
- The creature's EXACT appearance, species (${companion.spirit_animal}), face shape, and body structure
- ALL colors, markings, and patterns (especially ${companion.favorite_color} tones)
- Eye color (${companion.eye_color}) and facial features
- Fur/scale color (${companion.fur_color}) and texture
- The art style and quality of the original image
- The creature's proportions and silhouette
- Any unique characteristics or accessories

CREATE THE SCENE:
- Place the companion naturally within ${location.name}
- Add appropriate cosmic background elements: ${location.description}
- Maintain the companion as the clear focal point (roughly 40-50% of the image)
- Use cinematic lighting that complements both the companion and the cosmic setting
- Add subtle sparkles, cosmic dust, and ethereal ${companion.core_element} energy effects
- Create a 4:3 landscape aspect ratio, postcard-style composition
- The scene should feel like a treasured travel memory or vacation photo

OUTPUT: A beautiful cosmic postcard showing THIS EXACT companion visiting ${location.name}. The companion must be immediately recognizable as the same creature from the input image - like they actually traveled there.`;

    console.log('[Cosmic Postcard] Calling Gemini image edit API...');

    // Use Gemini's image editing (multimodal) to place companion in scene
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: editPrompt,
              },
              {
                type: "image_url",
                image_url: {
                  url: companion.current_image_url,
                },
              },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Cosmic Postcard] AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits required." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI generation failed: ${response.status}`);
    }

    const data = await response.json();
    const rawImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!rawImageUrl) {
      console.error('[Cosmic Postcard] No image in response:', JSON.stringify(data).substring(0, 500));
      throw new Error("Failed to generate image - no image URL in response");
    }

    console.log('[Cosmic Postcard] Image generated successfully');

    // Upload image to Supabase Storage for permanent storage
    let permanentImageUrl = rawImageUrl;
    if (rawImageUrl.startsWith('data:image')) {
      try {
        const base64Data = rawImageUrl.split(',')[1];
        const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const filePath = `postcards/${userId}/${companionId}_${milestonePercent}_${Date.now()}.png`;

        const { error: uploadError } = await supabase.storage
          .from('evolution-cards')
          .upload(filePath, binaryData, { contentType: 'image/png', upsert: true });

        if (uploadError) {
          console.error('[Cosmic Postcard] Storage upload error:', uploadError);
          // Fall back to raw URL if upload fails
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('evolution-cards')
            .getPublicUrl(filePath);
          permanentImageUrl = publicUrl;
          console.log('[Cosmic Postcard] Uploaded to storage');
        }
      } catch (uploadErr) {
        console.error('[Cosmic Postcard] Error uploading image:', uploadErr);
        // Continue with raw URL as fallback
      }
    }

    // Generate caption and narrative content
    let caption = `Greetings from ${location.name}! 🌟 ${milestonePercent}% milestone reached!`;
    let chapterTitle: string | null = null;
    let storyContent: string | null = null;
    let clueText: string | null = null;
    let prophecyLine: string | null = null;
    let charactersFeatured: string[] | null = null;
    let seedsPlanted: string[] | null = null;
    let isFinale = milestonePercent === 100;

    // Generate full chapter story content if we have blueprint and mentor voice
    if (chapterBlueprint && mentorProfile) {
      chapterTitle = chapterBlueprint.title || null;
      charactersFeatured = chapterBlueprint.featured_characters || null;
      clueText = chapterBlueprint.mystery_seed || null;
      seedsPlanted = chapterBlueprint.prophecy_seed ? [chapterBlueprint.prophecy_seed] : null;
      
      // Get prophecy line for this chapter
      if (storySeed?.the_prophecy?.when_revealed && storySeed?.the_prophecy?.full_text) {
        const prophecyLines = storySeed.the_prophecy.full_text.split('\n').filter((l: string) => l.trim());
        const lineIndex = storySeed.the_prophecy.when_revealed.indexOf(chapterNumber);
        if (lineIndex >= 0 && prophecyLines[lineIndex]) {
          prophecyLine = prophecyLines[lineIndex];
        }
      }

      // Generate full chapter story content with mentor voice
      const chapterPrompt = `You are writing Chapter ${chapterNumber} of an epic narrative journey.

═══════════════════════════════════════════════════════════════════
                     NARRATOR'S VOICE: ${mentorProfile.name}
═══════════════════════════════════════════════════════════════════
You MUST write this chapter in ${mentorProfile.name}'s distinctive narrative voice:
- Narrative Style: ${mentorProfile.narrativeVoice}
- Speech Patterns: ${mentorProfile.speechPatterns.join('; ')}
- Wisdom Style: ${mentorProfile.wisdomStyle}

Example of ${mentorProfile.name}'s voice:
${mentorProfile.exampleDialogue[0]}

The mentor appears as: ${mentorProfile.storyAppearance}

═══════════════════════════════════════════════════════════════════
                         CHAPTER DETAILS
═══════════════════════════════════════════════════════════════════
CHAPTER NUMBER: ${chapterNumber}
CHAPTER TITLE: ${chapterBlueprint.title || 'Untitled'}
LOCATION: ${location.name} - ${location.description}
NARRATIVE PURPOSE: ${chapterBlueprint.narrative_purpose || 'Advance the journey'}
OPENING HOOK: ${chapterBlueprint.opening_hook || 'A new discovery awaits'}
PLOT ADVANCEMENT: ${chapterBlueprint.plot_advancement || 'Move toward the goal'}

COMPANION:
- Species: ${companion.spirit_animal}
- Element: ${companion.core_element}
- This is their loyal companion who travels with them

FEATURED CHARACTERS: ${(chapterBlueprint.featured_characters || []).join(', ') || 'None'}
MENTOR WISDOM TO INCLUDE: ${chapterBlueprint.mentor_wisdom || 'A piece of guidance'}
CLIFFHANGER: ${chapterBlueprint.cliffhanger || 'Leave them wanting more'}

${isFinale ? 'THIS IS THE FINALE CHAPTER - Make it epic and conclusive!' : ''}

Write a compelling 200-300 word chapter that:
1. Opens with the hook scene at ${location.name}
2. Features the companion prominently
3. Includes a moment where ${mentorProfile.name} offers wisdom IN THEIR AUTHENTIC VOICE
4. Advances the plot naturally
5. Ends with the cliffhanger or resolution

Return ONLY the story content - no JSON, no formatting markers, just the narrative text.`;

      console.log('[Cosmic Postcard] Generating chapter content with mentor voice...');
      
      const storyResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: `You are a master storyteller writing in ${mentorProfile.name}'s narrative voice. Every sentence should feel like ${mentorProfile.name} is telling the story.` },
            { role: "user", content: chapterPrompt }
          ],
        }),
      });

      if (storyResponse.ok) {
        const storyData = await storyResponse.json();
        const generatedStory = storyData.choices?.[0]?.message?.content;
        if (generatedStory) {
          storyContent = generatedStory.trim();
          console.log('[Cosmic Postcard] Generated chapter story content');
        }
      } else {
        // Fallback to blueprint opening hook
        storyContent = chapterBlueprint.opening_hook || null;
        console.log('[Cosmic Postcard] Using blueprint opening hook as fallback');
      }
      
      // Enhanced caption with chapter info
      caption = `Chapter ${chapterNumber}: ${chapterTitle || location.name} 🌟`;
    } else if (chapterBlueprint) {
      // No mentor but have blueprint - use opening hook
      chapterTitle = chapterBlueprint.title || null;
      storyContent = chapterBlueprint.opening_hook || null;
      clueText = chapterBlueprint.mystery_seed || null;
      charactersFeatured = chapterBlueprint.featured_characters || null;
      seedsPlanted = chapterBlueprint.prophecy_seed ? [chapterBlueprint.prophecy_seed] : null;
      
      if (storySeed?.the_prophecy?.when_revealed && storySeed?.the_prophecy?.full_text) {
        const prophecyLines = storySeed.the_prophecy.full_text.split('\n').filter((l: string) => l.trim());
        const lineIndex = storySeed.the_prophecy.when_revealed.indexOf(chapterNumber);
        if (lineIndex >= 0 && prophecyLines[lineIndex]) {
          prophecyLine = prophecyLines[lineIndex];
        }
      }
      
      caption = `Chapter ${chapterNumber}: ${chapterTitle || location.name} 🌟`;
    }

    // Save postcard to database with narrative fields
    const { data: postcard, error: insertError } = await supabase
      .from('companion_postcards')
      .insert({
        user_id: userId,
        companion_id: companionId,
        epic_id: epicId,
        milestone_percent: milestonePercent,
        chapter_number: chapterNumber || null,
        chapter_title: chapterTitle,
        location_name: location.name,
        location_description: location.description,
        image_url: permanentImageUrl,
        caption: caption,
        story_content: storyContent,
        clue_text: clueText,
        prophecy_line: prophecyLine,
        characters_featured: charactersFeatured,
        seeds_planted: seedsPlanted,
        is_finale: isFinale,
        location_revealed: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Cosmic Postcard] Error saving postcard:', insertError);
      throw new Error(`Failed to save postcard: ${insertError.message}`);
    }

    console.log(`[Cosmic Postcard] Successfully created postcard ${postcard.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        postcard: {
          id: postcard.id,
          location_name: location.name,
          location_description: location.description,
          image_url: permanentImageUrl,
          caption: caption,
          milestone_percent: milestonePercent,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Cosmic Postcard] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
