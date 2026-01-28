

# Fix: Remove Emojis from Onboarding Intensity Mapping

## Problem
The screenshot shows emojis in the onboarding questionnaire options (🧠 CLARITY & MINDSET, ❤️ EMOTIONS & HEALING, etc.), but this appears to be a **cached version** of the app.

The actual code in `StoryQuestionnaire.tsx` (lines 47-52) is correct and emoji-free:
```tsx
{ text: "Clarity & mindset", tags: ["calm", "discipline"] },
{ text: "Emotions & healing", tags: ["healing", "supportive"] },
{ text: "Discipline & performance", tags: ["discipline", "momentum"] },
{ text: "Confidence & self-belief", tags: ["confidence", "supportive"] },
```

**However**, there is a related bug in `StoryOnboarding.tsx` (lines 84-88) where the intensity mapping still references the OLD emoji-prefixed answer strings:

```tsx
const GUIDANCE_TONE_TO_INTENSITY: Record<string, "high" | "medium" | "gentle"> = {
  "🌱 Gentle & compassionate": "gentle",   // ❌ Won't match
  "🤝 Encouraging & supportive": "medium", // ❌ Won't match  
  "🧘 Calm & grounded": "gentle",          // ❌ Won't match
  "⚔️ Direct & demanding": "high",         // ❌ Won't match
};
```

This means the intensity matching logic is **broken** and will always default to "medium".

---

## Solution

### Update `src/components/onboarding/StoryOnboarding.tsx` (lines 84-88)

Remove emojis from the mapping keys to match the current questionnaire options:

```tsx
const GUIDANCE_TONE_TO_INTENSITY: Record<string, "high" | "medium" | "gentle"> = {
  "Gentle & compassionate": "gentle",
  "Encouraging & supportive": "medium",
  "Calm & grounded": "gentle",
  "Direct & demanding": "high",
};
```

---

## Regarding the Screenshot

The emojis you're seeing are from a **cached build**. To see the latest version:
1. Force close the app completely
2. Clear browser/app cache
3. Re-open the app

The current deployed code in `StoryQuestionnaire.tsx` does NOT have emojis.

---

## Summary

| File | Change |
|------|--------|
| `src/components/onboarding/StoryOnboarding.tsx` | Remove emojis from `GUIDANCE_TONE_TO_INTENSITY` mapping keys |

This is a simple one-line fix that ensures the intensity matching works correctly with the emoji-free questionnaire options.

