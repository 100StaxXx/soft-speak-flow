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
    const { userId, companionId, epicId, milestonePercent } = await req.json();

    if (!userId || !companionId || !milestonePercent) {
      throw new Error("Missing required fields: userId, companionId, milestonePercent");
    }

    console.log(`[Cosmic Postcard] Starting for user ${userId}, companion ${companionId}, milestone ${milestonePercent}%`);

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

    // Select random location for this milestone tier
    const locations = cosmicLocations[milestonePercent as keyof typeof cosmicLocations] || cosmicLocations[25];
    const location = locations[Math.floor(Math.random() * locations.length)];

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
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
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

    // Generate a caption
    const caption = `Greetings from ${location.name}! 🌟 ${milestonePercent}% milestone reached!`;

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
        image_url: permanentImageUrl,
        caption: caption,
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
