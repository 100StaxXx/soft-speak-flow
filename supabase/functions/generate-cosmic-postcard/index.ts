import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cosmic locations organized by milestone tier
const cosmicLocations = {
  25: [
    { name: "Nebula Gardens", description: "A swirling nursery of newborn stars, where cosmic dust paints the void in purple and gold" },
    { name: "Crystal Moon", description: "An ice moon with towering crystal formations reflecting starlight in rainbow hues" },
    { name: "Aurora Valley", description: "A mystical valley where dancing auroras cascade from twin suns" },
    { name: "Comet's Tail", description: "Riding the brilliant tail of an ancient comet as it streaks through the cosmos" },
  ],
  50: [
    { name: "Quantum Falls", description: "A waterfall of pure energy cascading between dimensions, shimmering with possibility" },
    { name: "Stellar Archipelago", description: "A chain of floating islands orbiting a gentle dwarf star" },
    { name: "The Mirror Sea", description: "An ocean of liquid silver reflecting infinite galaxies above" },
    { name: "Phosphor Woods", description: "A bioluminescent forest on a tidally locked world, eternally twilit" },
  ],
  75: [
    { name: "Dragon Nebula Core", description: "The fiery heart of a dragon-shaped nebula, where stars are forged" },
    { name: "Chrono Spire", description: "An ancient tower at the edge of a black hole where time flows like honey" },
    { name: "The Singing Rings", description: "Saturn-like rings that resonate with cosmic harmonies" },
    { name: "Void Blossom Garden", description: "Flowers of pure light blooming in the absolute darkness between galaxies" },
  ],
  100: [
    { name: "Galactic Throne", description: "The radiant center of the galaxy, surrounded by a crown of a million stars" },
    { name: "Genesis Point", description: "The mythical origin of all creation, where reality shimmers into existence" },
    { name: "Cosmic Apex", description: "The highest peak of the universe, overlooking the tapestry of all existence" },
    { name: "Eternal Dawn", description: "A place where the first light of creation still glows, timeless and magnificent" },
  ],
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, companionId, epicId, milestonePercent, companionData } = await req.json();

    if (!userId || !companionId || !milestonePercent) {
      throw new Error("Missing required fields: userId, companionId, milestonePercent");
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if postcard already exists for this milestone
    const { data: existingPostcard } = await supabase
      .from('companion_postcards')
      .select('id')
      .eq('user_id', userId)
      .eq('epic_id', epicId)
      .eq('milestone_percent', milestonePercent)
      .single();

    if (existingPostcard) {
      console.log('Postcard already exists for this milestone');
      return new Response(
        JSON.stringify({ success: true, message: 'Postcard already exists', existing: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Select random location for this milestone tier
    const locations = cosmicLocations[milestonePercent as keyof typeof cosmicLocations] || cosmicLocations[25];
    const location = locations[Math.floor(Math.random() * locations.length)];

    // Build the image generation prompt
    const { spirit_animal, favorite_color, core_element, eye_color, fur_color } = companionData || {};
    
    const prompt = `Create a breathtaking cosmic postcard illustration featuring a ${favorite_color || 'mystical'} ${spirit_animal || 'companion creature'} with ${eye_color || 'glowing'} eyes and ${fur_color || 'ethereal'} fur/coloring, element: ${core_element || 'cosmic'}.

Location: ${location.name} - ${location.description}

Style: Dreamy fantasy art, painterly style with rich colors and magical atmosphere. The creature should be the focal point, appearing majestic and at peace in this cosmic setting. Include subtle sparkles, cosmic dust, and ethereal lighting. The scene should feel like a treasured memory or a postcard from an incredible journey.

Aspect ratio: 4:3 landscape orientation. High detail, cinematic lighting.`;

    console.log('Generating postcard with prompt:', prompt);

    // Generate image via Lovable AI
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
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
      throw new Error("Failed to generate image - no image URL in response");
    }

    // Generate a caption
    const caption = `${companionData?.spirit_animal || 'Your companion'} at ${location.name} - ${milestonePercent}% milestone reached!`;

    // Save postcard to database
    const { data: postcard, error: insertError } = await supabase
      .from('companion_postcards')
      .insert({
        user_id: userId,
        companion_id: companionId,
        epic_id: epicId,
        milestone_percent: milestonePercent,
        location_name: location.name,
        location_description: location.description,
        image_url: imageUrl,
        caption: caption,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error saving postcard:', insertError);
      throw new Error(`Failed to save postcard: ${insertError.message}`);
    }

    console.log('Postcard generated successfully:', postcard.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        postcard: {
          id: postcard.id,
          location_name: location.name,
          location_description: location.description,
          image_url: imageUrl,
          caption: caption,
          milestone_percent: milestonePercent,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating cosmic postcard:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
