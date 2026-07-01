# API Specification v1

## Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register with phone + OTP |
| POST | `/api/auth/login` | Phone + password |
| POST | `/api/auth/otp/send` | Send OTP for signup/login |
| POST | `/api/auth/otp/verify` | Verify OTP and issue JWT |
| POST | `/api/auth/magic-link` | Send magic link email |

## Properties

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/properties` | List all properties for org |
| POST | `/api/properties` | Create new property |
| GET | `/api/properties/[id]` | Get property with units |
| PUT | `/api/properties/[id]` | Update property |
| DELETE | `/api/properties/[id]` | Archive property |
| POST | `/api/properties/[id]/photos` | Upload property photos |

## Units

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/properties/[id]/units` | List units in property |
| POST | `/api/properties/[id]/units` | Create unit |
| GET | `/api/units/[id]` | Get unit details |
| PUT | `/api/units/[id]` | Update unit |
| POST | `/api/units/[id]/assign` | Assign tenant to unit |
| POST | `/api/units/[id]/vacate` | Vacate unit |

## Tenants

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tenants` | List tenants for org |
| POST | `/api/tenants` | Add tenant to unit |
| GET | `/api/tenants/[id]` | Get tenant profile |
| PUT | `/api/tenants/[id]` | Update tenant details |
| DELETE | `/api/tenants/[id]` | Remove tenant |
| GET | `/api/tenants/[id]/screening` | Get screening data + score |

## Invoices

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/invoices` | List invoices (filter by status) |
| POST | `/api/invoices` | Create manual invoice |
| GET | `/api/invoices/[id]` | Get invoice details |
| PATCH | `/api/invoices/[id]/status` | Update status |
| POST | `/api/invoices/generate` | Generate monthly invoices (cron) |

### Invoice Response Schema

```json
{
    "id": "uuid",
    "invoiceNumber": "INV-2024-001",
    "type": "rent",
    "amount": 15000.00,
    "taxAmount": 0,
    "totalAmount": 15000.00,
    "dueDate": "2024-02-05",
    "billingPeriodStart": "2024-02-01",
    "billingPeriodEnd": "2024-02-29",
    "status": "paid",
    "tenant": { "id": "uuid", "name": "John Doe" },
    "unit": { "id": "uuid", "name": "Flat 1A" },
    "payments": [
        {
            "id": "uuid",
            "amount": 15000.00,
            "paidAt": "2024-02-03T14:30:00Z",
            "method": "mpesa_stk",
            "receipt": "PBG12345678"
        }
    ]
}
```

## Payments

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments/stk-push` | Initiate M-Pesa STK |
| POST | `/api/payments/paybill` | Generate Paybill reference |
| GET | `/api/payments` | List payments |
| GET | `/api/payments/[id]` | Get payment details |

### POST /api/payments/stk-push

**Request:**

```json
{
    "phone": "254712345678",
    "amount": 15000,
    "invoiceId": "uuid"
}
```

**Response:**

```json
{
    "success": true,
    "checkoutRequestId": "ws_CO_250101123456789",
    "merchantId": "123456",
    "message": "STK push sent successfully"
}
```

### Webhook: POST /api/mpesa/callback

**M-Pesa sends:**

```json
{
    "Body": {
        "stkCallback": {
            "MerchantRequestID": "1234-5678",
            "CheckoutRequestID": "ws_CO_250101123456789",
            "ResultCode": 0,
            "ResultDesc": "Success",
            "CallbackMetadata": {
                "Item": [
                    {"Name": "Amount", "Value": 15000},
                    {"Name": "MpesaReceiptNumber", "Value": "PBG12345678"},
                    {"Name": "TransactionDate", "Value": 20240101123456},
                    {"Name": "PhoneNumber", "Value": 254712345678}
                ]
            }
        }
    }
}
```

## Maintenance

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/maintenance` | List requests |
| POST | `/api/maintenance` | Create request |
| GET | `/api/maintenance/[id]` | Get request details |
| PATCH | `/api/maintenance/[id]/status` | Update status |
| POST | `/api/maintenance/[id]/assign` | Assign vendor |
| POST | `/api/maintenance/[id]/photos` | Upload photos |

### Maintenance Request Schema

```json
{
    "id": "uuid",
    "title": "Water leak in kitchen",
    "description": "There is a pipe leaking under the sink",
    "category": "plumbing",
    "photos": ["url1", "url2"],
    "priority": "medium",
    "status": "in_progress",
    "tenant": { "id": "uuid", "name": "John Doe" },
    "unit": { "id": "uuid", "name": "Flat 1A" },
    "vendor": { "id": "uuid", "name": "Plumbing Solutions Ltd" },
    "costEstimate": 2500,
    "actualCost": 2200,
    "scheduledDate": "2024-01-15",
    "completedDate": "2024-01-16",
    "statusUpdates": [
        {"status": "submitted", "at": "2024-01-10T10:00:00Z", "by": "tenant"},
        {"status": "approved", "at": "2024-01-11T09:00:00Z", "by": "landlord"}
    ]
}
```

## Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | List user notifications |
| PATCH | `/api/notifications/[id]/read` | Mark as read |
| POST | `/api/notifications/settings` | Update preferences |

## Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/dashboard` | Summary stats |
| GET | `/api/reports/income` | Income statement |
| GET | `/api/reports/occupancy` | Occupancy rates |
| GET | `/api/reports/arrears` | Outstanding balances |
| GET | `/api/reports/kra-export` | KRA format export |

## Webhooks (External)

| Provider | Endpoint | Purpose |
|----------|----------|---------|
| M-Pesa | `/api/webhooks/mpesa` | Payment confirmations |
| SMS | `/api/webhooks/sms` | Delivery receipts |
| Email | `/api/webhooks/email` | Open/click tracking |

---

## Error Responses

All errors follow RFC 7807 Problem Details format:

```json
{
    "type": "https://kodara.co.ke/errors/validation-error",
    "title": "Validation Failed",
    "status": 400,
    "detail": "Phone number format is invalid",
    "instance": "/api/payments/stk-push",
    "errors": [
        {
            "field": "phone",
            "message": "Invalid Kenyan phone format",
            "code": "invalid_phone_format"
        }
    ]
}
```

### Common Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| `unauthorized` | 401 | No valid session |
| `forbidden` | 403 | No permission |
| `validation_error` | 400 | Invalid input |
| `not_found` | 404 | Resource missing |
| `conflict` | 409 | Duplicate/resource state conflict |
| `rate_limited` | 429 | Too many requests |
| `mpesa_error` | 502 | Daraja API failure |
| `internal_error` | 500 | Server error |

---

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/auth/*` | 10 | minute |
| `/api/payments/*` | 20 | minute |
| `/api/maintenance` | 30 | minute |
| Other | 100 | minute |

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1704067200
```
