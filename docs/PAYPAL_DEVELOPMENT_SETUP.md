# PayPal Development Setup Guide

This guide will help you set up PayPal Sandbox for local development and testing of the donation system.

## Overview

WeighTogether uses PayPal for accepting donations with two types:
1. **One-time donations** - Single payment of any amount
2. **Recurring subscriptions** - Monthly or yearly recurring donations

The production version uses live PayPal credentials, while development should use **PayPal Sandbox** for safe testing.

---

## Step 1: Create PayPal Developer Account

1. Go to [PayPal Developer Portal](https://developer.paypal.com/)
2. Click **"Log in to Dashboard"** (or create an account if you don't have one)
3. Once logged in, you'll have access to the Developer Dashboard

---

## Step 2: Get Sandbox Credentials

### Create a Sandbox App

1. In the Developer Dashboard, go to **"My Apps & Credentials"**
2. Make sure you're on the **"Sandbox"** tab (not Live)
3. Click **"Create App"**
4. Enter app name (e.g., "WeighTogether Dev")
5. Select a sandbox business account (or create one)
6. Click **"Create App"**

### Get Client ID and Secret

After creating the app:
1. You'll see your **Client ID** - copy this
2. Click **"Show"** under **Secret** - copy this too
3. Keep these credentials safe - you'll need them for `.env`

---

## Step 3: Create Subscription Plans

PayPal requires subscription plans to be created before you can accept recurring donations.

### Option A: Create via PayPal Dashboard (Recommended for first-time setup)

1. In Developer Dashboard, go to **"Sandbox" → "Accounts"**
2. Note the email of your sandbox business account
3. Log into [PayPal Sandbox](https://www.sandbox.paypal.com/) using the business account credentials
4. Go to **"Products & Services" → "Subscriptions"**
5. Click **"Create Plan"**

**Monthly Plan:**
- Plan name: "WeighTogether Monthly Support"
- Plan type: Fixed pricing
- Billing cycle: 1 month
- Price: $10 USD (or your preferred amount)
- After creating, copy the **Plan ID** (format: P-XXXXXXXXXXXXXXXXXXXX)

**Yearly Plan:**
- Plan name: "WeighTogether Yearly Support"
- Plan type: Fixed pricing
- Billing cycle: 1 year
- Price: $100 USD (or your preferred amount)
- After creating, copy the **Plan ID**

### Option B: Create via API Script (Advanced)

Use the included setup script (we'll create this next):

```bash
npm run setup:paypal-plans
```

---

## Step 4: Configure Environment Variables

Update your `.env` or `.env.development` file:

```bash
# PayPal Sandbox Configuration
PAYPAL_USE_LIVE=false                           # Use sandbox mode
PAYPAL_CLIENT_ID=YOUR_SANDBOX_CLIENT_ID         # From Step 2
PAYPAL_CLIENT_SECRET=YOUR_SANDBOX_CLIENT_SECRET # From Step 2
PAYPAL_RETURN_URL=http://localhost:3000/donate/thank-you
PAYPAL_CANCEL_URL=http://localhost:3000/donate
PAYPAL_WEBHOOK_ID=                              # Optional for now
PAYPAL_MONTHLY_PLAN_ID=P-XXXXXXXXXXXXXXXXXXXX   # From Step 3
PAYPAL_YEARLY_PLAN_ID=P-XXXXXXXXXXXXXXXXXXXX    # From Step 3
```

**Important**: Set `PAYPAL_USE_LIVE=false` to use sandbox mode!

---

## Step 5: Test the Integration

### Start the Development Server

```bash
npm run dev
```

### Test One-Time Donation

1. Navigate to `http://localhost:3000/donate`
2. Enter a donation amount (e.g., $10)
3. Click **"Donate with PayPal"**
4. You'll be redirected to PayPal Sandbox
5. Log in with a **sandbox personal account** (not the business account)
6. Complete the payment
7. You should be redirected back to the thank you page

### Test Recurring Subscription

1. On the donate page, click **"Monthly"** or **"Yearly"**
2. Click **"Subscribe with PayPal"**
3. Follow the same flow as above
4. Subscription will be created in sandbox

### Get Sandbox Test Accounts

To get sandbox personal account credentials for testing:

1. Go to Developer Dashboard → **"Sandbox" → "Accounts"**
2. Find a **Personal** account (not Business)
3. Click the **⋮** menu → **"View/Edit Account"**
4. Click **"Manage Accounts"** → **"Set Password"** to create a password
5. Or use the auto-generated credentials shown

---

## Step 6: Verify Donations in Database

Check that donations are being recorded:

```bash
# Open Prisma Studio
npm run db:studio

# Or query directly
npm run db:console
```

Query donations:
```sql
SELECT * FROM "Donation" ORDER BY "createdAt" DESC LIMIT 10;
SELECT * FROM "DonationSubscription" ORDER BY "createdAt" DESC LIMIT 10;
```

---

## Webhook Setup (Optional)

For production-like testing, you can set up webhooks:

### Using ngrok (for local development)

1. Install ngrok: `npm install -g ngrok`
2. Start ngrok: `ngrok http 3000`
3. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
4. In PayPal Developer Dashboard:
   - Go to your app
   - Scroll to **"Webhooks"**
   - Click **"Add Webhook"**
   - URL: `https://abc123.ngrok.io/api/donate/webhook`
   - Events: Select all donation/subscription events
5. Copy the **Webhook ID** to `PAYPAL_WEBHOOK_ID` in `.env`

---

## Troubleshooting

### "Client ID not found" Error
- Make sure you're using **Sandbox** credentials, not Live
- Verify `PAYPAL_USE_LIVE=false` in `.env`

### "Plan not found" Error
- Ensure subscription plan IDs are correct
- Plans must be created in the same sandbox environment

### Payment Not Completing
- Check server logs for errors
- Verify return URLs match exactly (including http://)
- Ensure PayPal credentials are valid

### Database Not Recording Donations
- Check that PayPal webhook is firing (if configured)
- Verify database connection
- Check server console for errors during capture

---

## Switching to Production

When ready for production:

1. Create a **Live** app in PayPal Developer Dashboard
2. Get **Live** Client ID and Secret
3. Create **Live** subscription plans
4. Update `.env` on production server:
   ```bash
   PAYPAL_USE_LIVE=true
   PAYPAL_CLIENT_ID=LIVE_CLIENT_ID
   PAYPAL_CLIENT_SECRET=LIVE_CLIENT_SECRET
   PAYPAL_MONTHLY_PLAN_ID=LIVE_PLAN_ID
   PAYPAL_YEARLY_PLAN_ID=LIVE_PLAN_ID
   ```
5. Set up live webhooks pointing to your production domain

---

## Testing Checklist

- [ ] One-time donation ($5)
- [ ] One-time donation ($100)
- [ ] Monthly subscription
- [ ] Yearly subscription
- [ ] Subscription cancellation
- [ ] Donation appears in database
- [ ] Thank you page displays correctly
- [ ] Stats API returns correct totals
- [ ] Webhooks fire correctly (if configured)

---

## Resources

- [PayPal Developer Documentation](https://developer.paypal.com/docs/)
- [PayPal Sandbox Testing Guide](https://developer.paypal.com/docs/api-basics/sandbox/)
- [Subscription Plans API](https://developer.paypal.com/docs/subscriptions/)
- [Orders API v2](https://developer.paypal.com/docs/api/orders/v2/)

---

## Support

If you encounter issues:
1. Check server logs: `npm run dev` output
2. Check PayPal Sandbox logs in Developer Dashboard
3. Verify all environment variables are set correctly
4. Review `src/services/paypal.service.ts` for error handling
