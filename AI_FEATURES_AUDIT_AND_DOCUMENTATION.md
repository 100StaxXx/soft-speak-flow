# AI Features Audit & Documentation
**Generated:** November 23, 2025  
**Status:** ✅ All Critical Features Migrated to PromptBuilder

---

## Executive Summary

This document provides a comprehensive audit of all AI-powered features in the app, their prompt strategies, validation mechanisms, and standardized best practices.

### Migration Status
- ✅ **Completed:** 7/7 core AI features now use PromptBuilder with validation
- ✅ **Templates Created:** 9 prompt templates in database
- ✅ **Validation:** All features have OutputValidator integration
- ✅ **Logging:** AI output validation logging implemented across all features

---

## Core AI Features

### 1. Mentor Chat (`mentor-chat`)
**Purpose:** Real-time conversational guidance from user's selected mentor

**Implementation:**
- Template: `mentor_chat`
- Model: `gemini-2.5-flash`
- Rate Limit: 10 messages/day per user
- Validation: ✅ Enabled
- User Preferences: ✅ Fully integrated (tone, detail level, formality)

**Context Depth:**
- Conversation history (last 20 messages, max 2000 chars each)
- User message (1-1000 chars)
- Mentor personality (name, tone_description)
- User AI preferences (tone, detail level, formality, avoid_topics)

**Output Constraints:**
- Max length: 500 characters
- Min length: 50 characters
- Max sentences: 4
- Forbidden phrases: "I cannot", "I'm just an AI", "As an AI"

**Validation Rules:**
- Must match mentor tone
- Must include actionable advice
- Must be direct and supportive

---

### 2. Daily Missions (`generate-daily-missions`)
**Purpose:** Generate 3 personalized daily missions across Connection, Quick Win, and Identity categories

**Implementation:**
- Template: `daily_missions`
- Model: `gemini-2.5-flash` (temp: 0.9 for creativity)
- Validation: ✅ Enabled
- User Preferences: ✅ Applied to tone and length

**Context Depth:**
- User habit streak count
- User context (recent activity patterns)
- Category-specific guidelines (embedded in template)

**Output Format:**
```json
[
  {
    "mission": "Text a friend you haven't spoken to in a while",
    "xp": 8,
    "category": "connection",
    "difficulty": "easy"
  },
  {
    "mission": "Do one task you've been avoiding for 5 minutes",
    "xp": 10,
    "category": "quick_win",
    "difficulty": "medium"
  },
  {
    "mission": "Complete all your habits today",
    "xp": 15,
    "category": "identity",
    "difficulty": "medium"
  }
]
```

**Output Constraints:**
- Exact count: 3 missions
- XP range: 5-15
- Categories: Must include all 3 (connection, quick_win, identity)
- Mission max length: 100 characters (one sentence)

**Validation Rules:**
- Required fields: mission, xp, category
- Array length: exactly 3
- Safety filters: No dangerous, expensive, medical, or emotionally heavy tasks
- Actionable today without special equipment

---

### 3. Morning Check-In Response (`generate-check-in-response`)
**Purpose:** Provide personalized morning message acknowledging user's mood and daily intention

**Implementation:**
- Template: `check_in_response`
- Model: `gemini-2.5-flash`
- Max tokens: 200
- Validation: ✅ Enabled
- User Preferences: ✅ Applied

**Context Depth:**
- User mood (good/neutral/tough)
- User intention for the day (max 500 chars)
- Today's pep talk theme (cross-reference for thematic consistency)
- Mentor personality

**Output Constraints:**
- Max length: 300 characters
- Min length: 40 characters
- Sentence count: 2-3
- Must acknowledge mood: ✅
- Must reference intention: ✅

**Validation Rules:**
- Must mention user's mood naturally
- Must support or reference their intention
- Must match mentor's distinctive voice
- Response style: supportive, energizing, action-oriented

---

### 4. Activity Comments (`generate-activity-comment`)
**Purpose:** Generate authentic mentor reactions to user activities, with conversational replies

**Implementation:**
- Templates: 
  - `activity_comment_initial` (first comment)
  - `activity_comment_reply` (conversation continuation)
- Model: `gemini-2.5-flash`
- Max tokens: 150
- Validation: ✅ Enabled
- User Preferences: ✅ Applied

**Context Depth:**
- Activity type and data
- Recent 5 activities (for pattern awareness)
- Today's pep talk (for thematic cross-reference)
- Milestone detection (3, 7, 14, 30, 100-day streaks)
- Previous comment (for replies only)
- User reply message (for replies only, max 500 chars)

**Output Constraints:**
- Max length: 200 characters
- Min length: 20 characters
- Sentence count: 1-2
- Response style: encouraging, high energy (initial) / conversational, balanced (reply)

**Special Features:**
- Milestone celebrations: Detects streak achievements and adjusts tone to be extra enthusiastic
- Cross-references pep talk themes naturally when relevant
- Creates new activity feed item for replies (preserves conversation)

---

### 5. Weekly Insights (`generate-weekly-insights`)
**Purpose:** Provide reflective weekly summary and forward-looking motivation

**Implementation:**
- Template: `weekly_insights`
- Model: `gemini-2.5-flash`
- Max tokens: 200
- Validation: ✅ Enabled
- User Preferences: ✅ Applied

**Context Depth:**
- Habit completion count (week)
- Check-in count (week)
- Mood tracking count (week)
- Recent activities (last 10, summarized)

**Output Constraints:**
- Max length: 300 characters
- Min length: 50 characters
- Sentence count: 2-3
- Response style: reflective, balanced energy, forward-looking

**Validation Rules:**
- Must acknowledge week's progress
- Must highlight patterns or wins
- Must provide actionable encouragement

---

### 6. Daily Reflection Reply (`generate-reflection-reply`)
**Purpose:** Respond supportively to evening reflections

**Implementation:**
- Template: `reflection_reply`
- Model: `gemini-2.5-flash`
- Validation: ✅ Enabled
- User Preferences: ✅ Applied
- Authentication: ✅ User ownership verified

**Context Depth:**
- User mood (good/neutral/tough)
- User note (optional, max 1000 chars)
- Mentor personality (loaded from user's selected mentor)

**Output Constraints:**
- Max length: 250 characters
- Min length: 30 characters
- Sentence count: 2-3
- Must acknowledge mood: ✅
- Response style: supportive, gentle energy

**Security:**
- Verifies reflection ownership before generating reply
- Uses authenticated user context

---

### 7. Weekly Challenges (`generate-weekly-challenges`)
**Purpose:** Generate multi-day challenges with progressive daily tasks

**Implementation:**
- Template: `weekly_challenges`
- Model: `gemini-2.5-flash`
- Validation: ✅ Enabled (newly migrated)
- Function calling: ✅ Uses structured output

**Context Depth:**
- Category (discipline, confidence, focus, mindset, self-care, physique, productivity)
- Duration (5-14 days, randomly selected)

**Output Format:**
```json
{
  "title": "7-Day Discipline Reset",
  "description": "Build unwavering discipline through small daily actions that compound into lasting change. Each task takes 5-15 minutes.",
  "tasks": [
    {
      "day_number": 1,
      "task_title": "Morning Commitment",
      "task_description": "Wake up 30 minutes earlier than usual and complete one important task before checking your phone."
    }
    // ... 6 more tasks
  ]
}
```

**Output Constraints:**
- Title max: 100 characters
- Description max: 500 characters
- Task count: Matches duration (5-14 tasks)
- Each task duration: 5-30 minutes
- Progressive difficulty: Tasks build on each other

**Validation Rules:**
- Required fields: title, description, tasks
- Tasks must have: day_number, task_title, task_description
- Tasks must be simple, achievable, and safe
- No equipment or money required
- Focus on habit-building and mindset shifts

---

## Standardized Context Depth Across Features

### Tier 1: Minimal Context (Fast Response)
**Used for:** Tutorial TTS, Quote generation
- No user-specific data
- Template/content-only inputs

### Tier 2: User State + Immediate Context (Standard)
**Used for:** Check-in responses, Activity comments, Reflection replies
- User mood/state
- Current activity/input
- Mentor personality
- Today's theme (if applicable)

### Tier 3: Recent History (Pattern Recognition)
**Used for:** Daily missions, Weekly insights
- Last 5-10 activities or data points
- Streak information
- Weekly/monthly aggregates
- Pattern detection

### Tier 4: Deep Context (Conversational)
**Used for:** Mentor chat
- Conversation history (last 20 messages)
- User preferences (tone, detail, formality)
- Long-term patterns
- Personalization settings

---

## Validation Architecture

### PromptBuilder System
Located: `/supabase/functions/_shared/promptBuilder.ts`

**Features:**
- Database-backed templates (reduces deployment coupling)
- Variable interpolation with `{{variable}}` syntax
- User preference integration (automatic personalization)
- Returns validation rules and output constraints with prompts

**Usage Pattern:**
```typescript
const promptBuilder = new PromptBuilder(supabaseUrl, supabaseKey);

const { systemPrompt, userPrompt, validationRules, outputConstraints } = 
  await promptBuilder.build({
    templateKey: 'mentor_chat',
    userId: user.id, // Optional: loads user preferences
    variables: {
      mentorName: 'Atlas',
      mentorTone: 'direct and empowering',
      userMessage: 'I need motivation to start my workout',
      maxSentences: 3
    }
  });
```

### OutputValidator System
Located: `/supabase/functions/_shared/outputValidator.ts`

**Validation Types:**
1. **Format Validation**
   - JSON structure (array/object)
   - Required fields
   - Array length constraints

2. **Content Validation**
   - Text length (min/max)
   - Sentence count
   - Forbidden phrases
   - Numeric ranges (XP, etc.)

3. **Context Validation**
   - Must mention mood
   - Must reference intention
   - Tone markers present

**Usage Pattern:**
```typescript
const validator = new OutputValidator(validationRules, outputConstraints);
const validationResult = validator.validate(aiOutput, context);

if (!validationResult.isValid) {
  console.warn('Validation errors:', validationResult.errors);
  // Log to ai_output_validation_log table
}
```

### Validation Logging
All AI outputs are logged to `ai_output_validation_log` table with:
- User ID
- Template key
- Input data
- Output data
- Validation passed/failed
- Validation errors (if any)
- Model used
- Response time (ms)
- Timestamp

This enables:
- Quality monitoring
- Performance tracking
- Debugging prompt issues
- User experience analysis

---

## Best Practices & Conventions

### 1. Prompt Design
✅ **Do:**
- Use `{{variable}}` syntax for all dynamic content
- Include personality modifiers placeholder for user preferences
- Specify exact output format and constraints in system prompt
- Keep prompts focused and actionable
- Use examples when output format is complex

❌ **Don't:**
- Hardcode values that might change
- Make prompts overly verbose
- Include contradictory instructions
- Forget to specify max length/sentence count

### 2. Context Management
✅ **Do:**
- Load only the context depth needed for the task
- Summarize historical data (don't dump raw records)
- Cross-reference themes when relevant (e.g., pep talks)
- Use user preferences to personalize responses

❌ **Don't:**
- Load entire database tables
- Include sensitive personal information unnecessarily
- Ignore user's selected mentor personality
- Skip validation of inputs

### 3. Error Handling
✅ **Do:**
- Validate all inputs with Zod schemas
- Log validation failures with context
- Provide fallback outputs when generation fails
- Track response times for performance monitoring

❌ **Don't:**
- Let invalid data reach the AI API
- Fail silently without logging
- Return raw AI errors to users
- Skip authentication checks

### 4. Model Selection
- **gemini-2.5-flash:** Default for all features (fast, cost-effective)
- **Temperature:** 0.9 for creative tasks (missions), 0.7 default for others
- **Max tokens:** Keep as low as feasible (150-200 for most features)

---

## Known Issues & Bugs Fixed

### App Walkthrough System ✅ RESOLVED

#### Issue 1: Race Conditions in Event Handlers
**Status:** ✅ Fixed  
**Description:** Multiple event listeners could fire simultaneously, causing duplicate saves and state corruption.  
**Solution:** 
- Added `hasAdvanced`, `hasCompleted`, `hasHandledLoading` flags
- Used `{ once: true }` on all event listeners
- Implemented `isSaving` state to prevent duplicate form submissions

#### Issue 2: Audio State Management
**Status:** ✅ Fixed  
**Description:** Audio would restart when unmuting after manual pause, fighting user intent.  
**Solution:**
- Added `userPausedManually` state tracking
- Respect manual pause state when muting/unmuting
- Improved autoplay fallback handling for browser policies

#### Issue 3: localStorage Caching Issues
**Status:** ✅ Fixed  
**Description:** TTS audio cache could exceed quota, causing failures.  
**Solution:**
- Implemented automatic cleanup on quota errors
- Cache size monitoring
- Graceful degradation when cache fails

#### Issue 4: Mentor Slug Validation
**Status:** ✅ Fixed  
**Description:** Invalid mentor IDs could cause crashes.  
**Solution:**
- Memoized mentor slug calculation
- Validated against known mentor list
- Fallback to 'atlas' for unknown mentors

#### Issue 5: Cleanup on Unmount
**Status:** ✅ Fixed  
**Description:** Timers and localStorage could leak on unmount.  
**Solution:**
- Track all timeouts and intervals in refs
- Clear all timers on unmount
- Clean up localStorage flags when walkthrough exits

### Tutorial TTS Stack Overflow ✅ RESOLVED

**Status:** ✅ Fixed  
**File:** `/supabase/functions/generate-tutorial-tts/index.ts`  
**Description:** Large audio buffers caused stack overflow with `String.fromCharCode.apply()`.  
**Solution:** 
- Implemented chunked processing (32KB chunks)
- Process ArrayBuffer in segments
- Prevents call stack size exceeded errors

---

## Migration Checklist

When adding new AI features, follow this checklist:

### 1. Template Creation
- [ ] Add template to database migration
- [ ] Define system prompt with personality/tone guidance
- [ ] Create user prompt template with `{{variables}}`
- [ ] Specify validation rules (max/min length, required fields)
- [ ] Define output constraints (format, structure)
- [ ] Set appropriate category

### 2. Function Implementation
- [ ] Import `PromptBuilder` and `OutputValidator`
- [ ] Create Zod schema for input validation
- [ ] Use `PromptBuilder.build()` to generate prompts
- [ ] Call AI API with generated prompts
- [ ] Validate output with `OutputValidator`
- [ ] Log validation results to `ai_output_validation_log`
- [ ] Handle errors gracefully with fallbacks

### 3. Context Design
- [ ] Determine appropriate context tier (1-4)
- [ ] Load only necessary user data
- [ ] Include mentor personality if relevant
- [ ] Consider cross-referencing themes (pep talks, etc.)
- [ ] Apply user preferences if applicable

### 4. Testing
- [ ] Test with various input combinations
- [ ] Verify validation catches invalid outputs
- [ ] Check response times are acceptable
- [ ] Ensure user preferences are respected
- [ ] Test error handling paths

### 5. Documentation
- [ ] Add to this document
- [ ] Document context depth
- [ ] Specify output format with examples
- [ ] List validation rules
- [ ] Note any special features or constraints

---

## Database Schema

### prompt_templates
```sql
CREATE TABLE prompt_templates (
  id UUID PRIMARY KEY,
  template_key TEXT UNIQUE NOT NULL,
  template_name TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  validation_rules JSONB DEFAULT '{}',
  output_constraints JSONB DEFAULT '{}',
  category TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### user_ai_preferences
```sql
CREATE TABLE user_ai_preferences (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  tone_preference TEXT DEFAULT 'balanced',
  detail_level TEXT DEFAULT 'medium',
  formality TEXT DEFAULT 'casual',
  avoid_topics TEXT[] DEFAULT '{}',
  preferred_length TEXT DEFAULT 'concise',
  response_style TEXT DEFAULT 'encouraging',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);
```

### ai_output_validation_log
```sql
CREATE TABLE ai_output_validation_log (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  template_key TEXT NOT NULL,
  input_data JSONB NOT NULL,
  output_data JSONB NOT NULL,
  validation_passed BOOLEAN NOT NULL,
  validation_errors JSONB DEFAULT '[]',
  model_used TEXT NOT NULL,
  tokens_used INTEGER,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Performance Metrics

### Target Benchmarks
- Response time: < 3 seconds (p95)
- Validation pass rate: > 95%
- User satisfaction: > 4.5/5 stars
- Error rate: < 1%

### Monitoring
- All response times logged to validation table
- Track validation failures by template
- Monitor API costs per feature
- User feedback on AI quality

---

## Future Enhancements

### Priority 1: Immediate
- [x] Migrate all core features to PromptBuilder ✅
- [x] Add validation to all AI outputs ✅
- [ ] Implement A/B testing framework for prompt variants
- [ ] Add user feedback collection on AI responses

### Priority 2: Next Quarter
- [ ] Multi-language support
- [ ] Advanced personalization (learning from user interactions)
- [ ] Context-aware conversation memory (beyond 20 messages)
- [ ] Emotion detection and adaptive tone

### Priority 3: Future
- [ ] Voice input/output for all AI features
- [ ] Visual AI for companion evolution
- [ ] Predictive motivation timing
- [ ] Community-driven prompt improvements

---

## Conclusion

The AI features in this app are now fully standardized with:
- ✅ PromptBuilder integration across all 7 core features
- ✅ Comprehensive validation and logging
- ✅ User preference personalization
- ✅ Consistent context depth management
- ✅ Robust error handling and fallbacks

All critical bugs in the walkthrough system have been resolved, and the codebase follows best practices for maintainability and scalability.

**Last Updated:** November 23, 2025  
**Reviewed By:** Background Agent  
**Status:** Production Ready ✅
