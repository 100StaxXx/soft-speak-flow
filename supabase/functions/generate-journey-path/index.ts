import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { epicId, milestoneIndex, userId } = await req.json();
    
    console.log(`[generate-journey-path] Starting for epic ${epicId}, milestone ${milestoneIndex}`);

    if (!epicId || milestoneIndex === undefined || !userId) {
      throw new Error("Missing required parameters: epicId, milestoneIndex, userId");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if path already exists for this milestone
    const { data: existingPath } = await supabase
      .from('epic_journey_paths')
      .select('id, image_url')
      .eq('epic_id', epicId)
      .eq('milestone_index', milestoneIndex)
      .single();

    if (existingPath) {
      console.log(`[generate-journey-path] Path already exists for milestone ${milestoneIndex}`);
      return new Response(JSON.stringify({ 
        success: true, 
        existing: true,
        imageUrl: existingPath.image_url 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch epic details with story_seed
    const { data: epic, error: epicError } = await supabase
      .from('epics')
      .select('id, title, story_type_slug, theme_color, story_seed')
      .eq('id', epicId)
      .single();

    if (epicError || !epic) {
      console.error('[generate-journey-path] Epic fetch error:', epicError);
      throw new Error("Failed to fetch epic details");
    }

    // Fetch companion details
    const { data: companion } = await supabase
      .from('user_companion')
      .select('spirit_animal, core_element, favorite_color')
      .eq('user_id', userId)
      .single();

    // Parse story_seed for world context
    let worldContext = {
      worldName: "a mystical realm",
      worldEra: "an ancient time",
      currentLocation: "the beginning of the path",
      nextLocation: "mysteries ahead",
    };

    if (epic.story_seed) {
      const storySeed = typeof epic.story_seed === 'string' 
        ? JSON.parse(epic.story_seed) 
        : epic.story_seed;
      
      if (storySeed.story_universe) {
        worldContext.worldName = storySeed.story_universe.world_name || worldContext.worldName;
        worldContext.worldEra = storySeed.story_universe.world_era || worldContext.worldEra;
      }

      // Get location context based on milestone index
      if (storySeed.chapter_blueprints && Array.isArray(storySeed.chapter_blueprints)) {
        const chapters = storySeed.chapter_blueprints;
        
        if (milestoneIndex === 0) {
          // Initial path - use world intro and first chapter location
          if (chapters[0]) {
            worldContext.nextLocation = chapters[0].location_name || chapters[0].title || "the first waypoint";
          }
        } else {
          // After milestone - show previous location behind, next ahead
          const prevChapter = chapters[milestoneIndex - 1];
          const nextChapter = chapters[milestoneIndex];
          
          if (prevChapter) {
            worldContext.currentLocation = prevChapter.location_name || prevChapter.title || "a conquered realm";
          }
          if (nextChapter) {
            worldContext.nextLocation = nextChapter.location_name || nextChapter.title || "the path ahead";
          }
        }
      }
    }

    // Build the image generation prompt
    const companionType = companion?.spirit_animal || "mystical creature";
    const coreElement = companion?.core_element || "cosmic";
    const themeColor = epic.theme_color || "purple";
    
    // Map story types to visual themes
    const storyThemes: Record<string, string> = {
      'treasure_hunt': 'ancient ruins, hidden treasures, mysterious caves',
      'heroes_journey': 'epic landscapes, dramatic cliffs, heroic vistas',
      'pilgrimage': 'sacred temples, serene paths, spiritual energy',
      'exploration': 'uncharted territories, wild nature, discovery',
      'rescue_mission': 'dangerous terrain, urgent atmosphere, dramatic lighting',
      'mystery': 'fog-shrouded paths, enigmatic structures, ethereal glow',
    };
    
    const visualTheme = storyThemes[epic.story_type_slug || ''] || 'cosmic fantasy landscapes';

    const prompt = `A beautiful panoramic walk path through ${worldContext.worldName} in ${worldContext.worldEra}. 
The path leads from ${worldContext.currentLocation} towards ${worldContext.nextLocation}. 
Visual theme: ${visualTheme}.
The path should be suitable for a ${companionType} companion with ${coreElement} energy walking alongside.
Color palette: ${themeColor} tones with cosmic accents.
Style: ethereal fantasy illustration, dreamy atmosphere, horizontal landscape format, magical lighting, no text or characters visible.
Ultra high resolution.`;

    console.log(`[generate-journey-path] Generated prompt: ${prompt.substring(0, 200)}...`);

    // Call OpenAI to generate the image
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        modalities: ["image", "text"]
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[generate-journey-path] AI API error:', errorText);
      throw new Error(`AI generation failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('[generate-journey-path] AI response received');

    // Extract the base64 image from the response
    const imageData = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageData) {
      console.error('[generate-journey-path] No image in response:', JSON.stringify(aiData).substring(0, 500));
      throw new Error("No image generated");
    }

    // Convert base64 to blob and upload to storage
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    const fileName = `${epicId}/${milestoneIndex}_${Date.now()}.png`;
    
    const { error: uploadError } = await supabase.storage
      .from('journey-paths')
      .upload(fileName, imageBytes, {
        contentType: 'image/png',
        upsert: true
      });

    if (uploadError) {
      console.error('[generate-journey-path] Upload error:', uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('journey-paths')
      .getPublicUrl(fileName);

    const imageUrl = urlData.publicUrl;
    console.log(`[generate-journey-path] Image uploaded: ${imageUrl}`);

    // Store in database
    const { error: insertError } = await supabase
      .from('epic_journey_paths')
      .upsert({
        epic_id: epicId,
        user_id: userId,
        milestone_index: milestoneIndex,
        image_url: imageUrl,
        prompt_context: {
          worldContext,
          companionType,
          coreElement,
          themeColor,
          storyType: epic.story_type_slug,
        },
        generated_at: new Date().toISOString(),
      }, {
        onConflict: 'epic_id,milestone_index'
      });

    if (insertError) {
      console.error('[generate-journey-path] Database insert error:', insertError);
      // Don't throw - image is already uploaded and usable
    }

    console.log(`[generate-journey-path] Successfully generated path for milestone ${milestoneIndex}`);

    return new Response(JSON.stringify({ 
      success: true, 
      imageUrl,
      milestoneIndex,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to generate journey path";
    console.error('[generate-journey-path] Error:', error);
    return new Response(JSON.stringify({ 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
