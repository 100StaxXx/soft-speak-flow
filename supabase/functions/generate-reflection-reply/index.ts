import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { PromptBuilder } from "../_shared/promptBuilder.ts";
import { OutputValidator } from "../_shared/outputValidator.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

const ReflectionReplySchema = z.object({
  reflectionId: z.string().uuid(),
  mood: z.enum(['good', 'neutral', 'tough']),
  note: z.string().max(1000).optional()
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);
  const startTime = Date.now();

  try {
    // Get authentication token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const body = await req.json();
    const validation = ReflectionReplySchema.safeParse(body);
    
    if (!validation.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input', 
          details: validation.error.errors 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { reflectionId, mood, note } = validation.data;
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user authentication
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Verify reflection ownership
    const { data: reflection, error: reflectionError } = await supabase
      .from('user_reflections')
      .select('user_id')
      .eq('id', reflectionId)
      .single()
    
    if (reflectionError) throw reflectionError
    
    if (reflection.user_id !== user.id) {
      throw new Error('Unauthorized: You can only access your own reflections')
    }

    // Build personalized prompt using template system
    const promptBuilder = new PromptBuilder(supabaseUrl, supabaseKey);

    const { systemPrompt, userPrompt, validationRules, outputConstraints } = await promptBuilder.build({
      templateKey: 'reflection_reply',
      userId: user.id,
      variables: {
        userMood: mood,
        userNote: note || 'No additional note provided',
        maxSentences: 5,
        personalityModifiers: '',
        responseLength: 'brief'
      }
    });

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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 350,
        temperature: 0.75,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiReply = aiData.choices[0].message.content;

    // Validate output
    const validator = new OutputValidator(validationRules, outputConstraints);
    const validationResult = validator.validate(aiReply, { mood, note });

    // Log validation results
    const responseTime = Date.now() - startTime;
    await supabase
      .from('ai_output_validation_log')
      .insert({
        user_id: user.id,
        template_key: 'reflection_reply',
        input_data: { mood, note },
        output_data: { reply: aiReply },
        validation_passed: validationResult.isValid,
        validation_errors: validationResult.errors && validationResult.errors.length > 0 ? validationResult.errors : null,
        model_used: 'google/gemini-2.5-flash',
        response_time_ms: responseTime
      });

    if (!validationResult.isValid) {
      console.warn('Validation warnings:', validator.getValidationSummary(validationResult));
    }

    // Update the reflection with AI reply
    const { error: updateError } = await supabase
      .from('user_reflections')
      .update({ ai_reply: aiReply })
      .eq('id', reflectionId);

    if (updateError) {
      console.error('Error updating reflection:', updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({ ai_reply: aiReply }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-reflection-reply:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});