import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PromptBuilder } from "../_shared/promptBuilder.ts";
import { OutputValidator } from "../_shared/outputValidator.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const moodMapping: Record<string, { category: string; triggers: string[] }> = {
  'Unmotivated': { category: 'discipline', triggers: ['Unmotivated', 'Procrastinating'] },
  'Overthinking': { category: 'mindset', triggers: ['Anxious & Overthinking', 'Stressed'] },
  'Stressed': { category: 'mindset', triggers: ['Stressed', 'Overwhelmed'] },
  'Low Energy': { category: 'self-care', triggers: ['Drained', 'Low Energy'] },
  'Content': { category: 'gratitude', triggers: ['Content', 'Peaceful'] },
  'Disciplined': { category: 'discipline', triggers: ['Disciplined', 'Focused'] },
  'Focused': { category: 'focus', triggers: ['Focused', 'Clear-minded'] },
  'Inspired': { category: 'growth', triggers: ['Inspired', 'Energized'] }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { mood, userId } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    const mapping = moodMapping[mood] || moodMapping['Unmotivated'];
    
    // Build personalized prompt using template system
    const promptBuilder = new PromptBuilder(supabaseUrl, supabaseKey);

    const { systemPrompt, userPrompt, validationRules, outputConstraints } = await promptBuilder.build({
      templateKey: 'mood_push',
      userId: userId,
      variables: {
        userMood: mood,
        moodCategory: mapping.category,
        sentenceCountMin: 2,
        sentenceCountMax: 4,
        personalityModifiers: '',
        responseLength: 'concise'
      }
    });

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'create_mood_push',
            description: 'Create a motivational push for the user',
            parameters: {
              type: 'object',
              properties: {
                quote: { type: 'string', description: 'A powerful short quote (1 sentence)' },
                mini_pep_talk: { type: 'string', description: 'A 2-4 sentence pep talk' }
              },
              required: ['quote', 'mini_pep_talk'],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'create_mood_push' } }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices[0].message.tool_calls?.[0];
    const result = JSON.parse(toolCall.function.arguments);

    // Validate output
    const validator = new OutputValidator(validationRules, outputConstraints);
    const validationResult = validator.validate(result);

    // Log validation results
    const responseTime = Date.now() - startTime;
    await supabase
      .from('ai_output_validation_log')
      .insert({
        user_id: userId || null,
        template_key: 'mood_push',
        input_data: { mood, category: mapping.category },
        output_data: result,
        validation_passed: validationResult.isValid,
        validation_errors: validationResult.errors && validationResult.errors.length > 0 ? validationResult.errors : null,
        model_used: 'google/gemini-2.5-flash',
        response_time_ms: responseTime
      });

    if (!validationResult.isValid) {
      console.warn('Validation warnings:', validator.getValidationSummary(validationResult));
    }

    return new Response(
      JSON.stringify({
        quote: result.quote,
        mini_pep_talk: result.mini_pep_talk,
        audio_url: null,
        image_url: null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-mood-push:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});