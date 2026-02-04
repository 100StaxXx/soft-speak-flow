
# Add Mentor Gender Preference to Onboarding

## Summary

Adding an inclusive "mentor energy" preference question to the onboarding flow. This will help match users with mentors they'll connect with better by applying a gender preference boost to the scoring algorithm.

## Current Mentor Distribution

| Mentor | Gender | Short Title |
|--------|--------|-------------|
| Atlas | Masculine | Stoic Wisdom |
| Eli | Masculine (needs DB tag) | Steady Encouragement |
| Stryker | Masculine | High Performance |
| Carmen | Feminine | Feminine Tough Love |
| Reign | Feminine | Elite Performance |
| Sienna | Feminine | Soft Healing |
| Solace | Feminine | Warm Encouragement |

**Final: 3 masculine, 4 feminine**

---

## Question Design

### Placement
Insert as **Question 1** (before the existing focus/tone/progress questions) - this is a high-level filter that should come first.

### Question Text
> "What kind of mentor energy resonates with you?"

### Options

| Option | Tags | Effect |
|--------|------|--------|
| Feminine presence | `["feminine_preference"]` | +1.5 boost to feminine mentors |
| Masculine presence | `["masculine_preference"]` | +1.5 boost to masculine mentors |
| Either works for me | `[]` | No gender weighting (current behavior) |

### Faction Narratives
```text
starfall: "Before you chart your course, the cosmos asks one question..."
void: "In the stillness, a presence awaits. What form does it take?"
stellar: "The stars align to reveal your guide. Who do you see among them?"
```

---

## Technical Implementation

### Step 1: Database - Add masculine tag to Eli

Update Eli's tags in the `mentors` table to include `masculine` for proper matching.

```sql
UPDATE public.mentors 
SET tags = array_append(tags, 'masculine')
WHERE slug = 'eli' AND NOT ('masculine' = ANY(tags));
```

### Step 2: Update StoryQuestionnaire.tsx

Add the new question at the beginning of the `questions` array:

```typescript
const questions: StoryQuestion[] = [
  {
    id: "mentor_energy",
    narrative: "",
    question: "What kind of mentor energy resonates with you?",
    options: [
      { text: "Feminine presence", tags: ["feminine_preference"] },
      { text: "Masculine presence", tags: ["masculine_preference"] },
      { text: "Either works for me", tags: [] },
    ],
  },
  // ... existing questions
];
```

Update `getFactionNarrative` to handle 4 questions (add new narratives for Q1):

```typescript
const narratives: Record<FactionType, string[]> = {
  starfall: [
    "Before you chart your course, the cosmos asks one question...",
    "As flames dance in the distance, your ship awaits its next destination...",
    "The engines hum with potential energy. Your crew looks to you for direction...",
    "Your path grows clearer with each choice...",
  ],
  void: [
    "In the stillness, a presence awaits. What form does it take?",
    "In the silent depths between stars, clarity emerges from stillness...",
    "The void speaks to those who listen. A whisper guides your path...",
    "The shadows reveal what light cannot...",
  ],
  stellar: [
    "The stars align to reveal your guide. Who do you see among them?",
    "Nebulas paint the cosmos in infinite colors. Each holds a dream...",
    "Your companion gazes at the stars with wonder. What do you see?",
    "The constellations align to show your way...",
  ],
};
```

### Step 3: Update StoryOnboarding.tsx - Scoring Logic

Add gender preference scoring after calculating trait scores (around line 270):

```typescript
// Extract gender preference from answers
const genderAnswer = questionAnswers.find(a => a.questionId === "mentor_energy");
const prefersFeminine = genderAnswer?.tags.includes("feminine_preference");
const prefersMasculine = genderAnswer?.tags.includes("masculine_preference");

// Apply gender preference boost during scoring
mentorScores.forEach(mentorScore => {
  const mentorTags = mentorScore.mentor.tags || [];
  const isFeminine = mentorTags.includes("feminine");
  const isMasculine = mentorTags.includes("masculine");
  
  if (prefersFeminine && isFeminine) {
    mentorScore.score += 1.5;  // Strong boost
  } else if (prefersMasculine && isMasculine) {
    mentorScore.score += 1.5;  // Strong boost
  }
  // "Either works" = no boost applied
});
```

### Step 4: Update Question Weights

Adjust `QUESTION_WEIGHTS` array to account for 4 questions:

```typescript
// Q1=1.0 (energy - filtered separately), Q2=1.5 (focus), Q3=1.3 (tone), Q4=1.1 (progress)
const QUESTION_WEIGHTS = [1.0, 1.5, 1.3, 1.1];
```

### Step 5: Save Preference to Profile

Store the preference in `onboarding_data` (no schema change needed):

```typescript
// In handleQuestionnaireComplete, when saving to profile:
const genderPref = questionAnswers.find(a => a.questionId === "mentor_energy")?.answer;

await supabase.from("profiles").update({
  onboarding_data: {
    ...existingData,
    mentorEnergyPreference: genderPref || "no_preference",
  },
}).eq("id", user.id);
```

---

## Flow After Changes

```text
New User Flow:
┌─────────────────────────────────────┐
│ Q1: "What kind of mentor energy    │
│      resonates with you?"           │
│  • Feminine presence                │
│  • Masculine presence               │
│  • Either works for me              │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ Q2: "What do you want to work on?" │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ Q3: "How do you want guidance?"    │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ Q4: "What helps you progress?"     │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ Mentor Matching Algorithm          │
│  • Calculate trait scores          │
│  • Apply gender preference boost   │
│  • Apply intensity matching        │
│  • Select best match               │
└─────────────────────────────────────┘
```

---

## Files to Modify

| File | Change |
|------|--------|
| `mentors` table | Add `masculine` tag to Eli |
| `src/components/onboarding/StoryQuestionnaire.tsx` | Add mentor energy question as Q1, update faction narratives for 4 questions |
| `src/components/onboarding/StoryOnboarding.tsx` | Add gender preference scoring boost, update question weights array |

---

## Why This Approach

1. **Inclusive** - "Either works for me" is a valid first-class option, not an afterthought
2. **Non-invasive** - Asks about mentor preference, not personal gender identity
3. **Relevant** - Directly impacts the mentorship matching
4. **Simple** - Uses existing tag system, no new database columns needed
5. **Balanced** - 3 masculine vs 4 feminine mentors gives good options for both preferences
