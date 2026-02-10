
# Add Hero Title to Inbox Page (Matching Quests Style)

## What Changes
Replace the current small sticky header with a hero-style animated title matching the Quests page layout.

## Details

**File: `src/pages/Inbox.tsx`**

Replace the current sticky header (lines 80-93) with a centered, animated hero title block:

- Large gradient heading: **"Inbox"** using `text-4xl font-bold` with a `from-celestial-blue to-blue-400` gradient (blue theme to match the Inbox's celestial-blue accent, vs the purple gradient on Quests)
- Tagline underneath: **"Capture now. Conquer later."** in `text-sm text-muted-foreground`
- Badge showing inbox count inline below the tagline (when count > 0)
- Wrapped in a `motion.div` with the same fade-in animation as Quests (`opacity: 0, y: -20` to `opacity: 1, y: 0`)
- Centered layout with `text-center` and `mb-6`, matching the Quests hero spacing

This removes the sticky bar in favor of the same open, spacious hero pattern used on the Quests page.
