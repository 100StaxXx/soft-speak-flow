# Smoke Tests - Critical Flow Testing

This directory contains smoke tests for all critical user flows in the Cosmiq application. Smoke tests are lightweight tests that verify basic functionality without going into deep detail.

## Test Structure

```
src/test/
├── setup.ts              # Test environment setup
├── mocks/                # Mock implementations
│   ├── firebase.ts      # Firebase/Firestore mocks
│   └── capacitor.ts     # Capacitor plugin mocks
├── utils/                # Test utilities
│   └── testHelpers.ts   # Helper functions for creating test data
└── smoke/                # Smoke test suites
    ├── signIn.test.ts
    ├── onboarding.test.ts
    ├── mentorSelection.test.ts
    ├── questCreation.test.ts
    ├── questCompletion.test.ts
    ├── missionGeneration.test.ts
    ├── evolutionProgression.test.ts
    └── pushNotifications.test.ts
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run only smoke tests
```bash
npm run test:smoke
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage
```bash
npm run test:coverage
```

## Test Coverage

### 1. Sign-In Flow (`signIn.test.ts`)
- ✅ Email/password sign-in
- ✅ User registration
- ✅ Google OAuth sign-in
- ✅ Error handling
- ✅ Profile creation after sign-up

### 2. Onboarding Flow (`onboarding.test.ts`)
- ✅ Loading mentors
- ✅ Creating user profile
- ✅ Updating profile with onboarding data
- ✅ Creating companion
- ✅ End-to-end onboarding completion

### 3. Mentor Selection (`mentorSelection.test.ts`)
- ✅ Fetching available mentors
- ✅ Updating profile with selected mentor
- ✅ Mentor selection flow
- ✅ Required mentor properties
- ✅ Empty mentor list handling

### 4. Quest Creation (`questCreation.test.ts`)
- ✅ Creating new quests
- ✅ Different difficulty levels
- ✅ Main quest creation
- ✅ Retrieving quests by date
- ✅ Scheduled quests
- ✅ Unique quest IDs

### 5. Quest Completion (`questCompletion.test.ts`)
- ✅ Marking quests as completed
- ✅ XP award on completion
- ✅ Preventing double completion
- ✅ Companion XP updates
- ✅ Different XP rewards
- ✅ Main quest multiplier

### 6. AI Mission Generation (`missionGeneration.test.ts`)
- ✅ Generating daily missions
- ✅ Returning existing missions
- ✅ All three mission categories
- ✅ Required mission properties
- ✅ Unique mission IDs
- ✅ Correct data format

### 7. Evolution Progression (`evolutionProgression.test.ts`)
- ✅ XP updates on quest completion
- ✅ Evolution triggering at thresholds
- ✅ No evolution below threshold
- ✅ Multiple stage progression
- ✅ Stage updates on evolution
- ✅ XP accumulation across quests
- ✅ Threshold calculations

### 8. Push Notification Token Retrieval (`pushNotifications.test.ts`)
- ✅ Requesting permissions
- ✅ Registering for notifications
- ✅ Receiving device tokens
- ✅ Saving tokens to database
- ✅ Retrieving subscriptions
- ✅ Checking active subscriptions
- ✅ Error handling
- ✅ Platform identification
- ✅ Multiple device tokens

## Test Utilities

### Creating Mock Data

```typescript
import { createMockUser, createMockTask, createMockCompanion } from '../utils/testHelpers';

const user = createMockUser({ email: 'test@example.com' });
const task = createMockTask({ task_text: 'Test quest' });
const companion = createMockCompanion({ current_xp: 100 });
```

### Mocking Firebase

Firebase and Firestore are automatically mocked. Use the mock functions from `@/lib/firebase/firestore`:

```typescript
import { getDocument, setDocument, updateDocument } from '@/lib/firebase/firestore';

vi.mocked(getDocument).mockResolvedValueOnce(mockData);
```

## Writing New Tests

1. Create a new test file in `src/test/smoke/`
2. Import necessary utilities and mocks
3. Use descriptive test names
4. Test one critical flow per test file
5. Keep tests simple and focused on smoke testing (basic functionality)

Example:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { yourFunction } from '@/your/module';
import { createMockUser } from '../utils/testHelpers';

describe('Your Feature Smoke Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should perform basic operation', async () => {
    const user = createMockUser();
    const result = await yourFunction(user);
    expect(result).toBeDefined();
  });
});
```

## Notes

- Tests use Vitest as the test runner
- jsdom is used for DOM simulation
- All Firebase/Firestore operations are mocked
- Tests run in isolation with clean state between tests
- Mock data is reset before each test

