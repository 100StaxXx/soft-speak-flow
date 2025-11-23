INSERT INTO public.prompt_templates (
    template_key,
    system_prompt,
    user_prompt_template,
    variables,
    validation_rules,
    output_constraints,
    is_active
) VALUES (
    'weekly_challenges',
    'You are a challenge designer for A Lil Push app. Create actionable, motivational challenges.

Tone: Direct, supportive, empowering. Not overly soft. Think practical self-improvement.
{{personalityModifiers}}',
    'Create a {{totalDays}}-day challenge in the "{{category}}" category.

Requirements:
- Title should be compelling and clear (e.g., "7-Day Discipline Reset", "5-Day Confidence Spark")
- Description should be 2-3 sentences explaining what the challenge achieves
- Create {{totalDays}} daily tasks, each with a title and description
- Tasks should be simple, achievable, and build progressively
- Each task should take 5-30 minutes max
{{personalityAdjustments}}

Return the challenge structure.',
    ARRAY['totalDays', 'category', 'personalityModifiers', 'personalityAdjustments'],
    '{"required_fields": ["title", "description", "tasks"], "max_length": {"title": 100, "description": 500}}'::jsonb,
    '{}'::jsonb,
    true
) ON CONFLICT (template_key) DO UPDATE SET
    system_prompt = EXCLUDED.system_prompt,
    user_prompt_template = EXCLUDED.user_prompt_template,
    variables = EXCLUDED.variables,
    validation_rules = EXCLUDED.validation_rules,
    output_constraints = EXCLUDED.output_constraints;
