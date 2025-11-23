# AI Prompt Playbook

This document captures the shared prompt templates, context inputs, and output contracts for every AI-generated feature. Use it as the single source of truth when updating PromptBuilder templates or validating LLM responses.

## Feature Matrix

| Feature | Template Key | Context Inputs (max depth) | Output Contract |
| --- | --- | --- | --- |
| Mentor Chat | `mentor_chat` | User preferences, mentor persona, latest chat context | 2-4 sentence text response (tone markers enforced) |
| Daily Missions | `daily_missions` | User streak, mission history, category guardrails | JSON array of 3 missions with XP + category fields |
| Morning Check-in Reply | `check_in_response` | Mood, intention, pep talk theme, mentor persona | 2-3 sentence pep-talk referencing mood + intention |
| Activity Comment (initial) | `activity_comment_initial` | Current activity + last 5 feed items (trimmed to 400 chars) + pep talk + milestone flag | 2-3 sentence supportive comment |
| Activity Comment (reply) | `activity_comment_reply` | Previous mentor comment + user reply + activity context | 2-sentence follow-up that references reply |
| Weekly Insights | `weekly_insights` | Habit/check-in counts + last 8 activity highlights (400 chars each) | 3-4 sentence summary w/ celebration + focus |
| Reflection Reply | `reflection_reply` | User mood + note (trimmed to 600 chars) | 2-3 sentence compassionate response |
| Weekly Challenges | `weekly_challenges` | Category + duration (5-14 days) | JSON object with title, description, and `totalDays` tasks |
| Mentor Quotes | `mentor_content_quote` | Mentor persona, style, theme list, quote count | Text string with quotes separated by `||` |
| Mentor Lessons | `mentor_content_lesson` | Mentor persona + themes | `TITLE||DESCRIPTION||CONTENT` text blob |

## Validation Expectations

- All PromptBuilder templates attach `validation_rules` that feed the shared `OutputValidator`.
- Structured outputs (missions, challenges) must be valid JSON and satisfy any `requiredArrayLengths` or `xpRange` constraints.
- Text responses enforce max/min length, sentence counts, and tone markers to prevent flat or generic outputs.
- The validator now supports nested array length checks (e.g., `tasks` inside weekly challenges) through the `requiredArrayLengths` constraint.

## Context Depth Standards

- Activity comments: last **5** feed entries, each capped at **400** characters once serialized.
- Weekly insights: last **8** activity highlights, each capped at **400** characters.
- Reflection replies: user note is truncated to **600** characters before prompting.
- These caps prevent runaway prompt length and keep generation consistent across environments.

## How to Extend

1. Add a new template row via a Supabase migration following the patterns in `supabase/migrations/20251123143000_add_additional_prompt_templates.sql`.
2. Reference the template from your edge function with `PromptBuilder`, passing the user/mentor IDs for personalization.
3. Capture validation results in `ai_output_validation_log` for traceability.
4. Update this playbook with the new feature, context caps, and output contract.

Keeping this playbook current ensures prompt updates remain deterministic and auditable across all AI-powered experiences.
