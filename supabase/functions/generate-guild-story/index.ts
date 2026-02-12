import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompanionData {
  user_id: string;
  user_name: string;
  spirit_animal: string;
  core_element: string;
  mind: number;
  body: number;
  soul: number;
  eye_color: string;
  fur_color: string;
  current_stage: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // Verify the JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authUser) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { epicId } = await req.json();
    const userId = authUser.id; // Use authenticated user ID, not from request body

    if (!epicId) {
      throw new Error("epicId is required");
    }

    console.log("Generating guild story for epic:", epicId, "by user:", userId);

    // Verify user is a member of this epic
    const { data: membership } = await supabase
      .from('epic_members')
      .select('*')
      .eq('epic_id', epicId)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      const { data: epicOwner } = await supabase
        .from('epics')
        .select('user_id')
        .eq('id', epicId)
        .single();

      if (epicOwner?.user_id !== userId) {
        throw new Error("User is not a member of this epic");
      }
    }

    // Rate limit check: 1 manual story per 24 hours per guild
    const { data: recentStories } = await supabase
      .from('guild_stories')
      .select('*')
      .eq('epic_id', epicId)
      .eq('trigger_type', 'manual')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (recentStories && recentStories.length > 0) {
      throw new Error("A story was already generated in the last 24 hours. Please wait before creating another.");
    }

    // Fetch epic details
    const { data: epic } = await supabase
      .from('epics')
      .select('*')
      .eq('id', epicId)
      .single();

    if (!epic) {
      throw new Error("Epic not found");
    }

    // Fetch all guild members and their companions
    const { data: members } = await supabase
      .from('epic_members')
      .select(`
        user_id,
        profiles!inner(email)
      `)
      .eq('epic_id', epicId);

    if (!members || members.length < 2) {
      throw new Error("Guild must have at least 2 members to generate a collaborative story");
    }

    // Fetch companions for all members
    const memberIds = members.map(m => m.user_id);
    const { data: companions } = await supabase
      .from('user_companion')
      .select('*')
      .in('user_id', memberIds);

    if (!companions || companions.length === 0) {
      throw new Error("No companions found for guild members");
    }

    // Build companion data array and validate all members have companions
    const companionData: CompanionData[] = [];
    const membersWithoutCompanions: string[] = [];

    // Helper to get display name from email
    const getDisplayName = (email: string | null): string => {
      if (!email) return 'Adventurer';
      return email.split('@')[0];
    };

    // Helper to convert hex color to readable name
    const hexToColorName = (hex: string | null): string => {
      if (!hex || !hex.startsWith('#')) return hex || 'unknown';
      const colorMap: Record<string, string> = {
        '#000000': 'black', '#ffffff': 'white', '#ff0000': 'red', '#00ff00': 'green',
        '#0000ff': 'blue', '#ffff00': 'yellow', '#ff00ff': 'magenta', '#00ffff': 'cyan',
        '#ffa500': 'orange', '#800080': 'purple', '#ffc0cb': 'pink', '#a52a2a': 'brown',
        '#808080': 'gray', '#c0c0c0': 'silver', '#ffd700': 'gold', '#f5f5dc': 'beige',
        '#9333ea': 'violet', '#22c55e': 'emerald', '#3b82f6': 'sapphire', '#ef4444': 'crimson',
        '#f97316': 'amber', '#eab308': 'golden', '#14b8a6': 'teal', '#8b5cf6': 'amethyst',
      };
      const lower = hex.toLowerCase();
      if (colorMap[lower]) return colorMap[lower];
      // Approximate color based on RGB values
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      if (r > 200 && g > 200 && b > 200) return 'pale';
      if (r < 50 && g < 50 && b < 50) return 'dark';
      if (r > g && r > b) return r > 200 ? 'bright red' : 'deep red';
      if (g > r && g > b) return g > 200 ? 'bright green' : 'forest green';
      if (b > r && b > g) return b > 200 ? 'sky blue' : 'deep blue';
      if (r > 150 && g > 100 && b < 100) return 'golden';
      if (r > 150 && b > 150 && g < 100) return 'purple';
      return 'unique';
    };

    for (const member of members) {
      const companion = companions.find(c => c.user_id === member.user_id);
      const profilesData = member.profiles as unknown as { email: string | null }[] | { email: string | null } | null;
      const memberEmail: string | null = Array.isArray(profilesData) ? (profilesData[0]?.email ?? null) : (profilesData?.email ?? null);
      
      if (!companion) {
        membersWithoutCompanions.push(getDisplayName(memberEmail));
        continue;
      }
      
      companionData.push({
        user_id: companion.user_id,
        user_name: getDisplayName(memberEmail),
        spirit_animal: companion.spirit_animal || 'Unknown',
        core_element: companion.core_element || 'None',
        mind: companion.mind || 0,
        body: companion.body || 0,
        soul: companion.soul || 0,
        eye_color: hexToColorName(companion.eye_color),
        fur_color: hexToColorName(companion.fur_color),
        current_stage: companion.current_stage || 0
      });
    }

    // Ensure all members have companions
    if (membersWithoutCompanions.length > 0) {
      throw new Error(
        `Some guild members don't have companions yet: ${membersWithoutCompanions.join(', ')}. ` +
        `All members need a companion to generate a guild story.`
      );
    }

    // Get chapter number (count existing stories + 1)
    const { count } = await supabase
      .from('guild_stories')
      .select('*', { count: 'exact', head: true })
      .eq('epic_id', epicId);

    const chapterNumber = (count || 0) + 1;

    // Build AI prompt
    const companionDescriptions = companionData.map((c, idx) => `
${idx + 1}. ${c.spirit_animal} (${c.core_element} Element) - Stage ${c.current_stage}
   Owner: ${c.user_name}
   Attributes: Mind ${c.mind}, Body ${c.body}, Soul ${c.soul}
   Appearance: ${c.eye_color} eyes, ${c.fur_color} fur/feathers/scales
   Power Level: ${c.current_stage < 5 ? 'Emerging' : c.current_stage < 10 ? 'Growing' : c.current_stage < 15 ? 'Powerful' : 'Legendary'}
`).join('\n');

    const prompt = `You are GUILD STORY ENGINE — generating epic collaborative adventures featuring multiple companions from different users, all part of the same guild.

GUILD: ${epic.title}
GUILD GOAL: ${epic.description || 'Unite and grow together'}
THEME: ${epic.theme_color || 'heroic'}

COMPANIONS IN THIS ADVENTURE:
${companionDescriptions}

CHAPTER: ${chapterNumber === 1 ? 'First Meeting' : `Chapter ${chapterNumber}`}

STORY REQUIREMENTS:
• Feature ALL companions playing meaningful roles based on their species and element
• Create dynamic interactions between different species and elements
• Highlight how different powers/attributes complement each other
• Give each companion at least one moment to shine based on their strengths
• Build toward a shared climax that requires teamwork from all companions
• End with a lesson about unity, growth, and collective strength
• Keep the tone ${epic.theme_color === 'warrior' ? 'bold and action-packed' : epic.theme_color === 'mystic' ? 'mysterious and magical' : epic.theme_color === 'nature' ? 'harmonious and natural' : 'heroic and inspiring'}

Generate a collaborative story in this EXACT JSON format:
{
  "chapter_title": "An engaging chapter title",
  "intro_line": "A captivating opening line that sets the scene",
  "main_story": "The full narrative (800-1200 words) featuring all companions working together. Use vivid descriptions and show each companion's personality through their actions.",
  "climax_moment": "The pivotal moment where all companions unite their powers",
  "bond_lesson": "The wisdom gained from this shared experience",
  "next_hook": "A teaser for the next chapter",
  "companion_spotlights": [
    {
      "user_id": "uuid",
      "companion_name": "species name",
      "role_played": "Brief description of their heroic contribution"
    }
  ]
}`;

    console.log("Calling OpenAI for story generation...");

    // Call OpenAI
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a creative storytelling AI that generates collaborative adventures. Always respond with valid JSON matching the requested format.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.9,
        max_tokens: 3000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('OpenAI error:', aiResponse.status, errorText);
      throw new Error(`AI generation failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;

    console.log("AI response received, parsing...");

    // Parse JSON response
    let storyData;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      storyData = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Failed to parse AI-generated story');
    }

    // Validate required fields
    const requiredFields = [
      'chapter_title', 
      'intro_line', 
      'main_story',
      'climax_moment', 
      'bond_lesson', 
      'companion_spotlights'
    ];

    for (const field of requiredFields) {
      if (!storyData[field]) {
        console.error('Missing field in AI response:', field, storyData);
        throw new Error(`AI generated incomplete story (missing ${field}). Please try again.`);
      }
    }

    // Validate types
    if (!Array.isArray(storyData.companion_spotlights)) {
      console.warn('companion_spotlights is not an array, converting:', storyData.companion_spotlights);
      storyData.companion_spotlights = [];
    }

    // Validate story length (800-1200 words ≈ 1000-6000 chars)
    const storyLength = storyData.main_story.length;
    if (storyLength < 1000) {
      console.warn('Story too short:', storyLength, 'chars');
      throw new Error('Generated story is too short. Please try again.');
    }
    if (storyLength > 10000) {
      console.warn('Story too long:', storyLength, 'chars');
      throw new Error('Generated story is too long. Please try again.');
    }

    console.log(`Story validated successfully: ${storyLength} chars, ${storyData.companion_spotlights.length} companion spotlights`);

    // Insert guild story into database
    const { data: insertedStory, error: insertError } = await supabase
      .from('guild_stories')
      .insert({
        epic_id: epicId,
        chapter_number: chapterNumber,
        chapter_title: storyData.chapter_title,
        intro_line: storyData.intro_line,
        main_story: storyData.main_story,
        companion_spotlights: storyData.companion_spotlights,
        climax_moment: storyData.climax_moment,
        bond_lesson: storyData.bond_lesson,
        next_hook: storyData.next_hook,
        trigger_type: 'manual',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw insertError;
    }

    console.log("Guild story generated successfully:", insertedStory.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        story: insertedStory 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in generate-guild-story:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});