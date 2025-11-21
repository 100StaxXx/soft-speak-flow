# Subscription System Setup Guide

## Overview

This app now has a complete **$9.99/month subscription system with 7-day free trial** powered by Stripe.

## Features Implemented

✅ **Database Schema** - Complete subscription tracking (profiles, subscriptions, payment_history tables)
✅ **Stripe Integration** - Checkout, webhooks, subscriptions
✅ **7-Day Free Trial** - Automatic trial for all new subscribers
✅ **Subscription Management** - Cancel/resume subscriptions
✅ **Premium UI** - Beautiful checkout and success pages
✅ **Status Tracking** - Trial countdown, billing dates, subscription status

---

## Setup Instructions

### 1. Database Migration

Run the migration to create subscription tables:

```bash
# Apply the migration
supabase db push
```

Or manually run the SQL migration file: `/supabase/migrations/20250121_add_subscription_tables.sql`

This creates:
- `subscriptions` table
- `payment_history` table
- Adds subscription fields to `profiles` table
- Creates triggers for automatic premium status updates

---

### 2. Stripe Configuration

#### Create Stripe Account

1. Sign up at [stripe.com](https://stripe.com)
2. Get your API keys from the [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)

#### Create Products in Stripe

1. Go to **Products** in Stripe Dashboard
2. Create a product: "Soft Speak Flow Premium"
3. Add two prices:
   - **Monthly**: $9.99 (recurring, 7-day trial)
   - **Yearly**: $99.99 (recurring, 7-day trial)
4. Copy the Price IDs (starts with `price_...`)

#### Set Up Webhook

1. Go to **Developers > Webhooks** in Stripe Dashboard
2. Click "Add endpoint"
3. Endpoint URL: `https://YOUR_PROJECT_ID.supabase.co/functions/v1/stripe-webhook`
4. Select events to listen for:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `checkout.session.completed`
5. Copy the **Signing secret** (starts with `whsec_...`)

---

### 3. Environment Variables

#### Add to Supabase Edge Function Secrets

```bash
# Set Stripe secret key
supabase secrets set STRIPE_SECRET_KEY=sk_test_...

# Set webhook signing secret
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...

# Set price IDs (optional, auto-created if not set)
supabase secrets set STRIPE_MONTHLY_PRICE_ID=price_...
supabase secrets set STRIPE_YEARLY_PRICE_ID=price_...
```

#### Add to Local `.env` file

Create/update `.env` file:

```env
VITE_STRIPE_PUBLIC_KEY=pk_test_...
```

**Note:** The public key is used on the frontend for Stripe.js initialization (future implementation for embedded checkout).

---

### 4. Deploy Edge Functions

Deploy the new Supabase Edge Functions:

```bash
# Deploy all functions
supabase functions deploy stripe-webhook
supabase functions deploy create-subscription-checkout
supabase functions deploy cancel-subscription
supabase functions deploy resume-subscription
```

---

### 5. Test the Integration

#### Test Mode (Recommended)

1. Use Stripe test keys (starts with `pk_test_` and `sk_test_`)
2. Go to `/premium` page
3. Click "Start 7-Day Free Trial"
4. Use test card: `4242 4242 4242 4242`
5. Expiry: Any future date
6. CVC: Any 3 digits
7. Complete checkout
8. Verify you're redirected to success page with premium active

#### Check Database

```sql
-- Check subscription was created
SELECT * FROM subscriptions WHERE user_id = 'YOUR_USER_ID';

-- Check profile is_premium is true
SELECT is_premium, subscription_status, trial_ends_at
FROM profiles WHERE id = 'YOUR_USER_ID';
```

---

## File Structure

### Database
- `/supabase/migrations/20250121_add_subscription_tables.sql` - Database schema

### Edge Functions
- `/supabase/functions/stripe-webhook/index.ts` - Webhook handler
- `/supabase/functions/create-subscription-checkout/index.ts` - Create checkout session
- `/supabase/functions/cancel-subscription/index.ts` - Cancel subscription
- `/supabase/functions/resume-subscription/index.ts` - Resume cancelled subscription

### Frontend
- `/src/pages/Premium.tsx` - Subscription landing page
- `/src/pages/PremiumSuccess.tsx` - Post-checkout success page
- `/src/hooks/useSubscription.ts` - Subscription status hook
- `/src/components/SubscriptionManagement.tsx` - Manage subscription UI
- `/src/pages/Profile.tsx` - Shows subscription management for premium users

---

## How It Works

### 1. Subscription Flow

```
User clicks "Start 7-Day Free Trial"
  ↓
create-subscription-checkout function creates Stripe Checkout session
  ↓
User redirected to Stripe Checkout page
  ↓
User enters payment details
  ↓
Stripe creates subscription with 7-day trial
  ↓
Webhook receives customer.subscription.created event
  ↓
Database updated: is_premium = true, trial_ends_at set
  ↓
User redirected to /premium/success
  ↓
Premium features unlocked
```

### 2. Trial Period

- **Duration**: 7 days
- **Billing**: No charge during trial
- **Cancellation**: Can cancel anytime during trial without charge
- **After trial**: Automatically charged $9.99/month

### 3. Subscription Status

Tracked in database:
- `active` - Paid and active
- `trialing` - In 7-day free trial
- `past_due` - Payment failed
- `cancelled` - User cancelled
- `incomplete` - Payment not complete

---

## Testing Webhooks Locally

To test webhooks locally:

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Login: `stripe login`
3. Forward webhooks:
   ```bash
   stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
   ```
4. Copy the webhook signing secret and update environment

---

## Pricing

- **Monthly**: $9.99/month
- **Yearly**: $99.99/year (saves $19.89)
- **Trial**: 7 days free for all new subscriptions

---

## Security Notes

- ✅ Webhook signature verification
- ✅ Server-side price validation (prevents client manipulation)
- ✅ Row Level Security (RLS) on subscription tables
- ✅ Authentication required for all subscription operations
- ✅ User can only view/manage their own subscription

---

## Production Checklist

Before going live:

- [ ] Switch to Stripe Live mode keys (starts with `pk_live_` and `sk_live_`)
- [ ] Update webhook endpoint URL to production Supabase project
- [ ] Test complete subscription flow in live mode
- [ ] Set up Stripe billing portal for customer self-service
- [ ] Configure email receipts in Stripe Dashboard
- [ ] Add tax rates if applicable (Stripe Tax)
- [ ] Set up monitoring/alerts for failed payments
- [ ] Test cancellation and refund flows
- [ ] Review Stripe radar rules for fraud detection

---

## Troubleshooting

### Subscription not activating after checkout

1. Check webhook logs in Stripe Dashboard
2. Verify webhook secret is correct
3. Check Supabase Edge Function logs
4. Ensure `user_id` is in subscription metadata

### Premium status not showing

1. Check `profiles.is_premium` field
2. Verify trigger is working: `update_premium_status()`
3. Check subscription status in database

### Webhook failing

1. Verify webhook signing secret
2. Check Supabase function logs
3. Ensure all required Stripe events are selected
4. Test with Stripe CLI locally

---

## Support

For issues:
1. Check Stripe Dashboard logs
2. Check Supabase Edge Function logs
3. Review database records
4. Test with Stripe test cards

---

## Next Steps (Optional Enhancements)

- [ ] Add yearly plan option on Premium page
- [ ] Implement promo code system
- [ ] Add grace period for failed payments
- [ ] Send email reminders before trial ends
- [ ] Add referral/discount system
- [ ] Implement usage-based billing
- [ ] Add team/family plans
- [ ] Integrate Stripe Customer Portal for self-service
