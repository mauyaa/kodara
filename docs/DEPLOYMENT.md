# Kodara Production Deployment Guide

## Prerequisites
- Supabase project (free tier works for MVP)
- Safaricom Daraja sandbox credentials (upgrade to production later)
- Vercel account for deployment

## 1. Database Setup

Run `docs/schema.sql` in your Supabase SQL Editor:
```bash
# Copy contents of docs/schema.sql and paste in Supabase dashboard > SQL Editor
```

This creates all tables with proper constraints and enables RLS.

## 2. Environment Variables

Create `.env.local` with:
```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

MPESA_CONSUMER_KEY=sandbox_key
MPESA_CONSUMER_SECRET=sandbox_secret
MPESA_PASSKEY=your_passkey
MPESA_SHORTCODE=sandbox_paybill
MPESA_CALLBACK_URL=https://your-domain.com/api/mpesa/callback
```

## 3. M-Pesa Configuration

### Sandbox Testing
1. Register at Safaricom Developer Portal
2. Create a sandbox app
3. Get consumer key, consumer secret, and passkey
4. Use test credentials: 254708371987

### Production
1. Get Lipa na M-Pesa approval from Safaricom
2. Update `MPESA_*` variables with production values
3. Ensure callback URL is publicly accessible (HTTPS required)

## 4. Deploy to Vercel

```bash
npm install -g vercel
vercel --prod
```

Or use GitHub Actions (see `.github/workflows/deploy.yml`).

## 5. Mobile App

```bash
cd mobile
npm install
npx expo start
```

Update `mobile/src/services/supabase.ts` with your Supabase URL and anon key.

## 6. Running Tests

```bash
# API tests
bun test tests/api.test.ts

# E2E tests  
npx playwright test
```

## 7. Cron Jobs for Invoicing

Set up a cron job to generate monthly invoices:
```bash
# Example: Run on 1st of each month
curl -X POST https://your-domain.com/api/cron/generate-invoices
```

## Production Checklist
- [ ] Run schema.sql in Supabase
- [ ] Configure M-Pesa production credentials
- [ ] Deploy to Vercel
- [ ] Set up domain with HTTPS
- [ ] Configure production webhook URL in Safaricom
- [ ] Add rate limiting middleware if needed
- [ ] Set up monitoring (Sentry recommended)
