import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { PromptBuilder } from "../_shared/promptBuilder.ts";
import { OutputValidator } from "../_shared/outputValidator.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireRequestAuth } from "../_shared/auth.ts";

const ActivityCommentSchema = z.object({
  activityId: z.string().uuid(),
  userReply: z.string().max(500).optional()
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);
  const startTime = Date.now();

  try {
    const auth = await requireRequestAuth(req, corsHeaders);
    if (auth instanceof Response) {
      return auth;
    }

    const body = await req.json();
    const validation = ActivityCommentSchema.safeParse(body);
    
    if (!validation.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input', 
          details: validation.error.errors 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { activityId, userReply } = validation.data;
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get activity details and user's mentor
    const activityQuery = supabase
      .from('activity_feed')
      .select('*')
      .eq('id', activityId);

    const { data: activity, error: activityError } = await (
      auth.isServiceRole
        ? activityQuery
        : activityQuery.eq('user_id', auth.userId)
    ).single();

    if (activityError) throw activityError

    // Get user's profile to find their mentor
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('selected_mentor_id')
      .eq('id', activity.user_id)
      .maybeSingle()

    if (profileError) throw profileError
    if (!profile?.selected_mentor_id) throw new Error('Profile or mentor not found')

    // Get mentor personality
    const { data: mentor } = await supabase
      .from('mentors')
      .select('name, tone_description')
      .eq('id', profile.selected_mentor_id)
      .maybeSingle()

    if (!mentor) throw new Error('Mentor not found')

    // Get recent context (last 5 activities)
    const { data: recentActivities } = await supabase
      .from('activity_feed')
      .select('activity_type, activity_data, created_at')
      .eq('user_id', activity.user_id)
      .order('created_at', { ascending: false })
      .limit(5)

    const contextSummary = recentActivities
      ?.map(a => `${a.activity_type}: ${JSON.stringify(a.activity_data)}`)
      .join('\n') || 'No recent activity'

    // Get today's pep talk for cross-referencing
    const today = new Date().toLocaleDateString('en-CA')
    const { data: todaysPepTalk } = await supabase
      .from('daily_pep_talks')
      .select('title, topic_category, emotional_triggers, summary')
      .eq('for_date', today)
      .limit(1)
      .maybeSingle()

    // Check for milestone achievements
    let milestoneContext = ''
    if (activity.activity_type === 'habit_completed' && activity.activity_data?.habit_id) {
      const { data: habit } = await supabase
        .from('habits')
        .select('current_streak, title')
        .eq('id', activity.activity_data.habit_id)
        .single()
      
      if (habit && [3, 7, 14, 30, 100].includes(habit.current_streak)) {
        milestoneContext = `\n\nIMPORTANT: This is a ${habit.current_streak}-day streak milestone! Make this celebration feel special and memorable. Use enthusiastic language appropriate to your personality.`
      }
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAIApiKey) throw new Error('OPENAI_API_KEY not configured')

    const activityDescription = `${activity.activity_type}: ${JSON.stringify(activity.activity_data)}`
    
    // Build personalized prompt using template system
    const promptBuilder = new PromptBuilder(supabaseUrl, supabaseKey);

    const templateKey = userReply ? 'activity_comment_reply' : 'activity_comment_initial';
    const pepTalkContext = todaysPepTalk 
      ? `Today's theme is "${todaysPepTalk.title}" focusing on ${todaysPepTalk.topic_category}. If this activity relates to today's theme, naturally weave that connection into your comment.`
      : 'No specific theme today.';

    const { systemPrompt, userPrompt, validationRules, outputConstraints } = await promptBuilder.build({
      templateKey,
      userId: activity.user_id,
      variables: {
        mentorName: mentor.name,
        mentorTone: mentor.tone_description,
        activityDescription,
        recentContext: contextSummary,
        pepTalkContext,
        milestoneContext,
        userReply: userReply || '',
        previousComment: activity.mentor_comment || '',
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
        max_tokens: 250,
        temperature: 0.75,
      }),
    })

    if (!response.ok) {
      console.error('AI API error:', await response.text())
      throw new Error('AI generation failed')
    }

    const aiData = await response.json()
    const comment = aiData.choices?.[0]?.message?.content?.trim()

    // Validate output
    const validator = new OutputValidator(validationRules, outputConstraints);
    const validationResult = validator.validate(comment, {
      activityType: activity.activity_type,
      hasReply: !!userReply
    });

    // Log validation results
    const responseTime = Date.now() - startTime;
    await supabase
      .from('ai_output_validation_log')
      .insert({
        user_id: activity.user_id,
        template_key: templateKey,
        input_data: { activityId, userReply, activityType: activity.activity_type },
        output_data: { comment },
        validation_passed: validationResult.isValid,
        validation_errors: validationResult.errors && validationResult.errors.length > 0 ? validationResult.errors : null,
        model_used: 'google/gemini-2.5-flash',
        response_time_ms: responseTime
      });

    if (!validationResult.isValid) {
      console.warn('Validation warnings:', validator.getValidationSummary(validationResult));
    }

    if (comment) {
      if (userReply) {
        // For replies, create a new activity feed item showing the conversation
        await supabase
          .from('activity_feed')
          .insert({
            user_id: activity.user_id,
            activity_type: 'chat_message',
            activity_data: { 
              user_message: userReply,
              context: 'reply_to_activity'
            },
            mentor_comment: comment
          })
      } else {
        // For initial comments, update the existing activity
        await supabase
          .from('activity_feed')
          .update({ mentor_comment: comment })
          .eq('id', activityId)
      }
    }

    return new Response(JSON.stringify({ success: true, comment }), {
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
