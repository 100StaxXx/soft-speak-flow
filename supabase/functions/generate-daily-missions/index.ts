import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PromptBuilder } from "../_shared/promptBuilder.ts";
import { OutputValidator } from "../_shared/outputValidator.ts";
import { checkRateLimit, RATE_LIMITS, createRateLimitResponse } from "../_shared/rateLimiter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeneratedMission {
  mission: string;
  xp: number;
  category: string;
  difficulty?: string;
}

const CATEGORY_GUIDELINES = `**MISSION STRUCTURE:**
Include exactly 1 mission from each category:

1. **Connection Mission** ("good human day" - kindness/gratitude)
   - Text a friend/family and check in
   - Send someone a compliment
   - Thank someone for something small
   - Reach out to someone you haven't spoken to
   - Tell someone you appreciate them

2. **Quick Win** (momentum/confidence builder)
   - Do one thing you've been avoiding for less than 5 minutes
   - Finish one tiny task right now
   - Complete the easiest to-do item first
   - Organize your home screen for 2 minutes

3. **Identity Mission** (supports habits/discipline)
   - Complete all your habits today
   - Do something your future self will thank you for
   - Give yourself a 2-minute discipline burst`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { userId, forceRegenerate = false } = await req.json();
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting check
    const rateLimit = await checkRateLimit(supabase, userId, 'daily-missions', RATE_LIMITS['daily-missions']);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit, corsHeaders);
    }

    const today = new Date().toLocaleDateString('en-CA');

    // Check if missions already exist for today
    const { data: existing } = await supabase
      .from('daily_missions')
      .select('*')
      .eq('user_id', userId)
      .eq('mission_date', today);

    if (existing && existing.length > 0 && !forceRegenerate) {
      return new Response(
        JSON.stringify({ missions: existing, generated: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's profile for context
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_habit_streak')
      .eq('id', userId)
      .maybeSingle();

    const streak = profile?.current_habit_streak || 0;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log(`Generating AI missions for user ${userId} (streak: ${streak})`);

    // Build personalized prompt using template system
    const promptBuilder = new PromptBuilder(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const userContext = streak > 0 
      ? `Make them personal and encouraging, acknowledging their ${streak} day streak.`
      : 'Make them encouraging to help build momentum.';

    const { systemPrompt, userPrompt, validationRules, outputConstraints } = await promptBuilder.build({
      templateKey: 'daily_missions',
      userId: userId,
      variables: {
        missionCount: 3,
        userStreak: streak,
        userContext,
        categoryGuidelines: CATEGORY_GUIDELINES
      }
    });

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.9,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`Failed to generate missions with AI: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const generatedText = aiData.choices[0].message.content;
    
    console.log('AI response:', generatedText);

    // Parse AI response
    let missions: GeneratedMission[];
    try {
      const cleanedText = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      missions = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', generatedText);
      throw new Error('Invalid AI response format');
    }

    // Validate output
    const validator = new OutputValidator(validationRules, outputConstraints);
    const validationResult = validator.validate(missions);

    // Log validation results
    const responseTime = Date.now() - startTime;
    await supabase
      .from('ai_output_validation_log')
      .insert({
        user_id: userId,
        template_key: 'daily_missions',
        input_data: { streak, userContext },
        output_data: { missions },
        validation_passed: validationResult.isValid,
        validation_errors: validationResult.errors && validationResult.errors.length > 0 ? validationResult.errors : null,
        model_used: 'google/gemini-2.5-flash',
        response_time_ms: responseTime
      });

    if (!validationResult.isValid) {
      console.error('Validation failed:', validator.getValidationSummary(validationResult));
      throw new Error(`Mission validation failed: ${validationResult.errors.join(', ')}`);
    }

    console.log('Parsed missions:', missions);

    // Map to database format
    const missionsToInsert = missions.map((m) => ({
      user_id: userId,
      mission_date: today,
      mission_text: m.mission,
      mission_type: m.category || 'general',
      category: m.category || 'general',
      xp_reward: m.xp || 10,
      difficulty: m.difficulty || 'medium',
      auto_complete: false,
      completed: false,
      progress_target: 1,
      progress_current: 0,
      is_bonus: false,
    }));

    // Insert missions with conflict handling to prevent race condition duplicates
    // Uses unique index on (user_id, mission_date, category)
    const { error: insertError } = await supabase
      .from('daily_missions')
      .upsert(missionsToInsert, { 
        onConflict: 'user_id,mission_date,category',
        ignoreDuplicates: true 
      });

    if (insertError) {
      console.error('Error inserting missions:', insertError);
      throw insertError;
    }

    // Fetch the actual missions (in case some were skipped due to conflict)
    const { data: created, error: fetchError } = await supabase
      .from('daily_missions')
      .select('*')
      .eq('user_id', userId)
      .eq('mission_date', today);

    if (fetchError) {
      console.error('Error fetching missions:', fetchError);
      throw fetchError;
    }

    console.log(`Generated ${created?.length || 0} missions for user ${userId}`);

    return new Response(
      JSON.stringify({ missions: created, generated: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating missions:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
