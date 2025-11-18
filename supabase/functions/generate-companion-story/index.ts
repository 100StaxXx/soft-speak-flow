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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companionId, stage, tonePreference = 'heroic' } = await req.json();

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

    // Build the story generation prompt
    const storyPrompt = `You are the Story Engine for a mythic coming-of-age adventure series.
Generate a single chapter for the user based on their creature, evolution stage, element, colors, personality, and life goal.

USER VARIABLES:
- User Name: ${user.email?.split('@')[0] || 'Hero'}
- Creature: ${companion.spirit_animal}
- Element: ${companion.core_element}
- Primary Color: ${companion.favorite_color}
- Eye Color: ${companion.eye_color || `glowing ${companion.favorite_color}`}
- Fur/Skin Color: ${companion.fur_color || companion.favorite_color}
- Creature Personality: ${creaturePersonality}
- User Personality: ${userPersonality}
- User Goal: ${userGoal}
- Evolution Stage: ${stage} (${EVOLUTION_THEMES[stage]})
- Tone Preference: ${tonePreference}

CRITICAL RULES:
- NEVER alter the creature's biological structure (${companion.spirit_animal} stays a ${companion.spirit_animal})
- Keep elemental visuals consistent with ${companion.core_element}
- Reference colors subtly: ${companion.favorite_color}, ${companion.eye_color}
- Make it feel like an anime x RPG x mythic epic hybrid
- The creature's growth reflects the user's growth toward "${userGoal}"
- Each chapter must feel like the SAME creature evolving through all 21 stages

STRUCTURE (respond ONLY in valid JSON):
{
  "chapter_title": "One powerful cinematic title matching stage ${stage}",
  "intro_line": "Bold 1-2 sentence dramatic opener",
  "main_story": "250-400 word story reflecting ${EVOLUTION_THEMES[stage]} theme, emotional bond, obstacles, visuals, and user's goal",
  "bond_moment": "1-2 sentence focused emotional connection moment",
  "life_lesson": "1-2 sentence grounded metaphorical lesson tied to ${userGoal}",
  "lore_expansion": ["3-7 bullet points of world-building, legends, prophecies, elemental lore"],
  "next_hook": "1-2 sentence cliffhanger leading to stage ${stage + 1 <= 20 ? stage + 1 : stage}"
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
            content: 'You are a master storyteller creating personalized mythic adventures. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: storyPrompt
          }
        ],
        temperature: 0.8,
        max_tokens: 2000,
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
