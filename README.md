# PennyArena

Micropayment content arena on **Arc Testnet** for the Lepton Agents Hackathon.

Publish for **$0.01 USDC** · Duel entry **$0.01** · Votes from **$0.001** · Tips anytime.

Educational testnet demo only.

## Features

- **14 topics** (Arc testnet, Circle Modular Wallets, memes, …)
- **Content types**: post, image, video, audio, meme
- **Twitter-style feed** with popular duels & content
- **Duels**: challenge a rival on the same topic → opponent accepts → 1h weighted voting
- **Settlement**: 50% to winning author, 50% to voters who picked the winner.
- **Tips** on any post (on-chain to author)
- **PENNY points** for activity (future conversion demo)
- **Passkey wallet** via Circle Modular Wallets
- **Public profiles**, search, leaderboard

## Prerequisites

- Node.js **22+**
- [Circle Developer Console](https://console.circle.com/) — **Testnet**
- **Client Key** + **Passkey Domain** = `your_domain`
- **API Key** + entity registration (`npm run register-entity`)
- Testnet USDC: [faucet.circle.com](https://faucet.circle.com) → **Arc Testnet**
- A treasury wallet address (your testnet `0x…`) for publish/duel/vote fees

## Quick start

```powershell
git clone <your-repo-url> penny-arena
cd penny-arena
copy .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_CIRCLE_CLIENT_KEY=TEST_API_KEY:your-client-key
NEXT_PUBLIC_CIRCLE_CLIENT_URL=https://modular-sdk.circle.com/v1/rpc/w3s/buidl
CIRCLE_API_KEY=TEST_API_KEY:your-api-key
NEXT_PUBLIC_PENNY_TREASURY_ADDRESS=0xYourTreasuryWallet
PENNY_SESSION_SECRET=your-random-string-at-least-32-characters-long
```

Register Circle entity (one time):

```powershell
npm install
npm run register-entity
```

Circle Console → **Wallets** → Passkey Domain = `your_domain`

Run dev server:

```powershell
npm run dev
```

Open [your_domain]

### First session

1. **Log in** → Register passkey (Circle username)
2. **Settings** → set unique **username**
3. Fund wallet: **Rewards** → Deposit → copy address → [faucet](https://faucet.circle.com) (Arc Testnet)
4. **Post** → pick topic → pay **$0.01** publish fee
5. Second author on same topic → **Challenge duel** → opponent **Accept** with duel ID
6. Others **Vote** with micro-USDC

### Mobile / LAN passkeys

```powershell
npm run dev:https
```

Add your host to Circle Console Passkey Domain (e.g. `190.178.1.07` or Vercel URL).

## Deploy

1. Push to your Git host → import in Vercel (or similar)
2. Add env vars from `.env.example`
3. Set Circle Passkey Domain to your production host
4. Note: JSON file storage is ephemeral on serverless — use Redis (Upstash) for shared state in production

## Project structure

```
app/           Pages & API routes
components/    UI, wallet, feed
lib/           Arc, stores, pricing, topics
data/          Local JSON (profiles, content, duels) — gitignored
public/uploads User media
```

## Demo economics

| Action | Cost |
|--------|------|
| Publish content | $0.01 USDC → treasury |
| Duel entry (each author) | $0.01 USDC → treasury |
| Vote | ≥ $0.001 USDC → treasury (weight = amount / 0.001) |
| Tip | any amount → author wallet directly |

**Pending winnings** after duels are tracked in-app (demo ledger). Tips arrive on-chain immediately.

## Troubleshooting

| Error | Fix |
|-------|-----|
| Cannot find entity config | Run `npm run register-entity`, set Passkey Domain |
| Treasury not configured | Set `NEXT_PUBLIC_PENNY_TREASURY_ADDRESS` |
| Transfer not verified | Wait for Arc confirmation, check amount matches exactly |
| Passkey fails off localhost | Use `npm run dev:https` or deploy to HTTPS |

## License

MIT — hackathon demo.
