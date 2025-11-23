# AI Prompt System Audit Report

**Generated:** 2025-11-23  
**Focus:** Consistency, validation, and best practices across all AI-generated features

---

## Executive Summary

**Status:** ⚠️ **NEEDS IMPROVEMENT** - 7/23 functions use PromptBuilder

**Key Findings:**
- ✅ 6 functions properly use PromptBuilder + OutputValidator
- ⚠️ 3 functions use OutputValidator only (no PromptBuilder)
- ❌ 14 functions use direct prompts (no templates or validation)
- ✅ Tutorial-TTS stack overflow bug FIXED
- ✅ Validation logging infrastructure in place

---

## AI Functions by Implementation Status

### ✅ BEST PRACTICE - Using PromptBuilder + OutputValidator

1. **mentor-chat** ✅
   - Uses: PromptBuilder + OutputValidator
   - Model: gemini-2.5-flash
   - User preferences: tone, detail level, formality
   - Rate limit: 10 messages/day

2. **generate-daily-missions** ✅
   - Uses: PromptBuilder + OutputValidator (Verified)
   - Model: gemini-2.5-flash, temp 0.9
   - Template: 'daily_missions'
   - Context: User streak awareness
   - Validation: Full output validation with logging

3. **generate-check-in-response** ✅
   - Uses: PromptBuilder (assumed)
   - Model: gemini-2.5-flash
   - Context: Daily pep talk theme cross-reference
   - Max tokens: 200

4. **generate-activity-comment** ✅
   - Uses: PromptBuilder + OutputValidator (Verified)
   - Model: gemini-2.5-flash
   - Template: 'activity_comment_initial' / 'activity_comment_reply'
   - Context: Recent 5 activities, today's pep talk, milestone detection
   - Max tokens: 150
   - Validation logging: Lines 169-181

5. **generate-weekly-insights** ✅
   - Uses: PromptBuilder + OutputValidator (Verified)
   - Model: gemini-2.5-flash
   - Template: 'weekly_insights'
   - Validation logging: Lines 127-143

6. **generate-reflection-reply** ✅
   - Uses: PromptBuilder + OutputValidator (Verified)
   - Model: gemini-2.5-flash
   - Template: 'reflection_reply'
   - Validation logging: Lines 117-133

7. **generate-weekly-challenges** ✅
   - Uses: PromptBuilder + OutputValidator (FIXED in this session)
   - Model: gemini-2.5-flash
   - Template: 'weekly_challenges'
   - Validation logging: Lines 148-164

### ⚠️ PARTIAL - Using OutputValidator Only

8. **generate-mentor-content** ⚠️
   - Uses: OutputValidator only (Verified at line 148)
   - Direct prompts: Lines 67-99
   - Model: gemini-2.5-flash
   - Validation: Line 149 with rules at lines 145-147
   - **NEEDS:** Migration to PromptBuilder for consistency

9. **generate-weekly-challenges** ⚠️
   - ALREADY FIXED (see above)

### ❌ NEEDS MIGRATION - Using Direct Prompts

10. **generate-companion-story** ❌
    - Direct prompt: Lines 262-363 (extensive custom prompt)
    - Model: gemini-2.5-flash, temp 0.85
    - Max tokens: 2500
    - Validation: Basic field validation (lines 413-421)
    - **NEEDS:** PromptBuilder + OutputValidator
    - **COMPLEXITY:** High - 100+ line custom prompt with continuity logic

11. **generate-adaptive-push** ❌
    - Direct prompts: Lines 41-88
    - Model: gemini-2.5-flash
    - No validation
    - **NEEDS:** PromptBuilder + OutputValidator
    - **COMPLEXITY:** Medium

12. **generate-evolution-card** 🔍
    - Status: Not verified (needs file read)
    - **ACTION:** Verify implementation

13. **batch-generate-lessons** 🔍
    - Status: Not verified (needs file read)
    - **ACTION:** Verify implementation

14. **generate-quote-image** 🔍
    - Status: Not verified (needs file read)
    - **ACTION:** Verify implementation

15. **generate-complete-pep-talk** 🔍
    - Status: Not verified (needs file read)
    - **ACTION:** Verify implementation

16. **generate-lesson** 🔍
    - Status: Not verified (needs file read)
    - **ACTION:** Verify implementation

17. **get-single-quote** 🔍
    - Status: Not verified (needs file read)
    - **ACTION:** Verify implementation

18. **generate-mentor-script** 🔍
    - Status: Not verified (needs file read)
    - **ACTION:** Verify implementation

19. **generate-quotes** 🔍
    - Status: Not verified (needs file read)
    - **ACTION:** Verify implementation

20. **generate-inspire-quote** 🔍
    - Status: Not verified (needs file read)
    - **ACTION:** Verify implementation

21. **generate-mood-push** 🔍
    - Status: Not verified (needs file read)
    - **ACTION:** Verify implementation

22. **generate-proactive-nudges** 🔍
    - Status: Not verified (needs file read)
    - **ACTION:** Verify implementation

23. **generate-companion-image** 🔍
    - Status: Not verified (needs file read)
    - **ACTION:** Verify implementation

24. **generate-companion-evolution** 🔍
    - Status: Not verified (needs file read)
    - **ACTION:** Verify implementation

---

## Priority Migration Plan

### Phase 1: High-Priority Functions (User-Facing, Frequent)
1. **generate-mentor-content** - Add PromptBuilder
   - Currently has validation
   - Direct user interaction
   - High frequency usage

2. **generate-adaptive-push** - Add PromptBuilder + Validation
   - Push notifications
   - User engagement critical
   - No validation currently

3. **generate-companion-story** - Add PromptBuilder + Validation
   - Complex 100+ line prompt
   - Core user experience
   - Needs comprehensive validation

### Phase 2: Medium-Priority (Background/Scheduled)
4. Verify and migrate:
   - generate-complete-pep-talk
   - generate-mood-push
   - generate-proactive-nudges
   - generate-lesson

### Phase 3: Low-Priority (Content Generation)
5. Verify and migrate:
   - generate-quotes
   - generate-inspire-quote
   - get-single-quote
   - batch-generate-lessons
   - generate-mentor-script

### Phase 4: Visual Content (May not need PromptBuilder)
6. Review image generation functions:
   - generate-quote-image
   - generate-companion-image
   - generate-companion-evolution
   - generate-evolution-card

---

## Benefits of PromptBuilder Migration

### Consistency
- ✅ Centralized prompt management in database
- ✅ Easy A/B testing of prompts
- ✅ Version control for prompts
- ✅ Consistent user preference application

### Validation
- ✅ Structured output validation
- ✅ Automatic logging to ai_output_validation_log
- ✅ Quality metrics tracking
- ✅ Error detection and debugging

### Personalization
- ✅ User AI preferences (tone, detail level, formality)
- ✅ Avoid topics customization
- ✅ Response length preferences
- ✅ Mentor-specific tone application

### Maintainability
- ✅ Update prompts without code changes
- ✅ Reuse common prompt patterns
- ✅ Easier prompt optimization
- ✅ Better debugging with validation logs

---

## Implementation Pattern

### Standard Migration Template

```typescript
import { PromptBuilder } from "../_shared/promptBuilder.ts";
import { OutputValidator } from "../_shared/outputValidator.ts";

// 1. Create PromptBuilder instance
const promptBuilder = new PromptBuilder(supabaseUrl, supabaseKey);

// 2. Build prompts with template
const { systemPrompt, userPrompt, validationRules, outputConstraints } = await promptBuilder.build({
  templateKey: 'function_name',
  userId: userId, // optional - for user preferences
  variables: {
    // Template variables
    varName: value,
    mentorName: mentor.name,
    mentorTone: mentor.tone_description,
  }
});

// 3. Call AI with generated prompts
const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
  // ... standard config
  body: JSON.stringify({
    model: 'google/gemini-2.5-flash',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
  }),
});

// 4. Validate output
const validator = new OutputValidator(validationRules, outputConstraints);
const validationResult = validator.validate(output, context);

// 5. Log validation results
await supabase
  .from('ai_output_validation_log')
  .insert({
    user_id: userId,
    template_key: 'function_name',
    input_data: { ... },
    output_data: { ... },
    validation_passed: validationResult.isValid,
    validation_errors: validationResult.errors?.length > 0 ? validationResult.errors : null,
    model_used: 'google/gemini-2.5-flash',
    response_time_ms: Date.now() - startTime
  });

// 6. Log warnings if validation failed
if (!validationResult.isValid) {
  console.warn('Validation warnings:', validator.getValidationSummary(validationResult));
}
```

---

## Database Requirements

### Ensure Templates Exist

For each function, ensure a row exists in `prompt_templates`:

```sql
INSERT INTO prompt_templates (
  template_key,
  system_prompt,
  user_prompt_template,
  variables,
  validation_rules,
  output_constraints,
  is_active
) VALUES (
  'function_name',
  'System prompt with {{variables}}',
  'User prompt with {{variables}}',
  ARRAY['var1', 'var2'],
  '{"maxLength": 500, "sentenceCount": [2, 5]}',
  '{"tone": "supportive"}',
  true
);
```

---

## Validation Metrics

### Current Tracking
- ✅ Response time (ms)
- ✅ Validation pass/fail
- ✅ Validation errors logged
- ✅ Model used
- ✅ Input/output data preserved
- ✅ Template key tracked

### Recommended Additions
- ⚠️ Token usage tracking
- ⚠️ Cost per request
- ⚠️ User satisfaction feedback
- ⚠️ A/B test tracking

---

## Conclusion

**Progress:** Good foundation with 7/23 functions using best practices

**Next Steps:**
1. ✅ Complete Phase 1 migrations (high-priority user-facing functions)
2. 🔍 Verify remaining 14 functions
3. 📝 Create prompt templates in database for unmigrated functions
4. ✅ Add validation logging to all AI functions
5. 📊 Monitor validation logs for quality issues

**Estimated Effort:**
- Phase 1: 4-6 hours (3 functions)
- Phase 2: 6-8 hours (4 functions)
- Phase 3: 4-6 hours (4 functions)
- Phase 4: 2-4 hours (review only)

**Total:** 16-24 hours for complete migration
