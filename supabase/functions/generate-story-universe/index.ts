import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, companionData, mentorData } = await req.json();

    if (!userId) {
      throw new Error('userId is required');
    }

    // Check if user already has a story universe
    const { data: existingUniverse } = await supabase
      .from('story_universe')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingUniverse) {
      return new Response(
        JSON.stringify({ success: true, message: 'Universe already exists', universeId: existingUniverse.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate story universe using AI
    const UNIVERSE_PROMPT = `You are a master world-builder creating a persistent story universe for a gamified self-improvement app.

═══════════════════════════════════════════════════════════════════
                     THE PROTAGONIST
═══════════════════════════════════════════════════════════════════
COMPANION: ${companionData?.species || 'A mystical creature'} (${companionData?.element || 'cosmic'} element)
COMPANION COLORS: ${companionData?.furColor || 'starlight'} with ${companionData?.eyeColor || 'celestial'} eyes
STORY TONE: ${companionData?.storyTone || 'epic adventure'}
MENTOR: ${mentorData?.name || 'A wise guide'}

═══════════════════════════════════════════════════════════════════
                     GENERATE THE UNIVERSE
═══════════════════════════════════════════════════════════════════
Create a unique, persistent story universe that will serve as the backdrop for ALL this user's future adventures.

Generate a JSON object with:

{
  "world_name": "A unique, evocative name for this cosmic realm",
  "world_era": "The current age/era of this world (e.g., 'The Age of Awakening', 'The Era of Starlight')",
  "prophecy_fragments": [
    "3-5 cryptic prophecy fragments that hint at the user's destiny",
    "These will be referenced across multiple adventures"
  ],
  "active_mysteries": [
    "2-3 ongoing mysteries in this world that haven't been solved yet",
    "These create continuity across adventures"
  ],
  "foreshadowing_seeds": [
    "3-5 seeds of future plot points that can be woven into stories",
    "Names, places, or events that hint at things to come"
  ],
  "memorable_moments": [],
  "running_callbacks": [
    "2-3 world-building elements that can be referenced repeatedly",
    "Locations, legends, or sayings unique to this world"
  ]
}

Make the universe feel alive, mysterious, and personal to this user's companion and mentor. The prophecy should subtly connect to themes of growth, transformation, and overcoming challenges.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a creative world-builder. Always respond with valid JSON only, no markdown.' },
          { role: 'user', content: UNIVERSE_PROMPT }
        ],
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI generation failed: ${response.status}`);
    }

    const aiResult = await response.json();
    let universeData;
    
    try {
      const content = aiResult.choices[0].message.content;
      // Clean JSON from potential markdown
      const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
      universeData = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Fallback universe
      universeData = {
        world_name: "The Astral Expanse",
        world_era: "The Age of Awakening",
        prophecy_fragments: [
          "When the starlight fades, a new guardian shall rise",
          "The bond between soul and companion unlocks hidden paths",
          "Through trials of shadow, the true self emerges"
        ],
        active_mysteries: [
          "The origin of the celestial storms",
          "The lost temple of the First Guardians"
        ],
        foreshadowing_seeds: [
          "The Whispering Nebula holds ancient secrets",
          "The Council of Stars watches in silence",
          "A forgotten name echoes through the void"
        ],
        memorable_moments: [],
        running_callbacks: [
          "The saying: 'As the stars guide, so does the heart'",
          "The legend of the Wandering Light"
        ]
      };
    }

    // Insert the story universe
    const { data: newUniverse, error: insertError } = await supabase
      .from('story_universe')
      .insert({
        user_id: userId,
        world_name: universeData.world_name,
        world_era: universeData.world_era,
        prophecy_fragments: universeData.prophecy_fragments || [],
        active_mysteries: universeData.active_mysteries || [],
        resolved_mysteries: [],
        foreshadowing_seeds: universeData.foreshadowing_seeds || [],
        memorable_moments: universeData.memorable_moments || [],
        running_callbacks: universeData.running_callbacks || [],
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting story universe:', insertError);
      throw insertError;
    }

    console.log(`Story universe created for user ${userId}: ${universeData.world_name}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        universe: newUniverse,
        worldName: universeData.world_name 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-story-universe:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate story universe' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
