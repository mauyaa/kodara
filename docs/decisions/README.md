# Architecture decisions

Short records of the decisions that shape Kodara's backend. Recorded on
2026-10-22 from the code and migrations as they stand.

| # | Decision |
| --- | --- |
| [0001](0001-rls-is-the-authorization-boundary.md) | PostgreSQL row-level security is the authorization boundary |
| [0002](0002-mpesa-behind-edge-functions.md) | Only M-Pesa work crosses an Edge Function boundary |
| [0003](0003-idempotent-attempts-and-atomic-callbacks.md) | Payment attempts are idempotent and callbacks are recorded atomically |
| [0004](0004-reconciliation-queue-not-best-guess.md) | Payments that do not match go to a reconciliation queue, not a best guess |

Incidents are reviewed in [`../incidents`](../incidents).
