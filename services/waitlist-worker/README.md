# AU Lightning Bloc Waitlist API

Cloudflare Worker for managing AU Lightning Bloc virtual card waitlist signups.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create the D1 database:
```bash
wrangler d1 create au-lightning-bloc-waitlist
```

3. Copy the database ID from the output and update `wrangler.toml`

4. Deploy:
```bash
wrangler deploy
```

## API Endpoints

### POST /v1/waitlist/register
Register for the waitlist.

**Request Body:**
```json
{
  "email": "user@example.com",
  "wallet_address": "0x...",
  "card_type": "Standard|Premium|Elite",
  "spending_tier": "Under $500|$500 - $2,000|$2,000 - $10,000|Over $10,000",
  "product": "au_lightning_bloc"
}
```

**Response:**
```json
{
  "success": true,
  "position": 1234,
  "id": "uuid",
  "message": "Successfully registered"
}
```

### GET /v1/waitlist/position?email=user@example.com
Get waitlist position for an email.

**Response:**
```json
{
  "position": 1234,
  "total": 5000,
  "registered_at": "2024-12-02T03:00:00Z"
}
```

### GET /v1/waitlist/stats
Get waitlist statistics (admin).

**Response:**
```json
{
  "total": 5000,
  "by_card_type": [...],
  "by_spending_tier": [...],
  "recent_signups": [...]
}
```

### GET /health
Health check endpoint.

## iOS Integration

The waitlist service is already integrated in the ËTRID Wallet iOS app:
- `ATMService.swift` - `VirtualCardWaitlistService` class
- Endpoint configured: `https://api.etrid.org/v1/waitlist`
