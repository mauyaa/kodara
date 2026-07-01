# Kodara Technical Blueprint
## Property Management Operating System for Kenya

---

## 1. System Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENTS (Multi-Channel)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐    ┌───────────────┐    ┌─────────────────┐              │
│  │   Web PWA     │    │ Flutter       │    │ Admin Portal    │              │
│  │ (Next.js)     │    │ (Mobile)      │    │ (Next.js)       │              │
│  └───────────────┘    └───────────────┘    └─────────────────┘              │
└────────────────────────────────────┬──────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        API LAYER (Backend-for-Frontend)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Next.js API Routes (Serverless)                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │   │
│  │  │ Auth Proxy  │  │ M-Pesa      │  │ Webhooks    │  │ Documents   │ │   │
│  │  │ (JWT)       │  │ Integration │  │ Handler     │  │/API         │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────┬──────────────────────────────────────┘
                                     │
                  ┌─────────────────────┼─────────────────────┐
                  ▼                   ▼                     ▼
┌─────────────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐
│    Supabase (Core)      │  │   External      │  │    Asynchronous         │
│  ┌───────────────────┐  │  │   Services      │  │     Workers             │
│  │ PostgreSQL +      │  │  │ ┌───────────┐   │  │ ┌───────────────────┐   │
│  │ Realtime          │  │  │ │ Safaricom │   │  │ │ Reminder Service  │   │
│  │                   │  │  │ │ Daraja    │   │  │ │ (Cron)            │   │
│  │ Auth, Storage,    │  │  │ │ API       │   │  │ └───────────────────┘   │
│  │ Edge Functions    │  │  │ └───────────┘   │  │ ┌───────────────────┐   │
│  └───────────────────┘  │  │ ┌───────────┐   │  │ │ Report Generator  │   │
│                         │  │ │ SMS/Email │   │  │ │ (Scheduler)       │   │
│ ┌───────────────────┐   │  │ │ Providers │   │  │ └───────────────────┘   │
│ │ Row Level         │   │  │ └───────────┘   │  │ ┌───────────────────┐   │
│ │ Security (RLS)    │   │  │ ┌───────────┐   │  │ │ AI Scoring Engine │   │
│ └───────────────────┘   │  │ │ KRA      │   │  │ │ (Batch)           │   │
│                         │  │ │ Integration│   │  │ └───────────────────┘   │
│ ┌───────────────────┐   │  │ └───────────┘   │  └─────────────────────────┘
│ │ Edge Functions    │   │  └─────────────────┘
│ │ (Business Logic)  │   │
│ └───────────────────┘   │
└─────────────────────────┘
```

### Technology Stack Rationale

| Layer | Technology | Justification |
|-------|------------|---------------|
| Frontend | Next.js 16 + PWA | React 19, RSC, server components, SEO-friendly, mobile-responsive |
| Mobile | Flutter (Dart) | Native performance, M-Pesa STK integration, single codebase for iOS/Android |
| Backend | Next.js API Routes + Edge Functions | Serverless, scales automatically, low latency |
| Database | PostgreSQL (Supabase) | ACID compliance, JSONB, full-text search, RLS |
| Realtime | Supabase Realtime | WebSocket-based, instant updates, low overhead |
| Auth | Supabase Auth + JWT | Phone/OTP native, JWT claims for RBAC |
| Storage | Supabase Storage | Integrated with RLS, S3-compatible |
| Queue | Supabase + Inngest (future) | Background jobs, scheduled tasks |
| Hosting | Vercel + Supabase | Edge network, zero-config deployments |

---
