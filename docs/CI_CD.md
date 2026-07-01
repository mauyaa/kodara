# CI/CD Pipeline Configuration

## GitHub Actions Workflows

### Main Pipeline (.github/workflows/deploy.yml)

```yaml
name: CI/CD Pipeline
on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  lint-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test:ci -- --coverage
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}

  deploy-staging:
    needs: lint-test
    if: github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_PROD }}
          working-directory: .
          scope: ${{ secrets.VERCEL_SCOPE }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          alias-domains: staging.kodara.co.ke
          vercel-args: '--prod'

  security-scan:
    needs: lint-test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: anchore/sbom-action@v0
        with:
          format: spdx-json
      - uses: anchore/scan-action@v3
        with:
          sbom-path: ./sbom.spdx.json

  deploy-prod:
    needs: [lint-test, security-scan]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - name: Wait for approvals
        uses: trstringer/wait-for-approvals@v1
        with:
          wait-for-approvals: 2
          timeout-minutes: 60
      
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_PROD }}
          working-directory: .
          scope: ${{ secrets.VERCEL_SCOPE }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          vercel-args: '--prod'
      
      - name: Trigger Supabase functions deploy
        run: |
          curl -X POST https://api.supabase.io/v1/projects/${{ secrets.SUPABASE_PROJECT_ID }}/functions/deploy \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}"
```

## Pre-commit Hooks (.husky/pre-commit)

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npx lint-staged
npm run type-check
npm run test:quick
```

## Code Quality Standards

### ESLint Configuration (.eslintrc.json)

```json
{
    "extends": ["next/core-web-vitals", "plugin:@typescript-eslint/recommended"],
    "rules": {
        "@typescript-eslint/no-unused-vars": "error",
        "@typescript-eslint/explicit-function-return-type": "warn",
        "no-console": ["error", { "allow": ["warn", "error"] }],
        "security/detect-object-injection": "error"
    },
    "plugins": ["security"]
}
```

### Testing Matrix

| Type | Tool | Command | Threshold |
|------|------|---------|-----------|
| Unit | Jest | `npm run test` | 85% coverage |
| Integration | Supertest | `npm run test:integration` | 80% |
| E2E | Playwright | `npm run test:e2e` | Critical paths |
| Type | TypeScript | `npm run type-check` | Strict mode |
| Security | Snyk | `npm run security` | No high vulns |
| Lint | ESLint | `npm run lint` | 0 warnings (prod) |

### Deployment Checks

Before each deployment:
- [ ] All tests pass
- [ ] Security scan clean
- [ ] Schema migrations applied
- [ ] Environment variables validated
- [ ] Rate limiting configured
- [ ] Monitoring alerts set up

---

## Rollback Strategy

1. **Database:** Supabase point-in-time recovery (PITR)
2. **Frontend:** Vercel instant rollback via dashboard
3. **API:** Blue-green deployment pattern
4. **Feature Flags:** LaunchDarkly for gradual rollout

## Monitoring

| Metric | Alert Threshold | Action |
|--------|-----------------|--------|
| API error rate | >1% | Page on-call |
| M-Pesa callback failures | >0.1% | Manual reconciliation |
| DB connection pool | >80% | Scale up |
| Real-time latency | >500ms | Check Supabase status |
| Missing payments | >24h | Alert finance team |
