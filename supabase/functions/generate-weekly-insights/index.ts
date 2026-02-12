import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { PromptBuilder } from "../_shared/promptBuilder.ts";
import { OutputValidator } from "../_shared/outputValidator.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

const WeeklyInsightsSchema = z.object({
  userId: z.string().uuid(),
  weeklyData: z.object({
    habitCount: z.number().int().min(0),
    checkInCount: z.number().int().min(0),
    moodCount: z.number().int().min(0),
    activities: z.array(z.any()).max(100)
  })
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);
  const startTime = Date.now();

  try {
    const body = await req.json();
    const validation = WeeklyInsightsSchema.safeParse(body);
    
    if (!validation.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input', 
          details: validation.error.errors 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId, weeklyData } = validation.data;
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user's mentor
    const { data: profile } = await supabase
      .from('profiles')
      .select('selected_mentor_id')
      .eq('id', userId)
      .maybeSingle()

    if (!profile?.selected_mentor_id) {
      throw new Error('No mentor selected')
    }

    const { data: mentor } = await supabase
      .from('mentors')
      .select('name, tone_description')
      .eq('id', profile.selected_mentor_id)
      .maybeSingle()

    if (!mentor) throw new Error('Mentor not found')

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAIApiKey) throw new Error('OPENAI_API_KEY not configured')

    // Build personalized prompt using template system
    const promptBuilder = new PromptBuilder(supabaseUrl, supabaseKey);

    const activitiesSummary = weeklyData.activities.slice(0, 10)
      .map((a: any) => `${a.type}: ${JSON.stringify(a.data)}`)
      .join('\n');

    const { systemPrompt, userPrompt, validationRules, outputConstraints } = await promptBuilder.build({
      templateKey: 'weekly_insights',
      userId,
      variables: {
        mentorName: mentor.name,
        mentorTone: mentor.tone_description,
        habitCount: weeklyData.habitCount,
        checkInCount: weeklyData.checkInCount,
        moodCount: weeklyData.moodCount,
        activitiesSummary,
        maxSentences: 6,
        personalityModifiers: '',
        responseLength: 'brief'
      }
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 400,
        temperature: 0.75,
      }),
    })

    if (!response.ok) {
      console.error('AI API error:', await response.text())
      throw new Error('AI generation failed')
    }

    const aiData = await response.json()
    const insight = aiData.choices?.[0]?.message?.content?.trim()

    if (!insight) {
      throw new Error('No insight generated')
    }

    // Validate output
    const validator = new OutputValidator(validationRules, outputConstraints);
    const validationResult = validator.validate(insight);

    // Log validation results
    const responseTime = Date.now() - startTime;
    await supabase
      .from('ai_output_validation_log')
      .insert({
        user_id: userId,
        template_key: 'weekly_insights',
        input_data: { weeklyData },
        output_data: { insight },
        validation_passed: validationResult.isValid,
        validation_errors: validationResult.errors && validationResult.errors.length > 0 ? validationResult.errors : null,
        model_used: 'google/gemini-2.5-flash',
        response_time_ms: responseTime
      });

    if (!validationResult.isValid) {
      console.warn('Validation warnings:', validator.getValidationSummary(validationResult));
    }

    return new Response(JSON.stringify({ success: true, insight }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
