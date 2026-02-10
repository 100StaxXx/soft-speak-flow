
# Make Daily Missions Creative and Non-Repetitive

## Problem
The AI is copy-pasting the same 5-6 mission texts every single day because:
1. The prompt includes "approved patterns" which the AI treats as the only options
2. No recent mission history is sent to the AI, so it can't avoid repeats
3. The database prompt template is stale (only lists 3 categories instead of all 6)
4. Temperature is 0.9 but the prompt is so constrained it doesn't matter

## Solution: Three Changes

### 1. Feed Recent Mission History into the Prompt (Edge Function)

In `supabase/functions/generate-daily-missions/index.ts`:
- Query the last 7 days of missions for this user (up to ~21 texts)
- Add them to the user prompt as a "DO NOT REPEAT" list
- This single change will force the AI to generate fresh variations every day

### 2. Rewrite the Prompt to Encourage Creativity (Database Update)

Update the `prompt_templates` row for `daily_missions`:

**System prompt changes:**
- Remove the rigid "approved patterns" lists -- replace with category *intent* descriptions and example *styles* (not exact texts)
- Add explicit instruction: "Never repeat or closely paraphrase any mission from the recent history list"
- Add creative direction: "Each mission should feel fresh -- vary the action, framing, and specificity. Use concrete details (e.g., 'Name 3 sounds you can hear right now' instead of generic 'be mindful')"
- Expand categories in `output_constraints` from `[connection, quick_win, identity]` to all 6: `[connection, quick_win, identity, wellness, gratitude, growth]`
- Add a "learning-focused" nudge for growth missions: encourage specific micro-learning prompts (e.g., "Look up why the sky is blue", "Find out what your name means")

**User prompt changes:**
- Include the recent history block: "The user has seen these missions recently -- generate completely different ones: [list]"
- Add the user's active campaigns/habits as context so missions can reference what they're actually working on

### 3. Make Missions Context-Aware (Edge Function)

In the edge function, before calling the AI:
- Query the user's active epic titles and habit titles
- Pass them as context variables so the AI can generate missions like "Do one thing that supports your [campaign name] journey" or "Practice [habit name] in a new way today"
- This makes missions feel personal and tied to what the user cares about

## Technical Details

### Edge Function Changes (`supabase/functions/generate-daily-missions/index.ts`)

```text
New queries to add before AI call:
1. Recent missions: SELECT mission_text FROM daily_missions 
   WHERE user_id = X AND mission_date > (today - 7 days)
2. Active epics: SELECT title FROM epics 
   WHERE user_id = X AND status = 'active'
3. Active habits: SELECT title FROM habits 
   WHERE user_id = X AND archived_at IS NULL
```

Pass these into the prompt as:
- `recentMissions`: string[] of last 7 days' mission texts
- `activeGoals`: string[] of epic + habit titles

### Database Migration (prompt_templates update)

Update the system prompt and user prompt template for `daily_missions` to:
- Reference `recentMissions` variable
- Reference `activeGoals` variable  
- Use category intents instead of approved patterns
- Update `output_constraints.categoriesRequired` to include all 6 categories
- Add `variables` entry for `recentMissions` and `activeGoals`

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/generate-daily-missions/index.ts` | Add recent history + active goals queries, pass to prompt |
| Database: `prompt_templates` | Update system/user prompts for creativity + dedup |

## Expected Result
- Missions will never repeat within a 7-day window
- Missions will reference the user's actual campaigns and habits
- Growth/learning missions will be specific and interesting (e.g., "Look up one thing about a country you've never visited" instead of "Learn one new word or fact today")
- Each day genuinely feels different
