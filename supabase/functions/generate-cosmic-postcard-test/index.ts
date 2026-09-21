import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminOrServiceRoleAuth } from "../_shared/auth.ts";
import { checkRateLimit, createRateLimitResponse, RATE_LIMITS } from "../_shared/rateLimiter.ts";
import {
  buildCosmicPostcardImagePrompt,
  getPostcardSpeciesType,
  resolvePostcardTier,
  selectDeterministicPostcardLocation,
  type PostcardLocation,
} from "../_shared/cosmicPostcard.ts";
import { editCompanionImage } from "../_shared/openaiCompanionImageClient.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type CosmicLocation = PostcardLocation;

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireAdminOrServiceRoleAuth(req, corsHeaders);
    if (auth instanceof Response) {
      return auth;
    }

    const { milestonePercent, sourceImageUrl, companionData } = await req.json();

    if (!sourceImageUrl || !milestonePercent) {
      throw new Error("Missing required fields: sourceImageUrl, milestonePercent");
    }

    if (!auth.isServiceRole) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );
      const rateLimit = await checkRateLimit(
        supabase,
        auth.userId,
        'generate-cosmic-postcard-test',
        RATE_LIMITS['generate-cosmic-postcard-test'],
      );

      if (!rateLimit.allowed) {
        return createRateLimitResponse(rateLimit, corsHeaders);
      }
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
    const speciesType = getPostcardSpeciesType(spiritAnimal);
    console.log(`[Cosmic Postcard Test] Species type: ${speciesType}`);

    // Select location weighted by species compatibility
    const tierLocations = cosmicLocations[resolvePostcardTier(Number(milestonePercent))];
    const location = selectDeterministicPostcardLocation({
      locations: tierLocations,
      speciesType,
      seed: `${auth.userId}:${sourceImageUrl}:${milestonePercent}`,
    });

    console.log(`[Cosmic Postcard Test] Selected location: ${location.name}`);

    // Build image editing prompt that preserves exact companion appearance
    const editPrompt = buildCosmicPostcardImagePrompt({
      location,
      companion: {
        spiritAnimal,
        coreElement,
        favoriteColor,
        eyeColor,
        furColor,
      },
    });

    console.log('[Cosmic Postcard Test] Calling high-fidelity companion image edit API...');
    const imageResult = await editCompanionImage({
      guardedFetch: fetch,
      openAIApiKey: OPENAI_API_KEY,
      prompt: editPrompt,
      size: "1536x1024",
      quality: "high",
      outputFormat: "png",
      userId: auth.userId,
      referenceImages: [{ imageUrl: sourceImageUrl }],
    });
    const imageUrl = imageResult.imageDataUrl;

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
