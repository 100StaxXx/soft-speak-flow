# Firebase Cloud Functions

This directory contains Firebase Cloud Functions for the application.

## Setup

1. Install dependencies:
```bash
cd functions
npm install
```

2. Build the functions:
```bash
npm run build
```

## Deploy

Deploy all functions:
```bash
npm run deploy
```

Or deploy from the project root:
```bash
firebase deploy --only functions
```

## Functions

### `deleteUserAccount`

Deletes a user's account and all associated data from Firestore, then deletes the Firebase Auth user.

**Trigger:** Callable function (HTTPS)

**Authentication:** Required - user must be authenticated

**What it deletes:**
- User profile
- User companion and related data (evolutions, cards, postcards, stories)
- Daily missions and tasks
- Achievements
- Favorites
- XP events
- And other user-related collections

**Usage from client:**
```typescript
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "@/lib/firebase";

const functions = getFunctions(firebaseApp);
const deleteUserAccount = httpsCallable(functions, "deleteUserAccount");
await deleteUserAccount();
```

## Development

Run the emulator:
```bash
npm run serve
```

View logs:
```bash
npm run logs
```

