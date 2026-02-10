

# Fix Inbox Starfield Background Visibility

## Problem
The Inbox page renders `<StarfieldBackground />` but then its parent container has `bg-background` (an opaque dark color, `hsl(0 0% 7%)`), which completely covers the fixed-position starfield behind it.

## Fix

**File: `src/pages/Inbox.tsx`, line 78**

Change the outer div's class from:
```
bg-background
```
to:
```
bg-transparent
```

This lets the starfield show through, matching how the Quests and other pages display their cosmic background.

One class change, one file.
