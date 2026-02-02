

# Enable Custom Deadline Date Picker in Pathfinder

## Problem

In the Pathfinder wizard (step 1), clicking the date display button showing "TUESDAY, FEBRUARY 2, 2027 (364 DAYS)" should open a calendar picker to select a custom date. While the code exists to do this, it may not be working reliably on iOS/mobile due to popover-inside-dialog issues.

## Current Behavior

- Quick preset buttons (2 weeks, 1 month, etc.) work correctly
- The date display button is supposed to open a calendar popover
- On mobile/iOS, the popover may not open or may render behind the dialog

## Solution

Update the `DeadlinePicker` component to ensure the calendar popover works correctly inside the Pathfinder dialog:

1. Add `modal` prop to the Popover for proper dialog-inside-dialog handling
2. Increase z-index on PopoverContent to ensure it appears above the dialog
3. Ensure `pointer-events-auto` is applied to both the PopoverContent and Calendar

---

## Changes

### File: `src/components/JourneyWizard/DeadlinePicker.tsx`

```typescript
// Change Popover to modal mode for proper interaction inside dialogs
<Popover open={isOpen} onOpenChange={setIsOpen} modal>
  {/* ... PopoverTrigger unchanged ... */}
  
  <PopoverContent 
    className="w-auto p-0 z-[100] pointer-events-auto" 
    align="start"
    // Prevent scroll on mobile when popover is open
    onOpenAutoFocus={(e) => e.preventDefault()}
  >
    <Calendar
      mode="single"
      selected={value}
      onSelect={(date) => {
        onChange(date);
        setIsOpen(false);
      }}
      disabled={(date) => date < effectiveMinDate}
      initialFocus
      className="pointer-events-auto"
      captionLayout="dropdown"
      fromYear={new Date().getFullYear()}
      toYear={new Date().getFullYear() + 10}
    />
  </PopoverContent>
</Popover>
```

---

## Technical Details

| Change | Purpose |
|--------|---------|
| `modal` prop on Popover | Ensures proper focus management and event handling when nested inside a dialog |
| `z-[100]` on PopoverContent | Higher than the dialog's z-50 to ensure calendar appears on top |
| `pointer-events-auto` on PopoverContent | Ensures touch events work on mobile/iOS |
| `onOpenAutoFocus={(e) => e.preventDefault()}` | Prevents scroll jumping on mobile when popover opens |

## Result

After this change, clicking the date display button will reliably open the calendar picker on all devices (desktop, iOS, Android), allowing users to select any custom deadline date.

