# Frontend Environment Variables Setup

This guide explains how to set up environment variables for the frontend application.

## Required Environment Variables

### VITE_WEB_PUSH_KEY
**Required for:** Web push notifications

**Value:**
```
BOQz9DrqwYdOPwda_zhei3g-VZo2KFE0Itl19I6fTVTI-BlizrAx4IK3y13uNV9rZFEfQ9Y88dxviC1sP8wXD2g
```

## Setup Instructions

### Option 1: Local Development (.env file)

1. Create a `.env` file in the project root (if it doesn't exist)
2. Add the following line:
   ```
   VITE_WEB_PUSH_KEY=BOQz9DrqwYdOPwda_zhei3g-VZo2KFE0Itl19I6fTVTI-BlizrAx4IK3y13uNV9rZFEfQ9Y88dxviC1sP8wXD2g
   ```
3. Restart your development server

**Note:** The `.env` file is gitignored and should not be committed to version control.

### Option 2: Production Build (Hosting Platform)

#### Vercel
1. Go to your project settings in Vercel
2. Navigate to "Environment Variables"
3. Add a new variable:
   - **Name:** `VITE_WEB_PUSH_KEY`
   - **Value:** `BOQz9DrqwYdOPwda_zhei3g-VZo2KFE0Itl19I6fTVTI-BlizrAx4IK3y13uNV9rZFEfQ9Y88dxviC1sP8wXD2g`
   - **Environment:** Production, Preview, Development (select all)
4. Redeploy your application

#### Netlify
1. Go to your site settings in Netlify
2. Navigate to "Environment variables"
3. Click "Add a variable"
4. Add:
   - **Key:** `VITE_WEB_PUSH_KEY`
   - **Value:** `BOQz9DrqwYdOPwda_zhei3g-VZo2KFE0Itl19I6fTVTI-BlizrAx4IK3y13uNV9rZFEfQ9Y88dxviC1sP8wXD2g`
5. Save and redeploy

#### Other Platforms
For other hosting platforms, add the environment variable in your platform's settings and ensure it's available during the build process.

## Verification

After setting the environment variable:

1. **Check in code:**
   ```typescript
   // In src/utils/pushNotifications.ts
   const VAPID_PUBLIC_KEY = import.meta.env.VITE_WEB_PUSH_KEY;
   console.log('VAPID Key loaded:', VAPID_PUBLIC_KEY ? 'Yes' : 'No');
   ```

2. **Test push notifications:**
   - Subscribe to push notifications in the app
   - Verify the subscription succeeds
   - Check browser console for any errors

## Important Notes

- Environment variables prefixed with `VITE_` are exposed to the client-side code
- Never commit `.env` files with sensitive data to version control
- The VAPID public key is safe to expose (it's meant to be public)
- After changing environment variables, you must rebuild/redeploy the application

## Troubleshooting

- **"Missing VITE_WEB_PUSH_KEY environment variable"**: Make sure the variable is set and the app has been rebuilt
- **Push notifications not working**: Verify the key matches the one set in Firebase Secrets
- **Variable not loading**: Ensure the variable name starts with `VITE_` and restart the dev server

