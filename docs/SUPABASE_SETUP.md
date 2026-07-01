# Supabase Setup for Kodara

This project is designed to connect to Supabase for real auth, data, and realtime.

## 1. Create Supabase Project

1. Go to https://supabase.com
2. Create new project (choose a region close to Kenya if possible)
3. Wait for it to be ready

## 2. Add your keys

Copy `.env.example` → `.env.local`

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

## 3. Run the Schema

In Supabase Dashboard → SQL Editor, paste the entire content of:

`docs/schema.sql`

Then run it.

(You can also enable Row Level Security policies after.)

## 4. Enable Realtime (optional but recommended)

In Supabase Dashboard:
- Database → Replication
- Enable realtime on these tables:
  - payments
  - maintenance_requests
  - messages

## 5. (Future) Auth

We will add:
- Phone + OTP login (perfect for Kenya)
- Role-based access (landlord / property_manager / tenant)

## Current State

The beautiful demo works **without** Supabase.

When keys are present in `.env.local`, the app will be able to switch to live data.

## Next after connecting

- Implement proper auth
- Replace demo functions in `lib/data.ts` with real Supabase queries
- Add realtime subscriptions

This foundation lets us go from demo → production without throwing away any UI/UX work.
