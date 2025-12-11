# VAPID Keys Setup Guide for Web Push Notifications

VAPID (Voluntary Application Server Identification) keys are required for web push notifications. You need both a public and private key pair.

## Your VAPID Public Key

```
BOQz9DrqwYdOPwda_zhei3g-VZo2KFE0Itl19I6fTVTI-BlizrAx4IK3y13uNV9rZFEfQ9Y88dxviC1sP8wXD2g
```

## Important: You Need the Private Key Too

VAPID requires a **key pair**:
- **Public Key**: Used in the frontend to subscribe users (you have this)
- **Private Key**: Used in the backend to send notifications (you need this)

## Step 1: Get Your Private Key

If you generated this key pair, you should have the private key saved. If not, you'll need to generate a new pair.

### Option A: If you have the private key
- Use the private key that corresponds to the public key above

### Option B: Generate a new key pair
If you don't have the private key, generate a new pair:

```bash
# Install web-push globally (if not already installed)
npm install -g web-push

# Generate a new VAPID key pair
web-push generate-vapid-keys
```

This will output something like:
```
Public Key: BOQz9DrqwYdOPwda_zhei3g-VZo2KFE0Itl19I6fTVTI-BlizrAx4IK3y13uNV9rZFEfQ9Y88dxviC1sP8wXD2g
Private Key: <your-private-key-here>
```

**Important**: If you generate a new pair, you'll need to update the public key in your frontend code as well.

## Step 2: Set Firebase Secrets

Set the VAPID keys as Firebase Secrets:

```bash
# Set VAPID Public Key
firebase functions:secrets:set VAPID_PUBLIC_KEY

# When prompted, enter: BOQz9DrqwYdOPwda_zhei3g-VZo2KFE0Itl19I6fTVTI-BlizrAx4IK3y13uNV9rZFEfQ9Y88dxviC1sP8wXD2g

# Set VAPID Private Key
firebase functions:secrets:set VAPID_PRIVATE_KEY

# When prompted, enter your private key (the one that matches the public key above)

# Set VAPID Subject (contact email)
firebase functions:secrets:set VAPID_SUBJECT

# When prompted, enter: mailto:admin@cosmiq.quest
```

## Step 3: Update Frontend Environment Variable

The frontend needs the public key in the environment variable `VITE_WEB_PUSH_KEY`.

1. Add to your `.env` file (or `.env.production` for production):
   ```
   VITE_WEB_PUSH_KEY=BOQz9DrqwYdOPwda_zhei3g-VZo2KFE0Itl19I6fTVTI-BlizrAx4IK3y13uNV9rZFEfQ9Y88dxviC1sP8wXD2g
   ```

2. If using a hosting platform (Vercel, Netlify, etc.), add this as an environment variable in your project settings.

## Step 4: Redeploy Functions

After setting the secrets, redeploy the functions that use VAPID:

```bash
firebase deploy --only functions:scheduledDispatchDailyPushes
```

## Verification

1. The public key is used in the frontend to subscribe users to push notifications
2. The private key is used in the backend (Firebase Functions) to send push notifications
3. Both keys must be from the same key pair

## Troubleshooting

- **"VAPID keys not configured"**: Make sure both `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` are set as Firebase Secrets
- **"Invalid VAPID key"**: Ensure the public and private keys are from the same key pair
- **Push notifications not working**: Verify the frontend has `VITE_WEB_PUSH_KEY` set correctly
