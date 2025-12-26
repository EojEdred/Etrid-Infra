# ETRID Telegram Governance Bot

Telegram bot for validator collective governance voting.

**Admin:** @gizziio

## Features

- View active proposals via Telegram
- Vote on proposals with inline buttons
- Receive notifications for new proposals
- Register validators with admin approval
- Admin can create and broadcast proposals

## Setup

### 1. Create Telegram Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow prompts
3. Name: `ETRID Governance Bot`
4. Username: `etrid_governance_bot` (or similar)
5. Copy the bot token

### 2. Get Your Chat ID

1. Message [@userinfobot](https://t.me/userinfobot) on Telegram
2. Copy your chat ID number

### 3. Configure Environment

```bash
cd services/telegram-governance-bot
cp .env.example .env
```

Edit `.env`:
```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
ADMIN_CHAT_ID=your_chat_id_here
WS_ENDPOINT=wss://primearc.etrid.io
```

### 4. Install & Run

```bash
npm install
npm run dev
```

For production:
```bash
npm run build
npm start
```

## Commands

### User Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and status |
| `/help` | Detailed help |
| `/proposals` | List active proposals |
| `/vote <idx> <yes\|no>` | Vote on proposal |
| `/status` | Your validator status |
| `/register <address>` | Request validator registration |

### Admin Commands (@gizziio only)

| Command | Description |
|---------|-------------|
| `/propose <desc>` | Create new proposal |
| `/admin_add_validator <user> <addr>` | Add validator |
| `/admin_broadcast <msg>` | Broadcast to all validators |

## Voting Flow

1. Admin creates proposal: `/propose Upgrade runtime to v110`
2. Bot broadcasts to all validators with inline vote buttons
3. Validators click `Vote YES` or `Vote NO`
4. Bot tracks votes until threshold (5-of-9) reached
5. When threshold met, proposal passes/fails

## CLI Alternative

For validators who prefer command-line:

```bash
# List proposals
npx ts-node scripts/governance/vote-collective.ts --list

# Vote on proposal
npx ts-node scripts/governance/vote-collective.ts \
  --proposal 1 \
  --vote yes \
  --seed "your mnemonic phrase"

# Create proposal (admin)
npx ts-node scripts/governance/vote-collective.ts \
  --propose "Description" \
  --seed "admin mnemonic"
```

## Validator Registration

1. Validator sends: `/register 5ABC...XYZ`
2. Bot notifies @gizziio
3. Admin approves: `/admin_add_validator username 5ABC...XYZ`
4. Validator can now vote

## Security Notes

- Bot token should be kept secret
- Validator seeds are NOT stored by bot
- On-chain votes require separate signing (via CLI)
- Telegram votes are tracked off-chain for convenience
- Final authority is always the on-chain collective

## Architecture

```
User Telegram ──> Bot ──> In-memory tracking
                   │
                   └──> Primearc Chain (via WebSocket)
                              │
                              └──> ValidatorCollective pallet
```

## Production Deployment

```bash
# Build
npm run build

# Run with PM2
pm2 start dist/index.js --name etrid-governance-bot

# Check logs
pm2 logs etrid-governance-bot
```

## Support

Contact @gizziio on Telegram for issues or registration.
