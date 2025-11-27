# Bug Report: Story Card Feature

## Date: November 27, 2025
## Feature: ShareableStoryCard Component & Modal Integration

---

## 🔴 CRITICAL BUGS

### 1. Missing Placeholder Images
**File:** `src/components/CompanionStoryJournal.tsx`  
**Lines:** 47, 59, 62, 65, 212-213  
**Severity:** HIGH

**Issue:**  
The code references placeholder images that don't exist in the public folder:
- `/placeholder-egg.png` (referenced but doesn't exist)
- `/placeholder-companion.png` (referenced but doesn't exist)

**Current State:**
```typescript
return companion.current_image_url || '/placeholder-egg.png';
return companion.current_image_url || '/placeholder-companion.png';
```

**Available file:**
- `/placeholder.svg` exists but is not being used

**Impact:**
- Broken images when companion images fail to load
- Poor user experience during image loading errors
- 404 errors in the browser console

**Recommendation:**
Either create the missing PNG files or update the code to use the existing `placeholder.svg`.

---

## ⚠️ MEDIUM PRIORITY BUGS

### 2. Potential Null/Undefined Error in File Download
**File:** `src/components/ShareableStoryCard.tsx`  
**Lines:** 34, 58  
**Severity:** MEDIUM

**Issue:**  
The `story.chapter_title` is used without null checking in string operations:
```typescript
link.download = `${story.chapter_title.replace(/\s+/g, '-').toLowerCase()}-story.png`;
const file = new File([blob], `${story.chapter_title}-story.png`, ...);
```

**Potential Error:**
If `chapter_title` is `null` or `undefined`, this will throw:
```
TypeError: Cannot read property 'replace' of null/undefined
```

**Current Protection:**
The component expects `story` prop to be defined (TypeScript interface), but there's no runtime validation of the `chapter_title` property specifically.

**Recommendation:**
Add defensive coding:
```typescript
const fileName = (story.chapter_title || 'story').replace(/\s+/g, '-').toLowerCase();
link.download = `${fileName}-story.png`;
```

---

### 3. Modal Width May Be Too Narrow on Desktop
**File:** `src/components/CompanionStoryJournal.tsx`  
**Line:** 377  
**Severity:** LOW-MEDIUM

**Issue:**  
The DialogContent uses `max-w-md` (448px), which may be too narrow for the story card's 3:4 aspect ratio.

```typescript
<DialogContent className="max-w-md">
```

**Impact:**
- The card's aspect ratio (3:4) within a max-width of 448px results in a card that's only ~336px tall
- On larger screens, users might expect a bigger preview
- The companion image (192px x 192px) may look cramped

**Current Card Dimensions:**
- Aspect ratio: 3:4 (set at line 98 of ShareableStoryCard.tsx)
- Max dialog width: 448px
- Resulting card height: ~597px (with padding)

**Recommendation:**
Consider increasing to `max-w-lg` (512px) or `max-w-xl` (576px) for better visual presentation on desktop while maintaining mobile responsiveness.

---

## 🟡 LOW PRIORITY ISSUES

### 4. No Loading State for html-to-image Processing
**File:** `src/components/ShareableStoryCard.tsx`  
**Lines:** 28-43, 52-55  
**Severity:** LOW

**Issue:**  
The `toPng` function can take 1-3 seconds for complex cards, but only the Share button shows processing state.

**Current State:**
- Download button doesn't show loading/disabled state during download processing
- Only `shareCard` function sets `isProcessing` state

**Impact:**
- User can click Download multiple times rapidly
- No visual feedback during download generation
- Potential for multiple simultaneous downloads

**Recommendation:**
Add processing state to `downloadCard` function:
```typescript
const downloadCard = async () => {
  if (!cardRef.current || isProcessing) return;
  setIsProcessing(true);
  try {
    // ... existing code
  } finally {
    setIsProcessing(false);
  }
};
```

---

### 5. Accessibility: Missing Alt Text Context
**File:** `src/components/ShareableStoryCard.tsx`  
**Line:** 133  
**Severity:** LOW

**Issue:**  
The companion image alt text could be more descriptive:
```typescript
alt={companionName}
```

**Recommendation:**
```typescript
alt={`${companionName} at Stage ${stage}`}
```

---

### 6. Gallery Display Issue (Minor Layout)
**File:** `src/components/CompanionStoryJournal.tsx`  
**Line:** 125  
**Severity:** LOW

**Issue:**  
The gallery card appears before the header, causing a visual jump when toggled:
```typescript
<div className="space-y-6 max-w-4xl mx-auto p-4">{showGallery && (
  <Card className="p-6">
```

**Recommendation:**
Move gallery after the header section for better flow (after line 182).

---

## ✅ WORKING CORRECTLY

### Features That Work Well:

1. **TypeScript Build** - No compilation errors ✓
2. **Dialog Integration** - Modal opens/closes correctly ✓
3. **Share Functionality** - Proper Web Share API with fallback ✓
4. **Error Handling** - Share errors are caught and handled gracefully ✓
5. **Cancel Detection** - AbortError handling prevents false error messages ✓
6. **Image Generation** - html-to-image integration works ✓
7. **Visual Design** - Card design is attractive with proper gradients ✓
8. **Responsive Grid** - Gallery grid is responsive ✓

---

## 🔧 RECOMMENDATIONS

### Priority Order for Fixes:

1. **HIGH PRIORITY** - Fix missing placeholder images (Bug #1)
2. **MEDIUM PRIORITY** - Add null safety for chapter_title (Bug #2)
3. **LOW PRIORITY** - Improve modal width (Bug #3)
4. **LOW PRIORITY** - Add download loading state (Bug #4)
5. **NICE TO HAVE** - Improve accessibility (Bug #5)
6. **NICE TO HAVE** - Reorder gallery position (Bug #6)

---

## 📝 TEST CHECKLIST

To verify fixes:

- [ ] Test with missing companion images (placeholder should display)
- [ ] Test with undefined/null chapter_title
- [ ] Test on mobile devices (320px to 768px width)
- [ ] Test on desktop (> 1024px width)
- [ ] Test share functionality on iOS Safari
- [ ] Test share functionality on Android Chrome
- [ ] Test download functionality on all browsers
- [ ] Test rapid clicking of buttons
- [ ] Test with screen readers
- [ ] Test in dark mode
- [ ] Test stage 0 (Prologue/Egg state)
- [ ] Test stage 1-20
- [ ] Test with very long chapter titles
- [ ] Test with companion that has never evolved

---

## 📊 SEVERITY DEFINITIONS

- **CRITICAL**: Causes crashes or complete feature failure
- **HIGH**: Causes broken UI elements or poor UX
- **MEDIUM**: Causes potential errors under specific conditions
- **LOW**: Minor UX improvements or edge cases

