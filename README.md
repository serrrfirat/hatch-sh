# Vibed.fun

One stop for launching your business and fundraising.

## What is Vibed.fun?

Vibed.fun lets you build your product with AI and raise funds through token launches on bonding curves—all in one place. Describe what you want to build, watch it come to life, deploy it, and launch a token to fund your vision.

## Features

- **AI-Powered Building**: Describe your idea in plain language and watch Claude build it for you
- **Live Preview**: See your product take shape in real-time as you iterate
- **One-Click Deploy**: Ship your product to production instantly
- **Token Launch**: Raise funds by launching tokens on audited bonding curves (Base blockchain)
- **Discovery**: Get discovered by the community browsing launched projects

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8.15.0+

### Installation

```bash
pnpm install
```

### Environment Setup

Create environment files with the following variables:

**`services/api/.dev.vars`**:
```bash
DATABASE_URL=libsql://your-db.turso.io
DATABASE_AUTH_TOKEN=your-turso-token
CLAUDE_API_KEY=sk-ant-...
CF_API_TOKEN=your-cloudflare-token
CF_ACCOUNT_ID=your-account-id
```

**`packages/contracts/.env`** (for token launches):
```bash
PRIVATE_KEY=0x...
BASESCAN_API_KEY=your-basescan-key
```

### Development

```bash
# Start everything
pnpm dev

# Or run individually
pnpm dev:api          # Backend at http://localhost:8787
pnpm dev:desktop      # Desktop app
```

### Building

```bash
pnpm build
```

## Smart Contracts

Token launches use bonding curves via Mint Club V2 (CertiK audited) on Base.

```bash
cd packages/contracts

pnpm compile          # Compile contracts
pnpm test             # Run tests
pnpm deploy:sepolia   # Deploy to testnet
pnpm deploy:base      # Deploy to mainnet
```

## Database

```bash
cd services/api

pnpm db:generate      # Generate migrations
pnpm db:migrate       # Run migrations
```

## License

MIT
