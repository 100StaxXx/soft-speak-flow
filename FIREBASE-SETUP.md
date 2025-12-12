# Firebase Environment Variables Setup

Add these to your `.env` file to complete the Firebase migration:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=cosmiq-prod.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=cosmiq-prod
VITE_FIREBASE_STORAGE_BUCKET=cosmiq-prod.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

## How to Get These Values

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **cosmiq-prod**
3. Click the gear icon ⚙️ → **Project Settings**
4. Scroll down to **Your apps** section
5. If you don't have a web app, click **Add app** → **Web** (</> icon)
6. Copy the config values from the Firebase SDK setup

The config will look like:
```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "cosmiq-prod.firebaseapp.com",
  projectId: "cosmiq-prod",
  storageBucket: "cosmiq-prod.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123",
  measurementId: "G-XXXXXXXXXX"
};
```

Copy each value to your `.env` file with the `VITE_` prefix.

## After Adding

1. Save your `.env` file
2. Restart the dev server (`npm run dev`)
3. The app should load properly






