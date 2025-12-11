# Remaining TODO Comments

These TODO comments are informational and don't block functionality. They represent optional improvements or features that don't have Firebase functions yet.

## Informational TODOs

### 1. Admin Role Check (`src/pages/Admin.tsx`)
**Status:** Informational  
**Note:** Current implementation works. Can be improved with Firestore custom claims or user_roles collection in the future.

```typescript
// TODO: Migrate admin role check to Firestore custom claims or a user_roles collection
// For now, check if user has admin role in profile or custom claims
```

### 2. Referral Code Atomic Operations (`src/hooks/useReferrals.ts`)
**Status:** Informational  
**Note:** Current implementation works. Atomic operations would be better but not critical.

```typescript
// TODO: Migrate to Firebase Cloud Function for atomic operations
// For now, update profile directly
```

### 3. Send Shout Notification (`src/hooks/useGuildShouts.ts`)
**Status:** Function doesn't exist yet  
**Note:** This function needs to be created in Firebase Cloud Functions first.

```typescript
// TODO: Migrate to Firebase Cloud Function
// fetch('https://YOUR-FIREBASE-FUNCTION/send-shout-notification', {...});
```

### 4. Questionnaire Responses (`src/components/onboarding/StoryOnboarding.tsx`)
**Status:** Informational  
**Note:** Data is already stored in onboarding_data. Separate collection is optional.

```typescript
// TODO: Migrate questionnaire_responses to Firestore if needed
// For now, skip - questionnaire data is stored in onboarding_data
```

## Summary

- **Critical:** None - all blocking TODOs have been fixed
- **Informational:** 4 TODOs remain (optional improvements)
- **Missing Functions:** 1 (send-shout-notification needs to be created)

## Action Items

1. ✅ All critical TODOs fixed
2. 🔄 Optional: Create `send-shout-notification` Firebase function
3. 🔄 Optional: Implement atomic referral code operations
4. 🔄 Optional: Set up Firestore custom claims for admin roles

These are all optional improvements and don't block production deployment.

