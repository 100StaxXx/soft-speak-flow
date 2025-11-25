# Stage 0 Card Image Display Fix

## Problem
Stage 0 evolution cards were displaying Stage 1 images instead of the proper Stage 0 image in the Cards tab.

## Root Cause
When evolution cards were retroactively generated for missing stages during companion evolution, the stage 0 card generation had a fallback bug:

```typescript
evolutionId: evolutionRecord?.id || evolutionId
```

If the stage 0 evolution record didn't exist or couldn't be found, it would fall back to `evolutionId` (the current/new evolution's ID), causing stage 0 cards to reference stage 1+ evolution records.

Then, when the `EvolutionCardGallery` component fetched cards, it would overwrite the card's image_url with the image from the incorrectly-linked evolution record:

```typescript
image_url: (card.evolution_id && evolutionImageLookup[card.evolution_id]) || card.image_url
```

## Solution

### 1. Fixed Card Generation Logic (`src/hooks/useCompanion.ts`)
- Added special handling for stage 0 card generation
- When a stage 0 card is needed but no evolution record exists:
  - Creates a proper stage 0 evolution record using the companion's `initial_image_url`
  - Uses the companion's `created_at` timestamp
  - Sets `xp_at_evolution` to 0
- Only generates cards when a valid evolution ID exists for that stage
- Prevents the fallback to incorrect evolution IDs

### 2. Fixed Gallery Display Logic (`src/components/EvolutionCardGallery.tsx`)
- Changed the image resolution priority:
  - **Primary**: Use the card's own `image_url` if it exists
  - **Fallback**: Only use evolution lookup if card doesn't have its own image
- This prevents display issues even if cards were created with incorrect evolution_id references

### 3. Database Migration (`supabase/migrations/20251125_fix_stage_0_card_images.sql`)
- Creates missing stage 0 evolution records for all companions
- Updates existing stage 0 cards to point to correct stage 0 evolution records
- Sets proper image_url values from stage 0 evolutions or companion's initial_image_url
- Fixes any historical data corruption

## Files Changed
1. `/workspace/src/hooks/useCompanion.ts` - Fixed card generation logic
2. `/workspace/src/components/EvolutionCardGallery.tsx` - Fixed image display priority
3. `/workspace/supabase/migrations/20251125_fix_stage_0_card_images.sql` - Database fix migration

## Testing Recommendations
1. **New Companions**: Create a new companion and verify stage 0 card displays correct image
2. **Evolution**: Evolve a companion and verify all retroactive cards (including stage 0) have correct images
3. **Existing Data**: Run the migration and verify existing stage 0 cards now show correct images
4. **Cards Tab**: Check that the Cards tab displays all cards with their proper evolution stage images

## Prevention
The fix includes multiple layers of defense:
- Proper evolution record creation before card generation
- Validation that evolution IDs are correct for each stage
- Priority-based image resolution in the UI
- Database constraints to maintain data integrity

This ensures the issue cannot recur even if edge cases arise in the future.
