import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { PromptBuilder } from "../_shared/promptBuilder.ts";
import { OutputValidator } from "../_shared/outputValidator.ts";
import { checkRateLimit, RATE_LIMITS, createRateLimitResponse } from "../_shared/rateLimiter.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

const CheckInSchema = z.object({
  checkInId: z.string().uuid()
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);
  const startTime = Date.now();

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const validation = CheckInSchema.safeParse(body);
    
    if (!validation.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input', 
          details: validation.error.errors 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { checkInId } = validation.data;
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Check rate limit
    const rateLimitCheck = await checkRateLimit(
      supabase,
      user.id,
      'generate-check-in-response',
      RATE_LIMITS['check-in-response']
    );

    if (!rateLimitCheck.allowed) {
      return createRateLimitResponse(rateLimitCheck, corsHeaders);
    }

    // Fetch check-in and profile in parallel
    const [
      { data: checkIn, error: checkInError },
      { data: profile, error: profileError }
    ] = await Promise.all([
      supabase
        .from('daily_check_ins')
        .select('*')
        .eq('id', checkInId)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('selected_mentor_id')
        .eq('id', user.id)
        .maybeSingle()
    ]);

    // Check both errors and provide detailed error message
    if (checkInError || profileError) {
      const errors = [];
      if (checkInError) {
        console.error('Check-in fetch error:', checkInError);
        errors.push(`check-in: ${checkInError.message}`);
      }
      if (profileError) {
        console.error('Profile fetch error:', profileError);
        errors.push(`profile: ${profileError.message}`);
      }
      throw new Error(`Failed to fetch required data: ${errors.join(', ')}`);
    }
    
    if (!checkIn) {
      throw new Error('Check-in not found');
    }
    
    if (checkIn.user_id !== user.id) {
      throw new Error('Unauthorized: You can only access your own check-ins')
    }

    if (!profile?.selected_mentor_id) {
      throw new Error('User profile or mentor not found')
    }

    // Fetch mentor and pep talk in parallel (pep talk needs mentor slug, so we get mentor first)
    const { data: mentor, error: mentorError } = await supabase
      .from('mentors')
      .select('name, tone_description, slug')
      .eq('id', profile.selected_mentor_id)
      .maybeSingle()

    if (mentorError || !mentor) {
      console.error('Mentor fetch error:', mentorError);
      throw new Error('Mentor not found')
    }

    // Fetch pep talk for today
    const today = new Date().toLocaleDateString('en-CA')
    const { data: pepTalk } = await supabase
      .from('daily_pep_talks')
      .select('title, topic_category')
      .eq('for_date', today)
      .eq('mentor_slug', mentor.slug)
      .maybeSingle()

    const dailyContext = pepTalk 
      ? `Today's pep talk theme: "${pepTalk.title}" (${pepTalk.topic_category}). Reference this theme if relevant to their intention.`
      : '';

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAIApiKey) throw new Error('OPENAI_API_KEY not configured')

    // Build personalized prompt using template system
    const promptBuilder = new PromptBuilder(supabaseUrl, supabaseKey);

    const { systemPrompt, userPrompt, validationRules, outputConstraints } = await promptBuilder.build({
      templateKey: 'check_in_response',
      userId: user.id,
      variables: {
        mentorName: mentor.name,
        mentorTone: mentor.tone_description,
        userMood: checkIn.mood,
        userIntention: checkIn.intention,
        dailyContext,
        maxSentences: 4,
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
        max_tokens: 200,
        temperature: 0.75,
      }),
    })

    if (!response.ok) {
      console.error('AI API error:', await response.text())
      throw new Error('AI generation failed')
    }

    const aiData = await response.json()
    const mentorResponse = aiData.choices?.[0]?.message?.content?.trim()

    // Validate output
    const validator = new OutputValidator(validationRules, outputConstraints);
    const validationResult = validator.validate(mentorResponse, {
      userMood: checkIn.mood,
      userIntention: checkIn.intention
    });

    // Log validation results
    const responseTime = Date.now() - startTime;
    await supabase
      .from('ai_output_validation_log')
      .insert({
        user_id: user.id,
        template_key: 'check_in_response',
        input_data: { mood: checkIn.mood, intention: checkIn.intention },
        output_data: { response: mentorResponse },
        validation_passed: validationResult.isValid,
        validation_errors: validationResult.errors && validationResult.errors.length > 0 ? validationResult.errors : null,
        model_used: 'google/gemini-2.5-flash',
        response_time_ms: responseTime
      });

    if (!validationResult.isValid) {
      console.warn('Validation warnings:', validator.getValidationSummary(validationResult));
    }

    if (mentorResponse) {
      await supabase
        .from('daily_check_ins')
        .update({ mentor_response: mentorResponse })
        .eq('id', checkInId)
    }

    return new Response(JSON.stringify({ success: true, mentorResponse }), {
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
