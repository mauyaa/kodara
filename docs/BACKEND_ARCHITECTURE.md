# Backend Architecture (NestJS Alternative)

For production-scale operations, a dedicated NestJS backend provides better separation of concerns, job queues, and microservice capabilities.

## Directory Structure

```
backend/
├── src/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── jwt.strategy.ts
│   │   └── guards/
│   │       ├── jwt-auth.guard.ts
│   │       └── roles.guard.ts
│   ├── properties/
│   │   ├── properties.controller.ts
│   │   ├── properties.service.ts
│   │   ├── dto/
│   │   └── entities/
│   ├── tenants/
│   │   ├── tenants.controller.ts
│   │   ├── tenants.service.ts
│   │   └── dto/
│   ├── payments/
│   │   ├── payments.controller.ts
│   │   ├── payments.service.ts
│   │   ├── mpesa/
│   │   │   ├── mpesa.client.ts
│   │   │   └── mpesa-webhook.controller.ts
│   │   └── jobs/
│   │       ├── reminder.processor.ts
│   │       └── reconciliation.processor.ts
│   ├── invoices/
│   │   ├── invoices.controller.ts
│   │   ├── invoices.service.ts
│   │   └── jobs/
│   │       └── generator.processor.ts
│   ├── maintenance/
│   ├── notifications/
│   ├── ai/
│   │   ├── tenant-scoring.service.ts
│   │   └── models/
│   ├── common/
│   │   ├── interceptors/
│   │   ├── pipes/
│   │   └── decorators/
│   ├── config/
│   └── main.ts
├── test/
├── Dockerfile
├── docker-compose.yml
└── nest-cli.json
```

## Core Modules

### Authentication Module (`auth/`)

```typescript
// auth/auth.service.ts
@Injectable()
export class AuthService {
    async validateUser(phone: string, password: string): Promise<User | null> {
        const user = await this.usersService.findByPhone(phone);
        if (user && await bcrypt.compare(password, user.passwordHash)) {
            return user;
        }
        return null;
    }

    async login(user: User) {
        const payload = { 
            sub: user.id, 
            phone: user.phone,
            role: user.role,
            orgId: user.organizationId 
        };
        return {
            access_token: this.jwtService.sign(payload),
            user: this.usersService.toProfile(user)
        };
    }
}
```

### Payments Module (`payments/`)

```typescript
// payments/mpesa/mpesa.client.ts
@Injectable()
export class MpesaClient {
    private baseUrl = 'https://api.safaricom.co.ke';
    private accessToken: string;

    async getAccessToken(): Promise<string> {
        // Cache for 1 hour (Daraja tokens expire)
        if (!this.accessToken) {
            const auth = Buffer.from(
                `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
            ).toString('base64');

            const res = await fetch(`${this.baseUrl}/oauth/v1/generate?cache=cache`, {
                headers: { Authorization: `Basic ${auth}` }
            });
            const data = await res.json();
            this.accessToken = data.access_token;
        }
        return this.accessToken;
    }

    async initiateSTK(pushData: STKPushDTO): Promise<Payment> {
        const timestamp = format(new Date(), 'yyyyMMddHHmmss');
        const password = this.generatePassword(timestamp);
        
        return fetch(`${this.baseUrl}/mpesa/stkpush/v1/processrequest`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${await this.getAccessToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                BusinessShortCode: process.env.MPESA_SHORTCODE,
                Password: password,
                Timestamp: timestamp,
                TransactionType: 'CustomerPayBillOnline',
                Amount: pushData.amount,
                PartyA: pushData.phone,
                PartyB: process.env.MPESA_SHORTCODE,
                PhoneNumber: pushData.phone,
                CallBackURL: process.env.MPESA_CALLBACK_URL,
                AccountReference: pushData.accountReference,
                TransactionDesc: pushData.transactionDesc
            })
        });
    }
}
```

## Deployment Configuration

### Docker Compose (Production)

```yaml
version: '3.8'
services:
    api:
        build: ./backend
        ports:
            - "3001:3001"
        environment:
            - DATABASE_URL=${DATABASE_URL}
            - REDIS_URL=redis://redis:6379
            - MPESA_CONSUMER_KEY=${MPESA_CONSUMER_KEY}
            - MPESA_CONSUMER_SECRET=${MPESA_CONSUMER_SECRET}
        depends_on:
            - redis

    redis:
        image: redis:7-alpine
        ports:
            - "6379:6379"

    worker:
        build: ./backend
        command: npm run start:worker
        environment:
            - DATABASE_URL=${DATABASE_URL}
            - REDIS_URL=redis://redis:6379
```

### Environment Variables (Backend)

```bash
# .env.backend
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
MPESA_CONSUMER_KEY=...
MPESA_CONSUMER_SECRET=...
MPESA_PASSKEY=...
MPESA_SHORTCODE=...
MPESA_CALLBACK_URL=https://app.kodara.co.ke/api/mpesa/callback
SMS_PROVIDER_API_KEY=...
EMAIL_PROVIDER_API_KEY=...
JWT_SECRET=...
JWT_EXPIRES_IN=7d
```
