
# Fix: Companion Dialogue Icon Should Show Companion Image

## Problem
The "Hello, friend." dialogue at the bottom of the Companion page shows a **yellow caution icon** (AlertTriangle from Lucide) instead of the companion's actual image. This is inconsistent with the talk popups that appear during activities, which correctly show the companion's portrait.

```text
Current Behavior:
┌──────────────────────────────────────────────────────────────────┐
│  ⚠️  "Hello, friend."                                           │
│ (AlertTriangle icon for "concerned" mood)                        │
└──────────────────────────────────────────────────────────────────┘

Expected Behavior:
┌──────────────────────────────────────────────────────────────────┐
│  🐋  "Hello, friend."                                           │
│ (Companion image with mood-colored ring/glow)                   │
└──────────────────────────────────────────────────────────────────┘
```

## Root Cause
The `CompanionDialogue` component uses a `moodConfig` that maps dialogue moods to Lucide icons:
- `thriving` → Sparkles (gold)
- `content` → MessageCircle (blue)
- `concerned` → **AlertTriangle (amber)** ← This is showing
- `desperate` → Heart (red)
- `recovering` → RefreshCw (green)

Since the companion's care level is "concerned" (based on care signals), the AlertTriangle icon is rendered.

## Solution
Update `CompanionDialogue` to display the companion's actual image (like `CompanionTalkPopup` does) instead of static mood icons.

### Changes to `src/components/companion/CompanionDialogue.tsx`

1. **Import companion hook and Avatar components**
   ```typescript
   import { useCompanion } from "@/hooks/useCompanion";
   import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
   ```

2. **Get companion data in the component**
   ```typescript
   const { companion } = useCompanion();
   const companionImageUrl = companion?.current_image_url;
   const companionName = companion?.spirit_animal || "Companion";
   ```

3. **Simplify moodConfig** (remove icons, keep just colors)
   ```typescript
   const moodConfig: Record<DialogueMood, MoodConfig> = {
     thriving: { color: "text-cosmiq-glow", ringColor: "ring-cosmiq-glow/50" },
     content: { color: "text-celestial-blue", ringColor: "ring-celestial-blue/50" },
     concerned: { color: "text-amber-400", ringColor: "ring-amber-400/50" },
     desperate: { color: "text-destructive", ringColor: "ring-destructive/50" },
     recovering: { color: "text-green-400", ringColor: "ring-green-400/50" },
   };
   ```

4. **Replace the icon div with Avatar** (like CompanionTalkPopup)
   ```tsx
   <div className={cn(
     "flex-shrink-0 rounded-lg overflow-hidden",
     "ring-2", config.ringColor
   )}>
     <Avatar className="h-10 w-10 rounded-lg">
       {companionImageUrl ? (
         <AvatarImage 
           src={companionImageUrl} 
           alt={companionName}
           className="object-cover"
         />
       ) : null}
       <AvatarFallback className="rounded-lg bg-primary/20 text-primary">
         {companionName.charAt(0).toUpperCase()}
       </AvatarFallback>
     </Avatar>
   </div>
   ```

## Files to Change

| File | Change |
|------|--------|
| `src/components/companion/CompanionDialogue.tsx` | Replace Lucide icons with companion Avatar image |

## Technical Details

- The Avatar uses the companion's `current_image_url` from `useCompanion()`
- Mood is still reflected through the ring color around the avatar (gold for thriving, amber for concerned, etc.)
- Falls back to showing the first letter of `spirit_animal` if no image is available
- Matches the visual style used in `CompanionTalkPopup` for consistency

## Visual Result

After the fix:
- The dialogue section will show the companion's actual portrait
- The portrait will have a colored ring indicating mood (amber ring for "concerned")
- Matches the same aesthetic as activity completion popups
