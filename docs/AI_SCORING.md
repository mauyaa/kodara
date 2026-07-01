# AI Tenant Scoring System

## Scoring Factors

| Factor | Weight | Description |
|--------|--------|-------------|
| M-Pesa History | 30% | Payment consistency over 12 months |
| Rent Payment Pattern | 20% | On-time vs late payments ratio |
| Digital Footprint | 15% | Phone usage, airtime purchases |
| Employment Signals | 15% | Salary deposits, business transactions |
| Reference Score | 10% | Previous landlord/employer feedback |
| Social Signals | 5% | (Optional) Social media verification |
| Credit Bureau | 5% | Bureau data if available |

## Scoring Algorithm

```typescript
// workers/ai/tenant-scoring.ts
interface ScoringInput {
    mpesa_history: MpesaTransaction[];
    previous_rents: Payment[];
    references: ReferenceCheck[];
}

export function calculateTenantScore(input: ScoringInput): TenantScore {
    const scores = {
        payment_consistency: calculatePaymentConsistency(input.mpesa_history),
        reliability: calculateReliability(input.previous_rents),
        digital_footprint: calculateDigitalFootprint(input.mpesa_history),
        employment_signal: calculateEmploymentSignal(input.mpesa_history),
        references: calculateReferenceScore(input.references)
    };

    const total = (
        scores.payment_consistency * 0.30 +
        scores.reliability * 0.20 +
        scores.digital_footprint * 0.15 +
        scores.employment_signal * 0.15 +
        scores.references * 0.10 +
        Math.random() * 0.05 // Random for A/B testing
    );

    return {
        score: Math.round(total * 100) / 100,
        recommendation: total >= 70 ? 'approve' : total >= 50 ? 'review' : 'decline',
        factors: scores,
        model_version: 'v1.2',
        calculated_at: new Date().toISOString()
    };
}

function calculatePaymentConsistency(history: MpesaTransaction[]): number {
    const totalTransactions = history.length;
    if (totalTransactions === 0) return 0;

    const regularPayments = history.filter(tx => 
        tx.amount >= 1000 && // Minimum rent threshold
        this.isRegularInterval(tx, history)
    ).length;

    return Math.min(100, (regularPayments / totalTransactions) * 100);
}

function calculateReliability(payments: Payment[]): number {
    const onTime = payments.filter(p => 
        p.paid_date && p.due_date && p.paid_date <= p.due_date
    ).length;
    
    return payments.length > 0 ? (onTime / payments.length) * 100 : 50;
}
```

## Data Pipeline

```
┌─────────────┐
│ M-Pesa API  │
│ (with consent)│
└──────┬──────┘
       │
       ▼
┌─────────────────┐     ┌──────────────────┐
│ Transaction     │────▶│ Raw Storage      │
│ Aggregator      │     │ (15 months)      │
└─────────────────┘     └──────────────────┘
       │
       ▼
┌─────────────────┐
│ Anonymization   │
│ Pipeline        │
└─────────────────┘
       │
       ▼
┌─────────────────┐     ┌──────────────────┐
│ Feature Store   │────▶│ Scoring Model    │
│ (Aggregated)    │     │ (ML/AI)          │
└─────────────────┘     └──────────────────┘
       │                       │
       ▼                       ▼
┌─────────────────────────────────┐
│ Tenant Score (0-100)           │
│ Recommendation: approve/decline/review│
└─────────────────────────────────┘
```

## Consent & Privacy

```typescript
// consent/tenant-data.ts
interface DataConsent {
    mpesa_access: boolean;
    credit_bureau: boolean;
    employment_verification: boolean;
    consent_given_at: Date;
    consent_signature?: string; // For audit trail
}

// GDPR/Kenya DPA compliance
// - Data minimization (only rent-relevant transactions)
// - Purpose limitation (screening only)
// - Retention: 24 months max
// - Right to erasure on request
```

## Risk Tiers

| Score | Tier | Action |
|-------|------|--------|
| 80-100 | Excellent | Auto-approve |
| 60-79 | Good | Approve with standard deposit |
| 40-59 | Fair | Review + larger deposit |
| 20-39 | Poor | Decline or require guarantor |
| 0-19 | Very Poor | Decline |

## Integration Points

- **Tenant Onboarding:** Real-time scoring after application
- **Dashboard:** Score trend visualization
- **Reports:** Portfolio-wide risk analysis
- **Notifications:** Alert on high-risk applicants