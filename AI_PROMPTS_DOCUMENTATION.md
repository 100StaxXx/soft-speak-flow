# AI Prompt Templates Documentation

## Overview
This document provides a comprehensive guide to all AI-powered features in the application and their associated prompt templates.

Last Updated: 2025-11-23

---

## ✅ Migrated to PromptBuilder (9 Functions)

### 1. **Mentor Chat** (`mentor-chat`)
- **Template Key**: `mentor_chat`
- **Purpose**: Personalized chat responses from user's selected mentor
- **Model**: `google/gemini-2.5-flash`
- **Variables**:
  - `mentorName`: Selected mentor's name
  - `mentorTone`: Mentor's personality description
  - `userMessage`: User's chat message
  - `contextualInfo`: Recent conversation context (last 3 messages)
  - `personalityAdjustments`: User AI preference adjustments
  - `maxSentences`: Response length constraint (4)
- **Validation**: ✅ Output validation enabled
- **Rate Limit**: 10 messages/day
- **Max Tokens**: Default (no limit)

---

### 2. **Check-In Response** (`generate-check-in-response`)
- **Template Key**: `check_in_response`
- **Purpose**: Mentor response to morning check-in
- **Model**: `google/gemini-2.5-flash`
- **Variables**:
  - `mentorName`: Selected mentor's name
  - `mentorTone`: Mentor's personality description
  - `userMood`: User's selected mood
  - `userIntention`: User's daily intention
  - `dailyContext`: Today's pep talk theme (if applicable)
  - `maxSentences`: 3
  - `personalityModifiers`: User preferences
  - `responseLength`: 'concise'
- **Validation**: ✅ Validates mood acknowledgment and intention reference
- **Max Tokens**: 200

---

### 3. **Daily Missions** (`generate-daily-missions`)
- **Template Key**: `daily_missions`
- **Purpose**: Generate 3 personalized daily missions
- **Model**: `google/gemini-2.5-flash`
- **Variables**:
  - `missionCount`: 3 (fixed)
  - `userStreak`: Current habit streak
  - `userContext`: Streak-aware encouragement
  - `categoryGuidelines`: Mission category structure
- **Output Format**: JSON array with 3 missions
- **Mission Categories**:
  1. Connection (kindness/gratitude)
  2. Quick Win (momentum builder)
  3. Identity (supports habits/discipline)
- **Validation**: ✅ Validates 3 missions with XP 10-30
- **Temperature**: 0.9 (high creativity)

---

### 4. **Activity Comment** (`generate-activity-comment`)
- **Template Keys**: 
  - `activity_comment_initial`: First comment on activity
  - `activity_comment_reply`: Reply to user's response
- **Purpose**: Mentor comments on activity feed items
- **Model**: `google/gemini-2.5-flash`
- **Variables**:
  - `mentorName`, `mentorTone`: Mentor context
  - `activityDescription`: Activity type + data
  - `recentContext`: Last 5 activities
  - `pepTalkContext`: Today's theme (if relevant)
  - `milestoneContext`: Streak milestones (3, 7, 14, 30, 100 days)
  - `userReply`: User's reply (if replying)
  - `previousComment`: Previous mentor comment
  - `maxSentences`: 2
- **Validation**: ✅ Enabled
- **Max Tokens**: 150

---

### 5. **Weekly Insights** (`generate-weekly-insights`)
- **Template Key**: `weekly_insights`
- **Purpose**: Weekly summary and insights
- **Model**: `google/gemini-2.5-flash`
- **Variables**:
  - `mentorName`, `mentorTone`: Mentor context
  - `habitCount`: Weekly habit completions
  - `checkInCount`: Weekly check-ins
  - `moodCount`: Weekly mood logs
  - `activitiesSummary`: Top 10 activities
  - `maxSentences`: 3
  - `personalityModifiers`: User preferences
  - `responseLength`: 'brief'
- **Validation**: ✅ Enabled
- **Max Tokens**: 200

---

### 6. **Reflection Reply** (`generate-reflection-reply`)
- **Template Key**: `reflection_reply`
- **Purpose**: AI reply to user reflection notes
- **Model**: `google/gemini-2.5-flash`
- **Variables**:
  - `userMood`: Reflection mood (good/neutral/tough)
  - `userNote`: User's reflection note
  - `maxSentences`: 3
  - `personalityModifiers`: User preferences
  - `responseLength`: 'brief'
- **Validation**: ✅ Validates mood context
- **Authentication**: Required (user must own reflection)

---

### 7. **Weekly Challenges** (`generate-weekly-challenges`)
- **Template Key**: `weekly_challenges`
- **Purpose**: Generate multi-day challenges with daily tasks
- **Model**: `google/gemini-2.5-flash`
- **Variables**:
  - `totalDays`: 5-14 days (randomized)
  - `category`: One of 7 categories (discipline, confidence, focus, mindset, self-care, physique, productivity)
  - `taskCount`: Matches totalDays
  - `durationRange`: '5-14'
  - `personalityModifiers`: ''
  - `responseLength`: 'detailed'
- **Output Format**: Uses tool calling (function: `create_challenge`)
- **Structure**:
  ```json
  {
    "title": "7-Day Discipline Reset",
    "description": "Challenge description",
    "tasks": [
      {
        "day_number": 1,
        "task_title": "Task title",
        "task_description": "Task description"
      }
    ]
  }
  ```
- **Validation**: ✅ Validates task count matches totalDays
- **Generates**: 4 challenges per run

---

### 8. **Proactive Nudges** (`generate-proactive-nudges`)
- **Template Keys**:
  - `nudge_check_in`: Morning check-in reminder
  - `nudge_habit_reminder`: Evening habit reminder
  - `nudge_encouragement`: Surprise check-in
- **Purpose**: Contextual push notifications
- **Model**: `google/gemini-2.5-flash`
- **Timing**:
  - Check-in nudge: 10am-12pm (if no check-in)
  - Habit reminder: After 8pm (if no habits completed)
  - Encouragement: Random 10% chance (if quiet >6 hours)
- **Variables**:
  - `mentorName`, `mentorTone`: Mentor context
  - `timeContext`: 'mid-morning' / 'evening'
  - `activityContext`: 'quiet today'
  - `maxSentences`: 1
  - `personalityModifiers`: User preferences
  - `responseLength`: 'brief'
- **Validation**: ✅ Enabled
- **Max Tokens**: 100

---

### 9. **Mood Push** (`generate-mood-push`)
- **Template Key**: `mood_push`
- **Purpose**: Motivational content based on user mood
- **Model**: `google/gemini-2.5-flash`
- **Variables**:
  - `userMood`: User's current mood
  - `moodCategory`: Mapped category (discipline, mindset, self-care, etc.)
  - `sentenceCountMin`: 2
  - `sentenceCountMax`: 4
  - `personalityModifiers`: User preferences
  - `responseLength`: 'concise'
- **Output Format**: Uses tool calling (function: `create_mood_push`)
- **Structure**:
  ```json
  {
    "quote": "Powerful short quote (1 sentence)",
    "mini_pep_talk": "2-4 sentence pep talk"
  }
  ```
- **Mood Mappings**:
  - Unmotivated → discipline
  - Overthinking → mindset
  - Stressed → mindset
  - Low Energy → self-care
  - Content → gratitude
  - Disciplined → discipline
  - Focused → focus
  - Inspired → growth
- **Validation**: ✅ Enabled

---

## ⚠️ NOT YET MIGRATED (15 Functions)

### 10. **Companion Story** (`generate-companion-story`)
- **Status**: ❌ Direct prompts, no PromptBuilder
- **Needs Template**: `companion_story`
- **Priority**: High

### 11. **Mentor Content** (`generate-mentor-content`)
- **Status**: ❌ Direct prompts
- **Needs Template**: `mentor_content`
- **Priority**: Medium

### 12. **Evolution Card** (`generate-evolution-card`)
- **Status**: ❌ Direct prompts
- **Needs Template**: `evolution_card`
- **Priority**: High

### 13. **Adaptive Push** (`generate-adaptive-push`)
- **Status**: ❌ Direct prompts
- **Needs Template**: `adaptive_push`
- **Priority**: Medium

### 14. **Quote Image** (`generate-quote-image`)
- **Status**: ❌ Direct prompts
- **Needs Template**: `quote_image`
- **Priority**: Low (image generation)

### 15. **Complete Pep Talk** (`generate-complete-pep-talk`)
- **Status**: ❌ Direct prompts
- **Needs Template**: `complete_pep_talk`
- **Priority**: High

### 16. **Lesson Generation** (`generate-lesson`, `batch-generate-lessons`)
- **Status**: ❌ Direct prompts
- **Needs Templates**: `lesson_single`, `lesson_batch`
- **Priority**: Medium

### 17. **Evolution Voice** (`generate-evolution-voice`)
- **Status**: ❌ Direct prompts
- **Needs Template**: `evolution_voice`
- **Priority**: Low (TTS)

### 18. **Mentor Script** (`generate-mentor-script`)
- **Status**: ❌ Direct prompts
- **Needs Template**: `mentor_script`
- **Priority**: Medium

### 19. **Quote Generation** (`generate-quotes`, `generate-inspire-quote`)
- **Status**: ❌ Direct prompts
- **Needs Templates**: `quote_general`, `quote_inspire`
- **Priority**: Medium

### 20. **Companion Evolution** (`generate-companion-evolution`)
- **Status**: ❌ Direct prompts
- **Needs Template**: `companion_evolution`
- **Priority**: High

### 21. **Companion Image** (`generate-companion-image`)
- **Status**: ❌ Image generation, different flow
- **Priority**: Low (not text prompts)

### 22. **Daily Quotes** (`generate-daily-quotes`)
- **Status**: ❌ Direct prompts
- **Needs Template**: `daily_quotes`
- **Priority**: Medium

### 23. **Daily Pep Talks** (`generate-daily-mentor-pep-talks`)
- **Status**: ❌ Direct prompts
- **Needs Template**: `daily_pep_talks`
- **Priority**: High

### 24. **Mentor Audio** (`generate-mentor-audio`, `generate-full-mentor-audio`)
- **Status**: ❌ TTS functions, different flow
- **Priority**: Low (not text generation)

---

## Database Schema

### Prompt Templates Table
```sql
CREATE TABLE prompt_templates (
  template_key TEXT PRIMARY KEY,
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,
  variables TEXT[] NOT NULL,
  validation_rules JSONB,
  output_constraints JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### User AI Preferences Table
```sql
CREATE TABLE user_ai_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id),
  tone_preference TEXT DEFAULT 'balanced', -- gentle, direct, enthusiastic, balanced
  detail_level TEXT DEFAULT 'medium', -- brief, medium, detailed
  formality TEXT DEFAULT 'casual', -- formal, casual, friendly
  avoid_topics TEXT[] DEFAULT '{}',
  preferred_length TEXT DEFAULT 'concise', -- brief, concise, detailed
  response_style TEXT DEFAULT 'encouraging', -- encouraging, analytical, motivational
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### AI Output Validation Log Table
```sql
CREATE TABLE ai_output_validation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  template_key TEXT NOT NULL,
  input_data JSONB,
  output_data JSONB,
  validation_passed BOOLEAN NOT NULL,
  validation_errors TEXT[],
  model_used TEXT NOT NULL,
  response_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Required Prompt Templates to Create

To complete the migration, these templates need to be added to the `prompt_templates` table:

1. ✅ `mentor_chat` - Already in use
2. ✅ `check_in_response` - Already in use
3. ✅ `daily_missions` - Already in use
4. ✅ `activity_comment_initial` - Already in use
5. ✅ `activity_comment_reply` - Already in use
6. ✅ `weekly_insights` - Already in use
7. ✅ `reflection_reply` - Already in use
8. ✅ `weekly_challenges` - Already in use
9. ✅ `nudge_check_in` - Already in use
10. ✅ `nudge_habit_reminder` - Already in use
11. ✅ `nudge_encouragement` - Already in use
12. ✅ `mood_push` - Already in use
13. ❌ `companion_story` - **TO CREATE**
14. ❌ `mentor_content` - **TO CREATE**
15. ❌ `evolution_card` - **TO CREATE**
16. ❌ `adaptive_push` - **TO CREATE**
17. ❌ `quote_image` - **TO CREATE**
18. ❌ `complete_pep_talk` - **TO CREATE**
19. ❌ `lesson_single` - **TO CREATE**
20. ❌ `lesson_batch` - **TO CREATE**
21. ❌ `evolution_voice` - **TO CREATE**
22. ❌ `mentor_script` - **TO CREATE**
23. ❌ `quote_general` - **TO CREATE**
24. ❌ `quote_inspire` - **TO CREATE**
25. ❌ `companion_evolution` - **TO CREATE**
26. ❌ `daily_quotes` - **TO CREATE**
27. ❌ `daily_pep_talks` - **TO CREATE**

---

## Benefits of PromptBuilder System

### ✅ Consistency
- All AI functions use the same template system
- Centralized prompt management
- Easy A/B testing of prompts

### ✅ Personalization
- User AI preferences automatically applied
- Tone, detail level, and formality adjustments
- Topic avoidance rules

### ✅ Validation
- Structured output validation
- Error tracking and logging
- Performance metrics (response time)

### ✅ Maintainability
- Templates stored in database
- Version control for prompts
- Easy to update without code deployment

### ✅ Observability
- All AI outputs logged with validation results
- Performance tracking
- Quality assurance metrics

---

## Next Steps

### Priority 1: High-Impact Functions
1. Migrate `generate-complete-pep-talk` (daily content generation)
2. Migrate `generate-companion-evolution` (core feature)
3. Migrate `generate-companion-story` (personalization)
4. Migrate `generate-daily-mentor-pep-talks` (daily engagement)
5. Migrate `generate-evolution-card` (visual content)

### Priority 2: Medium-Impact Functions
1. Migrate lesson generation functions
2. Migrate quote generation functions
3. Migrate mentor content/script functions
4. Migrate adaptive push notifications

### Priority 3: Low-Impact Functions
1. Image generation functions (different architecture)
2. TTS/audio functions (different architecture)
3. Supporting utility functions

---

## Testing Checklist

For each migrated function:
- [ ] Template created in `prompt_templates` table
- [ ] Validation rules defined
- [ ] Output constraints specified
- [ ] User preferences integration tested
- [ ] Validation logging verified
- [ ] Performance metrics captured
- [ ] Edge cases handled (missing data, rate limits, etc.)
- [ ] Backward compatibility maintained

---

## Template Variable Conventions

### Standard Variables (use in all templates)
- `mentorName`: User's selected mentor name
- `mentorTone`: Mentor's personality/tone description
- `personalityModifiers`: User AI preference adjustments
- `responseLength`: brief/concise/detailed
- `maxSentences`: Maximum sentence count

### Context Variables
- `userMood`: Current mood state
- `userIntention`: Daily intention/goal
- `userStreak`: Current streak count
- `dailyContext`: Today's theme/pep talk
- `recentContext`: Recent activity summary
- `timeContext`: Time of day context

### Format Variables
- `sentenceCountMin`: Minimum sentences
- `sentenceCountMax`: Maximum sentences
- `outputFormat`: text/json/structured

---

## Migration Progress

**Overall Progress**: 9/24 functions migrated (37.5%)

**By Priority**:
- High Priority: 3/8 (37.5%)
- Medium Priority: 4/12 (33.3%)
- Low Priority: 2/4 (50%)

**Estimated Completion**: 
- All high-priority: ~2-3 days
- Complete migration: ~1 week

---

*Document maintained by: AI Systems Team*
*Last audit: 2025-11-23*
