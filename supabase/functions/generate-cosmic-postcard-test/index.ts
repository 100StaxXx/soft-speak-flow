import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    { name: "Halcyon Reef", description: "An ocean of floating coral clusters drifting in low gravity, teeming with stellar fish", tags: ['aquatic'] },
    { name: "Star Lantern Marsh", description: "Floating star-orbs drifting over misty cosmic wetlands with glowing lily pads", tags: ['aquatic', 'land'] },
  ],
  50: [
    { name: "Quantum Falls", description: "A waterfall of pure shimmering energy cascading across dimensions, rainbow light refracting everywhere", tags: ['aquatic', 'all'] },
    { name: "Stellar Archipelago", description: "A chain of floating islands orbiting a warm dwarf sun, connected by light bridges", tags: ['flying', 'land'] },
    { name: "The Mirror Sea", description: "A perfect silver ocean reflecting infinite galaxies, calm and impossibly beautiful", tags: ['aquatic'] },
    { name: "Phosphor Woods", description: "Glowing teal forests on a twilight-locked planet, mushrooms pulsing with soft light", tags: ['land'] },
    { name: "Symphony Ridge", description: "Floating mountains that emit musical harmonics, resonating with the cosmos", tags: ['flying', 'mythic'] },
  ],
  75: [
    { name: "Dragon Nebula Core", description: "A star-forge shaped like a colossal cosmic dragon, where new stars are forged in fire", tags: ['mythic', 'flying'] },
    { name: "Chrono Spire", description: "A spiraling ancient tower at the event horizon of a black hole where time flows like honey", tags: ['mythic'] },
    { name: "The Singing Rings", description: "Vast planetary rings vibrating with celestial sound and harmonic frequencies", tags: ['flying', 'all'] },
    { name: "Void Blossom Garden", description: "Light-flowers blooming in total intergalactic darkness, each petal a tiny star", tags: ['all'] },
    { name: "Cosmic Whale Graveyard", description: "Ancient giant astral whale skeletons drifting in silence, hauntingly beautiful", tags: ['aquatic', 'mythic'] },
  ],
  100: [
    { name: "Galactic Throne", description: "A luminous seat of starlight at the galaxy's heart, surrounded by a crown of a million stars", tags: ['mythic'] },
    { name: "Genesis Point", description: "Where new universes spark into existence, reality shimmering with infinite possibility", tags: ['mythic', 'all'] },
    { name: "Cosmic Apex", description: "The highest cosmic peak overlooking all reality, where you can see the entire universe", tags: ['flying', 'land'] },
    { name: "Eternal Dawn", description: "Where the universe's first light endlessly rises, golden and magnificent forever", tags: ['all'] },
    { name: "The Ascendant Sea", description: "A massive ocean made of liquid cosmic consciousness, shimmering with wisdom", tags: ['aquatic', 'mythic'] },
  ],
};

// Determine species type from spirit animal
function getSpeciesType(spiritAnimal: string): SpeciesTag {
  const animal = spiritAnimal?.toLowerCase() || '';
  
  if (['whale', 'dolphin', 'shark', 'fish', 'octopus', 'jellyfish', 'seahorse', 'turtle', 'seal', 'otter', 'penguin'].some(a => animal.includes(a))) {
    return 'aquatic';
  }
  
  if (['eagle', 'hawk', 'owl', 'phoenix', 'dragon', 'butterfly', 'hummingbird', 'raven', 'falcon', 'dove', 'swan', 'bat'].some(a => animal.includes(a))) {
    return 'flying';
  }
  
  if (['unicorn', 'griffin', 'chimera', 'sphinx', 'basilisk', 'hydra', 'cerberus', 'pegasus'].some(a => animal.includes(a))) {
    return 'mythic';
  }
  
  return 'land';
}

// Select a location weighted by species compatibility
function selectLocation(locations: CosmicLocation[], speciesType: SpeciesTag): CosmicLocation {
  const compatibleLocations = locations.filter(loc => 
    !loc.tags || loc.tags.length === 0 || loc.tags.includes(speciesType) || loc.tags.includes('all')
  );
  
  const pool = compatibleLocations.length > 0 ? compatibleLocations : locations;
  return pool[Math.floor(Math.random() * pool.length)];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { milestonePercent, sourceImageUrl, companionData } = await req.json();

    if (!sourceImageUrl || !milestonePercent) {
      throw new Error("Missing required fields: sourceImageUrl, milestonePercent");
    }

    console.log(`[Cosmic Postcard Test] Starting for milestone ${milestonePercent}%`);

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!OPENAI_API_KEY) {
      throw new Error("Missing OPENAI_API_KEY environment variable");
    }

    const spiritAnimal = companionData?.spirit_animal || 'wolf';
    const coreElement = companionData?.core_element || 'fire';
    const favoriteColor = companionData?.favorite_color || '#FF6B35';
    const eyeColor = companionData?.eye_color || '#FFD700';
    const furColor = companionData?.fur_color || '#8B4513';

    // Determine species type for location matching
    const speciesType = getSpeciesType(spiritAnimal);
    console.log(`[Cosmic Postcard Test] Species type: ${speciesType}`);

    // Select location weighted by species compatibility
    const tierLocations = cosmicLocations[milestonePercent as keyof typeof cosmicLocations] || cosmicLocations[25];
    const location = selectLocation(tierLocations, speciesType);

    console.log(`[Cosmic Postcard Test] Selected location: ${location.name}`);

    // Build image editing prompt that preserves exact companion appearance
    const editPrompt = `Place this EXACT companion creature into a cosmic postcard scene.

LOCATION: ${location.name} - ${location.description}

CRITICAL - PRESERVE COMPLETELY (DO NOT CHANGE):
- The creature's EXACT appearance, species (${spiritAnimal}), face shape, and body structure
- ALL colors, markings, and patterns (especially ${favoriteColor} tones)
- Eye color (${eyeColor}) and facial features
- Fur/scale color (${furColor}) and texture
- The art style and quality of the original image
- The creature's proportions and silhouette
- Any unique characteristics or accessories

CREATE THE SCENE:
- Place the companion naturally within ${location.name}
- Add appropriate cosmic background elements: ${location.description}
- Maintain the companion as the clear focal point (roughly 40-50% of the image)
- Use cinematic lighting that complements both the companion and the cosmic setting
- Add subtle sparkles, cosmic dust, and ethereal ${coreElement} energy effects
- Create a 4:3 landscape aspect ratio, postcard-style composition
- The scene should feel like a treasured travel memory or vacation photo

OUTPUT: A beautiful cosmic postcard showing THIS EXACT companion visiting ${location.name}. The companion must be immediately recognizable as the same creature from the input image - like they actually traveled there.`;

    console.log('[Cosmic Postcard Test] Calling Gemini image edit API...');

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
              { type: "text", text: editPrompt },
              { type: "image_url", image_url: { url: sourceImageUrl } },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Cosmic Postcard Test] AI API error:', response.status, errorText);
      
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
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error('[Cosmic Postcard Test] No image in response');
      throw new Error("Failed to generate image - no image URL in response");
    }

    console.log('[Cosmic Postcard Test] Image generated successfully');

    const caption = `Greetings from ${location.name}! 🌟 ${milestonePercent}% milestone reached!`;

    return new Response(
      JSON.stringify({ 
        success: true, 
        imageUrl,
        locationName: location.name,
        locationDescription: location.description,
        caption,
        milestonePercent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Cosmic Postcard Test] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
