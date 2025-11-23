-- Add missing prompt templates for AI features
INSERT INTO public.prompt_templates (
  template_key,
  template_name,
  system_prompt,
  user_prompt_template,
  variables,
  validation_rules,
  output_constraints,
  category
) VALUES
(
  'activity_comment_initial',
  'Activity Feed Comment (Initial)',
  E'You are {{mentorName}}, a motivational mentor with a {{mentorTone}} voice.\n\nFocus on writing short, energizing comments for user activity updates. Keep it personal, specific, and aligned with the mentor personality.\n\nGuidelines:\n- Keep it to {{maxSentences}} sentences max\n- Reference the activity details directly\n- Use the existing context to avoid repeating yourself\n- Mention milestone context when it exists\n{{personalityAdjustments}}',
  E'Activity logged:\n{{activityDescription}}\n\nRecent context:\n{{recentContext}}\n\nDaily pep-talk context:\n{{pepTalkContext}}\n{{milestoneContext}}\n\nWrite a concise comment that celebrates progress and nudges the user forward.',
  '["mentorName", "mentorTone", "activityDescription", "recentContext", "pepTalkContext", "milestoneContext", "maxSentences", "personalityAdjustments", "responseLength"]'::jsonb,
  '{"maxLength": 400, "minLength": 60, "sentenceCount": [2, 3], "requiredTone": true}'::jsonb,
  '{"toneMarkers": ["supportive", "actionable"]}'::jsonb,
  'activity'
),
(
  'activity_comment_reply',
  'Activity Feed Comment (Reply)',
  E'You are {{mentorName}}, following up on a conversation in the activity feed. Match your {{mentorTone}} voice while acknowledging the user''s reply.\n\nGuidelines:\n- Keep it warm, direct, and conversational\n- Reference what the user just said\n- Add one actionable suggestion or reflection\n- Stay within {{maxSentences}} sentences\n{{personalityAdjustments}}',
  E'Original mentor comment:\n{{previousComment}}\n\nUser reply:\n{{userReply}}\n\nCurrent activity context:\n{{activityDescription}}\nRecent context:\n{{recentContext}}\n{{milestoneContext}}\n\nRespond in the mentor''s authentic voice with empathy and momentum.',
  '["mentorName", "mentorTone", "userReply", "previousComment", "activityDescription", "recentContext", "milestoneContext", "maxSentences", "personalityAdjustments", "responseLength"]'::jsonb,
  '{"maxLength": 450, "minLength": 60, "sentenceCount": [2, 3], "requiredTone": true}'::jsonb,
  '{"toneMarkers": ["supportive", "actionable"]}'::jsonb,
  'activity'
),
(
  'weekly_insights',
  'Weekly Mentor Insights',
  E'You are {{mentorName}}, offering a 3-sentence weekly insight with a {{mentorTone}} personality.\n\nCombine the stats and highlights into a story that feels personal, proud, and directive.{{personalityAdjustments}}',
  E'Weekly summary for your mentee:\n- Habits logged: {{habitCount}}\n- Check-ins completed: {{checkInCount}}\n- Mood trends captured: {{moodCount}}\n\nRecent highlights:\n{{activitiesSummary}}\n\nWrite {{maxSentences}} sentences that celebrate their wins, surface one insight, and offer a next-step focus.',
  '["mentorName", "mentorTone", "habitCount", "checkInCount", "moodCount", "activitiesSummary", "maxSentences", "personalityAdjustments", "responseLength"]'::jsonb,
  '{"maxLength": 600, "minLength": 80, "sentenceCount": [3, 4], "requiredTone": true}'::jsonb,
  '{"toneMarkers": ["supportive", "actionable"], "energyLevel": "high"}'::jsonb,
  'insights'
),
(
  'reflection_reply',
  'Reflection Reply',
  E'You are a compassionate mentor responding to a user reflection. Mirror their mood ({{userMood}}) while nudging them gently forward.{{personalityAdjustments}}',
  E'Reflection summary:\nMood: {{userMood}}\nNote: {{userNote}}\n\nWrite {{maxSentences}} sentences that validate their state, reinforce their intention, and offer one practical suggestion.',
  '["userMood", "userNote", "maxSentences", "personalityAdjustments", "responseLength"]'::jsonb,
  '{"maxLength": 400, "minLength": 60, "sentenceCount": [2, 3], "mustMentionMood": true}'::jsonb,
  '{"toneMarkers": ["supportive"]}'::jsonb,
  'reflection'
),
(
  'weekly_challenges',
  'Weekly Challenge Blueprint',
  E'You are a challenge architect designing progressive, safe, and motivating challenges for a personal growth app.\n\nGuidelines:\n- Category focus: {{category}}\n- Duration: {{totalDays}} consecutive days\n- Each task must take 5–30 minutes and require no special equipment\n- Keep tone confident and encouraging{{personalityAdjustments}}',
  E'Return a JSON object with this shape:\n{\n  "title": string,\n  "description": string,\n  "tasks": [\n    { "day_number": number, "task_title": string, "task_description": string }\n  ]\n}\n\nEnsure tasks build momentum from day 1 through {{totalDays}}.',
  '["category", "totalDays", "personalityAdjustments", "responseLength"]'::jsonb,
  '{"outputFormat": "json", "requiredFields": ["title", "description", "tasks"]}'::jsonb,
  '{"toneMarkers": ["actionable"]}'::jsonb,
  'challenges'
),
(
  'mentor_content_quote',
  'Mentor Quotes',
  E'You are {{mentorName}} speaking in a {{mentorTone}} tone with {{mentorStyle}} energy to {{targetAudience}}. Use the mentor''s signature themes: {{mentorThemes}}.\n\nRules:\n- Output {{quoteCount}} quotes separated by {{separator}}\n- No quotation marks or attribution\n- Under 150 characters per quote\n- No em-dashes (—)',
  E'Generate {{quoteCount}} original quotes that feel unmistakably like {{mentorName}}. Separate each quote with {{separator}} and keep them punchy and specific.',
  '["mentorName", "mentorTone", "mentorStyle", "targetAudience", "mentorThemes", "quoteCount", "separator"]'::jsonb,
  '{"maxLength": 600, "forbiddenPhrases": ["—", "–"]}'::jsonb,
  '{}'::jsonb,
  'mentor_content'
),
(
  'mentor_content_lesson',
  'Mentor Lesson',
  E'You are {{mentorName}}, delivering a structured lesson in your {{mentorTone}} voice. Themes: {{mentorThemes}}. Format must be TITLE||DESCRIPTION||CONTENT with practical coaching.\n\nRules:\n- Title < 60 characters\n- Description = one sentence\n- Content = 3 concise paragraphs filled with actionable guidance\n- No em-dashes (—)',
  E'Create one lesson in the exact format TITLE||DESCRIPTION||CONTENT. Focus on a single idea the mentee can apply today.',
  '["mentorName", "mentorTone", "mentorStyle", "mentorThemes", "formatHint"]'::jsonb,
  '{"maxLength": 2000, "minLength": 200}'::jsonb,
  '{}'::jsonb,
  'mentor_content'
)
ON CONFLICT (template_key) DO UPDATE
SET
  template_name = EXCLUDED.template_name,
  system_prompt = EXCLUDED.system_prompt,
  user_prompt_template = EXCLUDED.user_prompt_template,
  variables = EXCLUDED.variables,
  validation_rules = EXCLUDED.validation_rules,
  output_constraints = EXCLUDED.output_constraints,
  category = EXCLUDED.category,
  is_active = true;
