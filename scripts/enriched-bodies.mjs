/** Richer body text for official seed posts (by id). */
export const ENRICHED_BODIES = {
  "wd-02": `PennyArena design notes — what actually moves the needle in 2026:

• Wallet state is UI: disconnected → connecting → wrong network → pending tx → confirmed. If any step is missing, users bounce.
• Revert messages should be human-readable, not raw hex. "Insufficient USDC" beats "execution reverted 0x08c379a0…"
• Mobile-first isn't optional — most Arc testnet demos happen on phones at events.
• Dark navy + gold accents signal "finance app" without screaming crypto bro. We're leaning into that here.

Good Web3 design reduces support tickets more than it wins Dribbble likes.`,

  "wd-03": `Who's setting the UX bar for crypto in 2026?

Rainbow & Phantom — passkey onboarding that feels like a normal app login, not a seed phrase lecture.

Circle Modular Wallets — gasless USDC sends with Face ID. The benchmark for payment apps on Arc.

Zapper & Uniswap — dense DeFi data made scannable. Tabs, skeleton loaders, and clear slippage warnings.

In-house teams at Aave and Coinbase — ship accessibility and localization at scale.

Agencies like Turum-burum — bridge Web2 polish with onchain edge cases.

The through-line: explain irreversible actions, show fees upfront, and never hide failure states.`,

  "wd-04": `Web3 design ≠ neon gradients on a landing page.

It's transaction transparency — users should always know what they're signing and what it costs.

It's wallet integration — connect, disconnect, switch account, session expiry, all first-class.

It's permission UX — role-based UI when contracts have admin vs user flows.

It's making irreversible actions feel safe — confirm sheets, summaries, undo windows where possible.

The best teams treat design as risk management. Every confusing screen is a potential lost deposit.`,

  "sc-01": `What's actually getting deployed onchain in 2026?

Top patterns by volume:
1. ERC-20 tokens — still the default for points, rewards, and governance
2. ERC-721 / ERC-1155 — gaming assets, credentials, event tickets
3. Uniswap V2/V3 pools — liquidity is still the killer app
4. Aave-style lending pools — borrow/lend with oracle-priced collateral
5. OpenZeppelin AccessControl + UUPS proxies — upgradeable prod contracts

Fastest-growing category: account abstraction wallets (ERC-4337 / ERC-6900). Passkeys + gas sponsorship are moving from demo to default.

If you're starting on Arc testnet: Circle Contracts templates + Foundry tests + Arcscan verify is the shortest path to a shippable token.`,

  "sc-05": `Essential smart contract toolkit — PennyArena builder checklist:

Foundry — compile, fuzz, fork-test against mainnet state. Faster iteration than Hardhat-era workflows.

OpenZeppelin — battle-tested ERC20/721/AccessControl. Don't roll your own auth.

Slither / Mythril — static analysis before mainnet. Cheap insurance.

Arcscan — verify source so users (and auditors) can read what they're interacting with.

Circle Contracts — token templates wired for USDC-native chains.

Pro tip: write tests for failure paths, not just happy paths. Most exploits live in edge cases your first draft didn't consider.`,

  "news-01": `Week ahead: macro & onchain catalysts (Jul 6–12, 2026)

Mon — US ISM Services PMI: risk sentiment often moves with services activity.

Tue — Berachain PoL Next hardfork: emissions model shifts toward sWBERA.

Tue — Pyth DAO vote ends: watch oracle fee and publisher reward params.

Tue — Zama Developer Program S3 applications close.

Wed — FOMC minutes (21:00 MSK): rate-path hints move BTC, ETH, and stablecoin flows.

Thu — Fetch.ai × Goodwood FOS partnership announcement.

Fri–Sun — Arbitrum Open House London: workshops, demos, founder networking.

Sun — Major PUMP token unlock.

Bookmark this thread — we'll recap what actually moved markets next Monday.`,

  "stab-01": `USDC in 2026 — why builders still default to it on Arc:

Regulated issuance with monthly attestations from Circle.

Native EIP-3009 gasless transfers — perfect for micropayments and agent commerce.

CCTP cross-chain mint/burn — unified liquidity without wrapped-token risk.

Deep integration on Arc, Base, Ethereum, Solana, and expanding L2s.

Circle programs for builders, institutions, and creators — grants, support, and co-marketing.

On PennyArena, every vote and tip settles in USDC on Arc testnet. Real money rails, sandbox environment.`,

  "stab-02": `Stablecoin landscape snapshot — July 2026:

USDT (~62% share) — liquidity king, especially in Asia and CEX pairs.

USDC (~25%) — compliance and institutional default, dominant on Arc and US-regulated venues.

DAI / USDS — decentralized collateral basket, DeFi-native.

USDe — synthetic dollar with funding-rate yield, high growth but different risk profile.

FDUSD — exchange-aligned, growing in Asian markets.

OpenUSD (OUSD) — 140-firm consortium (Visa, Mastercard, BlackRock, etc.) challenging incumbents.

Trade-off matrix: liquidity vs compliance vs yield vs distribution. Pick two.`,

  "stab-04": `Stablecoins aren't just DeFi collateral anymore.

Coffee shops in Singapore accept USDC QR payments.

Freelancers invoice in USDC and settle in seconds, not T+2.

Creators on PennyArena receive $0.001 votes that actually add up.

Payroll teams run monthly USDC batches onchain with audit trails.

The internet is getting a dollar layer — and it behaves like money, not a speculative asset.`,

  "pred-02": `Prediction markets compared — where to trade events in 2026:

Polymarket — crypto-native, global, deepest liquidity on elections and culture metrics. USDC on Polygon (and expanding).

Kalshi — CFTC-regulated, USD-denominated, strong in US politics and macro. Recently expanded into event contracts and perps.

PredictIt — academic/political focus, position caps, US audience.

2026 volume is concentrating on elections, sports, and social metrics (tweet counts, streaming numbers).

Institutional thesis: event markets are becoming financial infrastructure, not just betting sites.`,

  "game-01": `What people are actually playing in 2026:

Single-player epics — Elden Ring DLC still eating hours; Clair Obscur: Expedition 33 surprised everyone.

Live service staples — Fortnite, Roblox, Apex keep the daily active numbers.

GTA VI hype cycle — every trailer breaks records even without a firm date.

Monster Hunter Wilds — co-op dominates friend groups.

UGC platforms — Roblox and Fortnite Creative blur player/creator lines.

Web3 angle: onchain items are experimenting, but fun + friends still beat tokenomics.`,

  "game-02": `Most anticipated games — 2026 watchlist:

GTA VI — the elephant in every gaming conversation.

Death Stranding 2 — Kojima's next surreal road trip.

Metroid Prime 4 — Nintendo fans waited 15+ years.

Fable reboot — Playground Games' take on classic Xbox IP.

Hollow Knight: Silksong — still "any day now" but officially dated.

Several moved from "coming soon" to concrete release windows this year. Which one are you pre-ordering?`,

  "game-03": `A brief history of video games — thread:

1962 — Spacewar! on MIT's PDP-1. Two ships, one star, gravity. Pure hacker joy.

1970s–80s — Arcades → Atari → NES. You bought a cartridge, you owned the game.

1990s — 3D era: Mario 64, Tomb Raider, Half-Life. PC mod scenes explode.

2000s — Xbox Live makes online multiplayer default. WoW proves MMOs go mainstream.

2010s — Mobile + F2P. Fortnite's battle pass becomes a $20B business model.

2020s — UGC (Roblox, Fortnite Creative), AI-assisted dev tools, onchain economies experimenting with player-owned assets.

What's your first gaming memory?`,
};
