
# Add Subtitle Under "Quests" Title

## Change

Insert the subtitle **"Daily quests. Your path to progress."** beneath the "Quests" heading in `src/pages/Journeys.tsx`.

## Details

In `src/pages/Journeys.tsx`, after the `<h1>` tag on line 617-619, add:

```tsx
<p className="text-sm text-muted-foreground">Daily quests. Your path to progress.</p>
```

This sits inside the existing `motion.div` wrapper (lines 607-620) so it animates in with the title. No other files need changes.
