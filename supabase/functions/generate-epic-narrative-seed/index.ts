import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mentorNarrativeProfiles, getMentorNarrativeProfile } from "../_shared/mentorNarrativeProfiles.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Character archetypes with generation guidance
const ARCHETYPE_TEMPLATES = {
  wanderer: {
    role: 'Mysterious guide who appears at crossroads',
    arc: 'Seeking redemption for past mistakes → Reveals hidden connection to hero\'s destiny',
    traits: ['cryptic', 'knowledgeable', 'haunted by past'],
  },
  rival: {
    role: 'Competitive spirit who challenges the hero',
    arc: 'From antagonist → grudging respect → eventual ally',
    traits: ['proud', 'skilled', 'secretly insecure'],
  },
  lost_one: {
    role: 'Broken soul the hero helps heal',
    arc: 'Closed off → slowly opens up → finds hope through hero',
    traits: ['withdrawn', 'talented but damaged', 'loyal once trust earned'],
  },
  trickster: {
    role: 'Comic relief with hidden depths',
    arc: 'Jokes hide pain → serious moment reveals why → finds authentic joy',
    traits: ['witty', 'evasive', 'surprisingly wise'],
  },
  guardian: {
    role: 'Protective figure who must learn to let go',
    arc: 'Overprotective → learns to trust hero → steps back proudly',
    traits: ['caring', 'cautious', 'struggles with control'],
  },
  echo: {
    role: 'Reflection of hero\'s potential dark path',
    arc: 'Shows what hero could become → serves as warning or is saved',
    traits: ['mirror to hero', 'tragic', 'pivotal choice'],
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      userId, 
      epicId,
      epicTitle,
      epicDescription,
      targetDays,
      storyTypeSlug,
      companionData,
      mentorData,
      userGoal,
      totalChapters: passedTotalChapters, // Explicit chapter count from milestones
      milestoneData, // Array of { chapterNumber, title, targetDate, milestonePercent }
    } = await req.json();

    if (!userId || !epicId || !storyTypeSlug) {
      throw new Error("Missing required fields");
    }

    console.log(`[Narrative Seed] Generating for epic ${epicId}, story type: ${storyTypeSlug}, chapters: ${passedTotalChapters}`);

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch story type details (for theme/flavor, not chapter count)
    const { data: storyType, error: storyTypeError } = await supabase
      .from('epic_story_types')
      .select('*')
      .eq('slug', storyTypeSlug)
      .single();

    if (storyTypeError || !storyType) {
      throw new Error(`Story type not found: ${storyTypeSlug}`);
    }

    // Use passed chapter count from milestones, fallback to story type base if not provided
    const totalChapters = passedTotalChapters || (storyType.base_chapters + (targetDays >= 30 ? 1 : 0));

    // Select 2-3 character archetypes for this story
    const archetypeKeys = Object.keys(ARCHETYPE_TEMPLATES);
    const shuffled = archetypeKeys.sort(() => Math.random() - 0.5);
    const selectedArchetypes = shuffled.slice(0, Math.min(3, totalChapters - 1));

    const archetypeDescriptions = selectedArchetypes.map(key => {
      const template = ARCHETYPE_TEMPLATES[key as keyof typeof ARCHETYPE_TEMPLATES];
      return `${key.toUpperCase()}: ${template.role}. Arc: ${template.arc}. Traits: ${template.traits.join(', ')}.`;
    }).join('\n');

    // Get mentor narrative profile
    const mentorSlug = mentorData?.slug || 'eli';
    const mentorProfile = getMentorNarrativeProfile(mentorSlug) || mentorNarrativeProfiles.eli;

    // Build milestone schedule for the prompt
    let milestoneSchedule = '';
    if (milestoneData && Array.isArray(milestoneData) && milestoneData.length > 0) {
      milestoneSchedule = `
═══════════════════════════════════════════════════════════════════
                     CHAPTER MILESTONE SCHEDULE
═══════════════════════════════════════════════════════════════════
Each chapter corresponds to a real-world milestone the user will achieve:
${milestoneData.map(m => `Chapter ${m.chapterNumber}: "${m.title}" - Target Date: ${m.targetDate} (${m.milestonePercent}% progress)`).join('\n')}

IMPORTANT: Each chapter_blueprint must align with these milestone dates and titles.
The narrative should reflect the progress and achievement at each checkpoint.
`;
    }

    // Build the master prompt with rich mentor context
    const prompt = `You are COSMIC STORYTELLER — a master narrative architect creating an interconnected epic journey.

STORY TYPE: ${storyType.name}
STORY DESCRIPTION: ${storyType.description}
TOTAL CHAPTERS: ${totalChapters}
EPIC TITLE: ${epicTitle}
EPIC DESCRIPTION: ${epicDescription || 'A personal journey of growth'}
USER'S REAL-LIFE GOAL: ${userGoal || 'Self-improvement and personal growth'}
${milestoneSchedule}

═══════════════════════════════════════════════════════════════════
                         THE COMPANION
═══════════════════════════════════════════════════════════════════
- Species: ${companionData?.spirit_animal || 'Cosmic creature'}
- Element: ${companionData?.core_element || 'Starlight'}
- Colors: ${companionData?.favorite_color || 'Cosmic purple'}, ${companionData?.fur_color || 'silver'}
- Personality: Loyal companion who evolves alongside the hero

═══════════════════════════════════════════════════════════════════
                     THE GUIDING VOICE: ${mentorProfile.name}
═══════════════════════════════════════════════════════════════════
MENTOR NAME: ${mentorProfile.name}
MENTOR ROLE: ${mentorProfile.storyRole}
MENTOR'S NARRATIVE VOICE: ${mentorProfile.narrativeVoice}
MENTOR'S SPEECH PATTERNS:
${mentorProfile.speechPatterns.map(p => `  - ${p}`).join('\n')}
MENTOR'S WISDOM STYLE: ${mentorProfile.wisdomStyle}
MENTOR'S STORY APPEARANCE: ${mentorProfile.storyAppearance}
MENTOR'S FINALE ROLE: ${mentorProfile.finaleRole}

EXAMPLE MENTOR DIALOGUE (study these to capture their voice):
${mentorProfile.exampleDialogue.map(d => `  ${d}`).join('\n')}

THE MENTOR AS CHARACTER:
- The mentor appears as a guiding presence in the hero's cosmic journey
- They observe, comment, and occasionally intervene at critical moments  
- Their wisdom reflects their unique perspective and style
- They have their own arc: from distant guide → trusted companion → respected equal
- Each chapter should include a "mentor wisdom moment" in their authentic voice

CHARACTER ARCHETYPES TO INCLUDE:
${archetypeDescriptions}

BOSS TEMPLATE:
- Name Pattern: ${storyType.boss_name_template}
- Theme: ${storyType.boss_theme}
- Lore Base: ${storyType.boss_lore_template}

Generate a complete STORY SEED — the invisible architecture that will make this journey unforgettable.

CRITICAL REQUIREMENTS:
1. Each character must have a UNIQUE name, voice, and memorable catchphrase
2. Characters must appear across multiple chapters with developing arcs
3. The prophecy must have ${totalChapters} cryptic lines that only make sense at the end
4. Each chapter must plant seeds for future chapters
5. The boss must be foreshadowed throughout
6. The mentor appears to offer wisdom at key moments
7. The recurring symbol must grow in significance

Return ONLY valid JSON (no markdown):
{
  "book_title": "A compelling title that hints at the journey",
  
  "the_great_mystery": {
    "question": "The central question driving the plot",
    "false_answer": "What the user will initially believe",
    "true_answer": "The twist revealed at the finale",
    "why_it_matters": "How this connects to user's real-life goal"
  },
  
  "the_prophecy": {
    "full_text": "4-${totalChapters} lines of cryptic verse (one per chapter), each on new line",
    "line_meanings": ["What each line actually means - hidden from user"],
    "when_revealed": [1, 2, 3, ...chapter numbers when each line is spoken]
  },
  
  "the_recurring_symbol": {
    "object": "A specific object that appears throughout",
    "first_appearance": "How it's introduced (seemingly unimportant)",
    "growing_significance": "How it gains meaning",
    "final_revelation": "What it truly represents"
  },
  
  "the_ensemble_cast": [
    {
      "name": "Unique, memorable name",
      "archetype": "wanderer/rival/lost_one/trickster/guardian/echo",
      "species_and_appearance": "Vivid visual description",
      "speech_pattern": "How they talk distinctively",
      "catchphrase": "Their memorable repeated line",
      "their_secret": "What they're hiding",
      "arc": {
        "introduction": "How user meets them",
        "conflict": "The tension in their story",
        "growth": "How they change",
        "resolution": "Their ultimate fate"
      },
      "relationship_to_user": "How they see the protagonist",
      "appears_in_chapters": [1, 3, 5]
    }
  ],
  
  "chapter_blueprints": [
    {
      "chapter": 1,
      "title": "Evocative chapter title",
      "milestone_title": "The real-world milestone title this chapter unlocks at",
      "target_date": "YYYY-MM-DD from the milestone schedule",
      "milestone_percent": 25,
      "narrative_purpose": "What this chapter accomplishes",
      "opening_hook": "The attention-grabbing first scene",
      "featured_characters": ["Names of characters who appear"],
      "plot_advancement": "Key plot point",
      "character_moment": "Emotional beat with a side character",
      "symbol_appearance": "How the recurring symbol appears",
      "prophecy_seed": "Which prophecy line is seeded",
      "mystery_seed": "Question planted for later",
      "cliffhanger": "How it ends to pull reader forward",
      "mentor_wisdom": "A piece of wisdom the mentor shares"
    }
  ],
  
  "emotional_beats": {
    "wonder_moments": ["Scenes designed to inspire awe"],
    "heartbreak_moments": ["Scenes designed for emotional impact"],
    "triumph_moments": ["Scenes of victory and achievement"],
    "laughter_moments": ["Scenes for levity"],
    "growth_mirrors": ["How companion's growth mirrors user's journey"]
  },
  
  "mentor_arc": {
    "mentor_id": "${mentorData?.id || ''}",
    "mentor_name": "${mentorData?.name || 'The Guide'}",
    "introduction_scene": "How mentor first appears in the story",
    "wisdom_moments": ["Key wisdom shared at each appearance"],
    "finale_role": "How mentor helps in the final confrontation"
  },
  
  "finale_architecture": {
    "boss_name": "Full boss name based on template",
    "boss_theme": "${storyType.boss_theme}",
    "boss_lore": "Expanded lore connecting to the story",
    "boss_weakness_hint": "A hint about how to defeat them",
    "the_cost": "What must be sacrificed for victory",
    "the_twist": "The revelation that recontextualizes everything",
    "the_callback": "How early details pay off",
    "the_resolution": "How each character's arc concludes",
    "the_new_beginning": "How this ending opens a new chapter in life"
  }
}`;

    console.log('[Narrative Seed] Calling AI...');

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a master storyteller. Return only valid JSON, no markdown formatting." },
          { role: "user", content: prompt }
        ],
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Narrative Seed] AI error:', response.status, errorText);
      
      // Handle rate limiting and payment errors
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI generation failed: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Clean markdown if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let storySeed;
    try {
      storySeed = JSON.parse(content);
    } catch (parseError) {
      console.error('[Narrative Seed] JSON parse error:', parseError);
      console.error('[Narrative Seed] Raw content:', content.substring(0, 500));
      throw new Error("Failed to parse story seed JSON");
    }

    console.log('[Narrative Seed] Generated story seed:', storySeed.book_title);

    // Save characters to database
    if (storySeed.the_ensemble_cast && Array.isArray(storySeed.the_ensemble_cast)) {
      for (const character of storySeed.the_ensemble_cast) {
        const { error: charError } = await supabase
          .from('story_characters')
          .insert({
            user_id: userId,
            name: character.name,
            species: character.species_and_appearance?.split(',')[0] || 'Unknown',
            archetype: character.archetype,
            visual_description: character.species_and_appearance,
            speech_pattern: character.speech_pattern,
            catchphrase: character.catchphrase,
            core_motivation: character.relationship_to_user,
            secret_shame: character.their_secret,
            backstory: character.arc?.introduction,
            current_goal: character.arc?.conflict,
            arc_stage: 'introduction',
            relationship_to_user: character.relationship_to_user,
            first_appeared_epic_id: epicId,
            first_appeared_chapter: character.appears_in_chapters?.[0] || 1,
          });

        if (charError) {
          console.error('[Narrative Seed] Error saving character:', charError);
        }
      }
    }

    // Update epic with story seed
    const { error: updateError } = await supabase
      .from('epics')
      .update({
        story_type_slug: storyTypeSlug,
        story_seed: storySeed,
        book_title: storySeed.book_title,
        total_chapters: totalChapters,
      })
      .eq('id', epicId);

    if (updateError) {
      console.error('[Narrative Seed] Error updating epic:', updateError);
      throw new Error(`Failed to update epic: ${updateError.message}`);
    }

    // Create/update mentor relationship
    const { error: mentorError } = await supabase
      .from('mentor_story_relationship')
      .upsert({
        user_id: userId,
        mentor_id: mentorData?.id || null,
        trust_level: 1,
        key_moments: [],
        wisdom_shared: storySeed.mentor_arc?.wisdom_moments || [],
      }, {
        onConflict: 'user_id',
      });

    if (mentorError) {
      console.error('[Narrative Seed] Error saving mentor relationship:', mentorError);
    }

    console.log(`[Narrative Seed] Successfully generated seed for "${storySeed.book_title}"`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        storySeed,
        totalChapters,
        bookTitle: storySeed.book_title,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Narrative Seed] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
