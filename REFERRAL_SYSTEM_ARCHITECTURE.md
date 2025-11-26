# Referral Skin System - Architecture Diagram

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           SUPABASE DATABASE                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────────┐      ┌─────────────────────┐                     │
│  │   profiles       │      │  companion_skins     │                     │
│  ├──────────────────┤      ├─────────────────────┤                     │
│  │ id               │      │ id                   │                     │
│  │ referral_code ◄──┼──┐   │ name                 │                     │
│  │ referred_by      │  │   │ description          │                     │
│  │ referral_count   │  │   │ skin_type            │                     │
│  └──────────────────┘  │   │ unlock_type          │                     │
│           │             │   │ unlock_requirement   │                     │
│           │             │   │ css_effect (JSONB)   │                     │
│           │             │   │ rarity               │                     │
│           │             │   └─────────────────────┘                     │
│           │             │              │                                 │
│           │             │              │                                 │
│           └─────────────┼──────────────┼─────────────┐                 │
│                         │              │             │                 │
│                         │              ▼             ▼                 │
│                         │   ┌─────────────────────────────────┐       │
│                         │   │  user_companion_skins            │       │
│                         │   ├─────────────────────────────────┤       │
│                         └──►│ user_id (FK → profiles)          │       │
│                             │ skin_id (FK → companion_skins)   │       │
│                             │ is_equipped                      │       │
│                             │ acquired_via                     │       │
│                             │ acquired_at                      │       │
│                             └─────────────────────────────────┘       │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ TRIGGERS & FUNCTIONS                                            │    │
│  ├────────────────────────────────────────────────────────────────┤    │
│  │ • generate_referral_code() → Returns unique REF-XXXXXXXX       │    │
│  │ • set_referral_code_trigger → Auto-fills referral_code on      │    │
│  │   profile creation (BEFORE INSERT)                             │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ Supabase Client
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          REACT FRONTEND                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ HOOKS (Data Layer)                                                │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │                                                                    │  │
│  │  useReferrals()                                                   │  │
│  │  ├─ referralStats (code, count, referred_by)                     │  │
│  │  ├─ availableSkins (all referral skins)                          │  │
│  │  ├─ unlockedSkins (user's unlocked skins)                        │  │
│  │  ├─ applyReferralCode(code)                                      │  │
│  │  ├─ equipSkin(skinId)                                            │  │
│  │  └─ unequipSkin()                                                │  │
│  │                                                                    │  │
│  │  useCompanion()                                                   │  │
│  │  ├─ companion (current companion data)                           │  │
│  │  ├─ awardXP()                                                     │  │
│  │  ├─ evolveCompanion()                                            │  │
│  │  └─ validateReferralAtStage3() ◄── Called at Stage 3            │  │
│  │                                                                    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                          │                                               │
│                          │                                               │
│                          ▼                                               │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ COMPONENTS (UI Layer)                                             │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │                                                                    │  │
│  │  ┌───────────────────────────────────────────────────────────┐  │  │
│  │  │ OnboardingFlow                                             │  │  │
│  │  │  └─► ReferralCodeInput ◄── First screen in onboarding    │  │  │
│  │  │       ├─ Input field (REF-XXXXXXXX)                       │  │  │
│  │  │       ├─ Skip button                                       │  │  │
│  │  │       └─ Submit → applyReferralCode()                     │  │  │
│  │  └───────────────────────────────────────────────────────────┘  │  │
│  │                                                                    │  │
│  │  ┌───────────────────────────────────────────────────────────┐  │  │
│  │  │ Profile Page                                               │  │  │
│  │  │  └─► Tab: "Referrals"                                     │  │  │
│  │  │       │                                                     │  │  │
│  │  │       ├─► ReferralDashboard                               │  │  │
│  │  │       │    ├─ Referral Code Display                       │  │  │
│  │  │       │    ├─ Copy Button                                 │  │  │
│  │  │       │    ├─ Share Button (iOS Share Sheet)              │  │  │
│  │  │       │    ├─ Stats (count, next milestone)               │  │  │
│  │  │       │    └─ Next Reward Preview                         │  │  │
│  │  │       │                                                     │  │  │
│  │  │       └─► CompanionSkins                                  │  │  │
│  │  │            ├─ Grid of all skins                           │  │  │
│  │  │            ├─ Locked/Unlocked/Equipped states             │  │  │
│  │  │            ├─ Progress bars                               │  │  │
│  │  │            └─ Equip/Unequip buttons                       │  │  │
│  │  └───────────────────────────────────────────────────────────┘  │  │
│  │                                                                    │  │
│  │  ┌───────────────────────────────────────────────────────────┐  │  │
│  │  │ CompanionDisplay                                           │  │  │
│  │  │  ├─ Fetches equipped skin via useReferrals()              │  │  │
│  │  │  ├─ Parses css_effect JSONB                               │  │  │
│  │  │  └─ Applies dynamic styles to companion image             │  │  │
│  │  │     ├─ Aura: boxShadow + filter                           │  │  │
│  │  │     ├─ Frame: border + shimmer                            │  │  │
│  │  │     └─ Overlay: image overlay (future)                    │  │  │
│  │  └───────────────────────────────────────────────────────────┘  │  │
│  │                                                                    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagrams

### Flow 1: New User Applies Referral Code

```
┌─────────────┐
│  New User   │
│  (Sam)      │
└──────┬──────┘
       │
       │ Opens app
       ▼
┌─────────────────────┐
│ OnboardingFlow      │
│ ┌─────────────────┐ │
│ │ReferralCodeInput│ │
│ └────────┬────────┘ │
└──────────┼──────────┘
           │
           │ Enters: REF-ALEX-7K2X
           ▼
    ┌──────────────┐
    │useReferrals()│
    └──────┬───────┘
           │
           │ applyReferralCode.mutateAsync()
           ▼
    ┌─────────────────────────────┐
    │ SUPABASE                     │
    │ 1. Fetch profile by code     │
    │    (Alex's profile)          │
    │ 2. Validate:                 │
    │    ✓ Code exists             │
    │    ✓ Not self-referral       │
    │ 3. UPDATE profiles           │
    │    SET referred_by = Alex.id │
    │    WHERE id = Sam.id         │
    └─────────────┬───────────────┘
                  │
                  │ Success
                  ▼
           ┌──────────────┐
           │ Toast:        │
           │ "Code applied"│
           └──────────────┘
```

### Flow 2: Referred User Reaches Stage 3 (Unlock)

```
┌─────────────┐
│  Sam        │
│  (Referred) │
└──────┬──────┘
       │
       │ Earns XP, hits Stage 3
       ▼
┌──────────────────────┐
│ useCompanion()       │
│ evolveCompanion()    │
└──────┬───────────────┘
       │
       │ Stage 3 detected
       ▼
┌─────────────────────────────────────┐
│ validateReferralAtStage3()          │
│                                     │
│ 1. Fetch Sam's profile              │
│    → referred_by = Alex.id          │
│                                     │
│ 2. Increment Alex's referral_count │
│    → 0 → 1                          │
│                                     │
│ 3. Check milestone (1, 3, or 5)    │
│    → Match: 1 referral              │
│                                     │
│ 4. Fetch "Cosmic Aura" skin         │
│    (unlock_requirement = 1)         │
│                                     │
│ 5. INSERT user_companion_skins      │
│    user_id: Alex.id                 │
│    skin_id: cosmic_aura.id          │
│    acquired_via: "referral_1"       │
│                                     │
│ 6. Clear Sam's referred_by          │
│    (prevent double-count)           │
└─────────────────────────────────────┘
       │
       │ Alex unlocked skin!
       ▼
┌──────────────────────┐
│ Alex sees:           │
│ • Referral count: 1  │
│ • "Cosmic Aura"      │
│   unlocked!          │
└──────────────────────┘
```

### Flow 3: User Equips Skin

```
┌─────────────┐
│  Alex       │
└──────┬──────┘
       │
       │ Profile → Referrals
       ▼
┌─────────────────────┐
│ CompanionSkins      │
│ ┌─────────────────┐ │
│ │ Cosmic Aura     │ │
│ │ [Equip] ◄───────┼─┼─ Click
│ └─────────────────┘ │
└──────┬──────────────┘
       │
       │ equipSkin.mutate(cosmic_aura.id)
       ▼
    ┌──────────────┐
    │useReferrals()│
    └──────┬───────┘
           │
           ▼
    ┌─────────────────────────────────┐
    │ SUPABASE                         │
    │ 1. UPDATE user_companion_skins   │
    │    SET is_equipped = false       │
    │    WHERE user_id = Alex.id       │
    │    (Unequip all)                 │
    │                                  │
    │ 2. UPDATE user_companion_skins   │
    │    SET is_equipped = true        │
    │    WHERE user_id = Alex.id       │
    │      AND skin_id = cosmic_aura   │
    └─────────────┬───────────────────┘
                  │
                  ▼
           ┌──────────────┐
           │ queryClient  │
           │ .invalidate  │
           └──────┬───────┘
                  │
                  ▼
         ┌────────────────┐
         │ CompanionDisplay│
         │ re-renders with │
         │ skin effect!    │
         └────────────────┘
                  │
                  ▼
    ┌──────────────────────────────┐
    │ Companion image now has:     │
    │ • Purple/blue glow           │
    │ • boxShadow effect           │
    │ • drop-shadow filter         │
    └──────────────────────────────┘
```

### Flow 4: User Shares Referral Code

```
┌─────────────┐
│  Alex       │
└──────┬──────┘
       │
       │ Profile → Referrals
       ▼
┌─────────────────────┐
│ ReferralDashboard   │
│ ┌─────────────────┐ │
│ │ REF-ALEX-7K2X   │ │
│ │ [Share] ◄───────┼─┼─ Click
│ └─────────────────┘ │
└──────┬──────────────┘
       │
       │ handleShare()
       ▼
    ┌──────────────┐
    │ Platform?    │
    └──────┬───────┘
           │
           ├──► iOS/Android
           │    ┌─────────────────────────┐
           │    │ Capacitor Share         │
           │    │ CapacitorShare.share()  │
           │    └─────────┬───────────────┘
           │              │
           │              ▼
           │    ┌─────────────────────────┐
           │    │ iOS Share Sheet         │
           │    │ • Messages              │
           │    │ • WhatsApp              │
           │    │ • Copy Link             │
           │    │ • etc.                  │
           │    └─────────────────────────┘
           │
           └──► Web/PWA
                ┌─────────────────────────┐
                │ navigator.share()       │
                │ OR                      │
                │ Clipboard API           │
                └─────────────────────────┘
                          │
                          ▼
                ┌─────────────────────────┐
                │ Message sent:           │
                │ "Join me on R-Evolution │
                │  and use my code:       │
                │  REF-ALEX-7K2X"         │
                └─────────────────────────┘
```

## Component Dependency Graph

```
┌──────────────────┐
│   Supabase DB    │
└────────┬─────────┘
         │
         │ Tables:
         │ • profiles
         │ • companion_skins
         │ • user_companion_skins
         │
         ▼
┌────────────────────────────────────────────────────┐
│              @/integrations/supabase                │
│              types.ts (Auto-generated)              │
└─────────────────────┬──────────────────────────────┘
                      │
                      │ TypeScript types
                      │
         ┌────────────┼────────────┐
         │            │            │
         ▼            ▼            ▼
┌───────────┐  ┌────────────┐  ┌──────────┐
│ useAuth() │  │useProfile()│  │useCompanion()│
└─────┬─────┘  └─────┬──────┘  └──────┬───────┘
      │              │                 │
      │              │                 │
      └──────┬───────┴─────────┬───────┘
             │                 │
             ▼                 │
      ┌──────────────┐         │
      │useReferrals()│         │
      └──────┬───────┘         │
             │                 │
             │ Provides:       │ Provides:
             │ • referralStats │ • companion
             │ • skins         │ • evolveCompanion()
             │ • mutations     │ • validateReferral()
             │                 │
             ┼─────────────────┼───────────────────────┐
             │                 │                       │
             ▼                 ▼                       ▼
    ┌────────────────┐  ┌──────────────┐    ┌────────────────┐
    │OnboardingFlow  │  │CompanionDisplay│    │Profile Page    │
    │  └─►ReferralCode│  │ (applies skins)│    │  └─►Referrals  │
    │     Input      │  └────────────────┘    │     Tab        │
    └────────────────┘                         │   ├─►Referral  │
                                               │   │  Dashboard │
                                               │   └─►Companion │
                                               │      Skins     │
                                               └────────────────┘
```

## State Management Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   React Query Cache                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Query Keys:                                                 │
│  • ["referral-stats", userId]                               │
│  • ["available-skins"]                                       │
│  • ["unlocked-skins", userId]                               │
│  • ["companion", userId]                                     │
│  • ["profile", userId]                                       │
│                                                               │
│  Mutations:                                                  │
│  • applyReferralCode → invalidates referral-stats           │
│  • equipSkin → invalidates unlocked-skins                    │
│  • unequipSkin → invalidates unlocked-skins                  │
│  • evolveCompanion → invalidates companion, triggers         │
│                       validateReferralAtStage3()             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Cached data
                          ▼
         ┌────────────────────────────────┐
         │   Components (auto re-render)   │
         └────────────────────────────────┘
```

## CSS Effect System

```
┌─────────────────────────────────────────────┐
│  companion_skins.css_effect (JSONB)         │
├─────────────────────────────────────────────┤
│                                             │
│  Aura Skin:                                 │
│  {                                          │
│    "glowColor": "hsl(var(--primary))",     │
│    "glowIntensity": "0.6",                 │
│    "animation": "pulse"                     │
│  }                                          │
│                                             │
│  Frame Skin:                                │
│  {                                          │
│    "borderColor": "hsl(45, 100%, 60%)",    │
│    "borderWidth": "3px",                   │
│    "shimmer": true                         │
│  }                                          │
│                                             │
│  Overlay Skin:                              │
│  {                                          │
│    "overlayImage": "celestial-wings",      │
│    "opacity": "0.8",                       │
│    "animation": "float"                     │
│  }                                          │
│                                             │
└─────────────────┬───────────────────────────┘
                  │
                  │ Parsed by CompanionDisplay
                  ▼
         ┌────────────────────┐
         │  React useMemo()   │
         │  skinStyles        │
         └─────────┬──────────┘
                   │
                   ▼
         ┌────────────────────┐
         │  <img style={...}  │
         │  Dynamic CSS       │
         │  applied!          │
         └────────────────────┘
```

## Security & Access Control

```
┌─────────────────────────────────────────────────────────────┐
│                   Row Level Security (RLS)                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  companion_skins:                                            │
│  ✓ SELECT: Anyone (public viewing)                          │
│  ✓ INSERT/UPDATE/DELETE: Admins only                        │
│                                                               │
│  user_companion_skins:                                       │
│  ✓ SELECT: Users can view their own                         │
│  ✓ INSERT: Users can insert their own                       │
│  ✓ UPDATE: Users can update their own (equip/unequip)       │
│  ✓ DELETE: Not allowed                                       │
│                                                               │
│  profiles:                                                   │
│  ✓ SELECT: Users can view their own                         │
│  ✓ UPDATE: Users can update their own                       │
│    (referral_code is read-only via trigger)                 │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   Validation Logic                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  applyReferralCode():                                        │
│  1. Check code exists in profiles.referral_code             │
│  2. Prevent self-referral (code owner ≠ current user)       │
│  3. Only allow if referred_by is null (one-time use)        │
│                                                               │
│  validateReferralAtStage3():                                 │
│  1. Only process if referred_by is set                       │
│  2. Clear referred_by after processing (no double-count)    │
│  3. Use INSERT ... ON CONFLICT DO NOTHING for skins         │
│     (prevent duplicates)                                     │
│                                                               │
│  equipSkin():                                                │
│  1. Unequip all other skins first (single skin at a time)   │
│  2. Only allow if skin is unlocked                          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Milestone Unlock Matrix

```
┌──────────────┬───────────────┬──────────────┬───────────────┐
│ Milestone    │ Skin Name     │ Skin Type    │ Rarity        │
├──────────────┼───────────────┼──────────────┼───────────────┤
│ 1 Referral   │ Cosmic Aura   │ aura         │ rare          │
│              │               │ (glow effect)│ (blue)        │
├──────────────┼───────────────┼──────────────┼───────────────┤
│ 3 Referrals  │ Golden Frame  │ frame        │ epic          │
│              │               │ (border)     │ (purple)      │
├──────────────┼───────────────┼──────────────┼───────────────┤
│ 5 Referrals  │ Celestial     │ overlay      │ legendary     │
│              │ Wings         │ (wings)      │ (gold)        │
└──────────────┴───────────────┴──────────────┴───────────────┘
```

---

## File Structure

```
/workspace
│
├── supabase/migrations/
│   └── 20251126072322_*.sql ◄── Main migration file
│
├── src/
│   ├── hooks/
│   │   ├── useReferrals.ts ◄── Referral hook
│   │   └── useCompanion.ts ◄── Validation at Stage 3
│   │
│   ├── components/
│   │   ├── ReferralCodeInput.tsx ◄── Onboarding step
│   │   ├── ReferralDashboard.tsx ◄── Profile tab
│   │   ├── CompanionSkins.tsx ◄── Skin manager
│   │   ├── CompanionDisplay.tsx ◄── Applies skin effects
│   │   └── OnboardingFlow.tsx ◄── Integrates referral input
│   │
│   ├── pages/
│   │   └── Profile.tsx ◄── Referrals tab
│   │
│   └── integrations/supabase/
│       └── types.ts ◄── Auto-generated types
│
└── REFERRAL_SYSTEM_VERIFICATION.md ◄── Full verification report
```

---

## Performance Considerations

### Database Queries
- ✅ Indexed columns: `referral_code` (UNIQUE index)
- ✅ Foreign keys: `referred_by`, `skin_id`, `user_id`
- ✅ RLS policies use indexed columns

### React Query Caching
- ✅ `referral-stats` cached per user
- ✅ `available-skins` cached globally (rarely changes)
- ✅ `unlocked-skins` cached per user
- ✅ Mutations automatically invalidate relevant queries

### Skin Effect Rendering
- ✅ `useMemo()` prevents unnecessary CSS recalculation
- ✅ CSS effects applied via inline styles (no re-renders)
- ✅ Only equipped skin is rendered (not all unlocked skins)

---

**Status:** All systems operational ✅
