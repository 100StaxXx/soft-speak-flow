
# Fix: Use Single Universal Voice Template for All Species

## Problem

The current `useCompanionDialogue` hook queries `companion_voice_templates` by species name:
```typescript
.eq('species', species)  // e.g., 'blue whale'
```

Since only 10 species have templates (wolf, fox, cat, etc.), companions like "Blue Whale" get no template and fall back to the generic "Hello, friend." message.

**You want ONE universal template** that works for all 65 species.

## Solution

### Part 1: Update `useCompanionDialogue.ts`

Change the query to always fetch a universal template instead of querying by species:

```typescript
// BEFORE: Queries by species (fails for Blue Whale)
const species = companion?.spirit_animal?.toLowerCase() || 'wolf';
...
.eq('species', species)

// AFTER: Always fetch the universal template
.eq('species', 'universal')
```

Remove the species-based query key since it's no longer relevant:
```typescript
queryKey: ['companion-voice-template'],  // No species needed
```

### Part 2: Database Migration

Create a single universal template row that consolidates the best dialogue lines:

```sql
-- Insert universal template (or update if exists)
INSERT INTO companion_voice_templates (species, voice_style, personality_traits, ...)
VALUES ('universal', 'Speaks with warmth and encouragement...', ...)
ON CONFLICT (species) DO UPDATE SET ...;

-- Optionally: Remove species-specific templates to keep table clean
DELETE FROM companion_voice_templates WHERE species != 'universal';
```

## Files to Change

| File | Change |
|------|--------|
| `src/hooks/useCompanionDialogue.ts` | Query for 'universal' template instead of by species |
| New migration | Create universal template, optionally remove species-specific ones |

## Technical Details

The `pickRandom` function can still use the companion's spirit animal as part of the seed for randomization, so different species will still get varied greetings from the same pool—just not species-*specific* dialogue.

```typescript
// Seed still includes companion name for variety
const seed = `${new Date().toDateString()}-${contextKey}-${companion?.spirit_animal}`;
```

## Expected Result

- All 65 species use the same universal dialogue pool
- No more "Hello, friend." fallback for species without templates
- Simpler, more maintainable system with one template to update
