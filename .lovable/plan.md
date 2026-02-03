
# Disable Subscription System & Remove Soft Modal

## Overview

Disable the subscription paywall to allow all users free, unlimited access. This keeps all subscription infrastructure intact for future re-enabling.

## Changes

### 1. `src/hooks/useAccessStatus.ts`

Modify the return to always grant access:

```typescript
return {
  hasAccess: true, // ALWAYS grant access - monetization disabled
  isSubscribed,
  isInTrial: false, // No longer relevant
  trialExpired: false, // No longer relevant
  trialDaysRemaining: 0,
  accessSource: isSubscribed ? 'subscription' : 'none',
  trialEndsAt,
  loading: false,
};
```

### 2. `src/App.tsx`

Remove `SubscriptionGate` from `EvolutionAwareContent`:

```typescript
const EvolutionAwareContent = memo(() => {
  return (
    <>
      <GlobalEvolutionListener />
      {/* SubscriptionGate removed - monetization disabled */}
      <WeeklyRecapModal />
    </>
  );
});
```

## Result

| Component | Status |
|-----------|--------|
| Hard paywall (TrialExpiredPaywall) | Disabled |
| Soft promotional modal (SubscriptionGate) | Hidden |
| Premium page | Still accessible (users can subscribe if they want) |
| Apple IAP backend | Unchanged |
| Subscription hooks | Intact for future use |

## Reversing Later

When ready to monetize:
1. Restore `useAccessStatus.ts` logic
2. Uncomment `<SubscriptionGate />` in App.tsx
