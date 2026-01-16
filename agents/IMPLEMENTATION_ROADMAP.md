# vibed.fun Implementation Roadmap

## Overview

This roadmap breaks down the MVP into **10 independent modules** that can be built in parallel by multiple agents. Target: MVP in 2-3 days with 4-6 agents working simultaneously.

---

## Module Dependency Graph

```
                    ┌─────────────────┐
                    │  M1: Foundation │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ M2: UI System │   │ M9: Contracts │   │ M5: Backend   │
└───────┬───────┘   └───────────────┘   └───────┬───────┘
        │                                       │
   ┌────┴────┬────────────┐                     │
   ▼         ▼            ▼                     │
┌──────┐ ┌──────┐ ┌─────────────┐               │
│ M3:  │ │ M7:  │ │ M8: Token   │               │
│ Chat │ │Auth  │ │ Launch UI   │               │
└──┬───┘ └──────┘ └─────────────┘               │
   │                                            │
   ▼                                            │
┌─────────────────┐                             │
│ M4: AI Service  │◄────────────────────────────┘
└─────────────────┘
        │
        ▼
┌─────────────────┐
│ M6: Live Preview│
└─────────────────┘
        │
        ▼
┌─────────────────┐
│ M10: Discovery  │
└─────────────────┘
```

---

## Day 1: Foundation & Independent Components

### Phase 1A - Launch Immediately (Parallel)

#### Module 1: Project Foundation [Agent 1]
**Priority: CRITICAL - Blocks others**
**Time: 2-3 hours**

```
Tasks:
1. Initialize Turborepo monorepo
2. Create folder structure:
   - apps/web/
   - apps/discovery/
   - packages/ui/
   - packages/contracts/
   - packages/config/
   - services/api/
   - services/deploy/

3. Set up shared configurations:
   - Root package.json with workspaces
   - turbo.json pipeline config
   - tsconfig.base.json (shared TypeScript config)
   - .eslintrc.js (shared ESLint)
   - .prettierrc

4. Initialize apps/web with Vite + React + TypeScript
5. Set up TailwindCSS with degen color palette
6. Add Framer Motion for animations
7. Create basic routing (React Router)

Files to create:
├── package.json
├── turbo.json
├── tsconfig.base.json
├── .eslintrc.js
├── .prettierrc
├── apps/web/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css (Tailwind imports + degen theme)
│       └── vite-env.d.ts
└── packages/config/
    ├── tailwind/
    │   └── preset.js (degen color palette)
    └── typescript/
        └── base.json
```

**Definition of Done:**
- `pnpm install` works from root
- `pnpm dev` starts the web app
- Tailwind working with degen colors
- Basic App.tsx rendering

---

#### Module 9: Smart Contracts [Agent 2]
**Priority: HIGH - Completely independent**
**Time: 4-6 hours**

```
Tasks:
1. Research existing launchpad SDKs:
   - Clanker SDK (recommended for Base)
   - Wow.xyz contracts
   - Custom bonding curve alternative

2. If using existing SDK:
   - Install SDK package
   - Create integration wrapper
   - Generate TypeScript ABIs

3. If building custom:
   - Implement BondingCurve.sol
   - Implement TokenFactory.sol
   - Write graduation mechanism

4. Deploy to Base Sepolia testnet
5. Export ABIs for frontend

Contract Interface (minimum):
interface IBondingCurve {
    function createToken(
        string name,
        string symbol,
        string imageUri
    ) returns (address tokenAddress);

    function buy(address token) payable;
    function sell(address token, uint256 amount);
    function getPrice(address token) view returns (uint256);
    function graduate(address token); // moves to Uniswap at $69k MC
}

Files to create:
├── packages/contracts/
│   ├── package.json
│   ├── hardhat.config.ts (or foundry.toml)
│   ├── contracts/
│   │   ├── BondingCurve.sol
│   │   ├── TokenFactory.sol
│   │   └── interfaces/
│   ├── scripts/
│   │   └── deploy.ts
│   ├── test/
│   └── deployments/
│       └── baseSepolia.json
└── packages/contracts-sdk/
    ├── package.json
    └── src/
        ├── abi/
        ├── addresses.ts
        └── index.ts (typed contract helpers)
```

**Definition of Done:**
- Contracts deployed to Base Sepolia
- Can create token from script
- Buy/sell working on testnet
- TypeScript ABIs exported

---

#### Module 5: Backend API Scaffold [Agent 3]
**Priority: HIGH - Independent foundation**
**Time: 3-4 hours**

```
Tasks:
1. Initialize Hono API project
2. Set up project structure with routes
3. Set up database schema (use Turso/SQLite or Supabase)
4. Create core entities:
   - Users
   - Projects
   - Deployments
   - TokenLaunches

5. Implement auth middleware (JWT/session)
6. Create API routes scaffold:
   - POST /api/projects - create project
   - GET /api/projects - list user projects
   - GET /api/projects/:id - get project details
   - POST /api/chat - AI chat endpoint
   - POST /api/deploy - trigger deployment
   - POST /api/tokens/launch - launch token
   - GET /api/discovery - list all launched apps

Files to create:
├── services/api/
│   ├── package.json
│   ├── tsconfig.json
│   ├── wrangler.toml (Cloudflare Workers)
│   ├── src/
│   │   ├── index.ts (Hono app)
│   │   ├── routes/
│   │   │   ├── projects.ts
│   │   │   ├── chat.ts
│   │   │   ├── deploy.ts
│   │   │   ├── tokens.ts
│   │   │   └── discovery.ts
│   │   ├── middleware/
│   │   │   └── auth.ts
│   │   ├── db/
│   │   │   ├── schema.ts
│   │   │   └── client.ts
│   │   └── services/
│   │       ├── claude.ts
│   │       └── cloudflare.ts
│   └── drizzle.config.ts
```

**Definition of Done:**
- API running locally on port 8787
- Can create/list projects via curl
- Database schema migrated
- Auth middleware working

---

### Phase 1B - Start After Module 1 Completes (~3 hours in)

#### Module 2: UI Component Library [Agent 4]
**Priority: HIGH - Needed by all UI modules**
**Time: 3-4 hours**

```
Tasks:
1. Create packages/ui with shared components
2. Build degen-styled base components:
   - Button (with glow hover effect)
   - Input (neon border focus)
   - Card (glass morphism + border glow)
   - Badge (for status indicators)
   - Avatar
   - Modal
   - Tabs
   - Dropdown

3. Add animation variants:
   - Glow pulse
   - Slide in
   - Glitch effect
   - Confetti burst (for success states)

4. Create layout components:
   - Header
   - Sidebar (collapsible)
   - Panel (resizable)
   - Divider

Degen styling requirements:
- All interactive elements have hover glow
- Success states: neon green (#00ff88)
- Warning states: orange (#ff6b35)
- Special elements: purple (#a855f7)
- Dark backgrounds throughout
- Monospace font for code/numbers

Files to create:
├── packages/ui/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts (exports)
│   │   ├── components/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Tabs.tsx
│   │   │   └── ... (other components)
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Panel.tsx
│   │   └── animations/
│   │       ├── variants.ts
│   │       └── Confetti.tsx
│   └── tailwind.config.ts
```

**Definition of Done:**
- All base components built
- Components exported from packages/ui
- Storybook or demo page showing components
- Animations working with Framer Motion

---

## Day 2: Core Features & Integration

### Phase 2A - Start of Day 2 (Parallel)

#### Module 3: Chat Interface [Agent 1]
**Depends on: M1, M2**
**Time: 4-5 hours**

```
Tasks:
1. Build ChatArea component
2. Build MessageBubble with markdown rendering:
   - Use react-markdown
   - Add syntax highlighting (highlight.js or Prism)
   - Collapsible code blocks

3. Build ChatInput:
   - Auto-resize textarea
   - Send button with loading state
   - Keyboard shortcuts (Cmd+Enter)

4. Implement chat state management:
   - Message history
   - Streaming responses
   - Loading states
   - Error handling

5. Connect to backend /api/chat endpoint

Files to create:
├── apps/web/src/
│   ├── components/
│   │   └── chat/
│   │       ├── ChatArea.tsx
│   │       ├── MessageBubble.tsx
│   │       ├── ChatInput.tsx
│   │       ├── CodeBlock.tsx
│   │       └── StreamingText.tsx
│   ├── hooks/
│   │   └── useChat.ts
│   └── stores/
│       └── chatStore.ts (zustand)
```

**Definition of Done:**
- Can send messages and see AI responses
- Markdown renders correctly
- Code blocks have syntax highlighting
- Streaming responses work
- Collapsible code blocks

---

#### Module 4: AI Integration Service [Agent 2]
**Depends on: M5 (Backend)**
**Time: 3-4 hours**

```
Tasks:
1. Set up Claude API integration
2. Design system prompt for code generation:
   - Output format (React + TypeScript)
   - Single-file app constraint (for easy preview)
   - Cloudflare Workers compatible code

3. Implement streaming responses
4. Add code extraction from responses
5. Handle rate limits and errors
6. Optional: Add prompt caching

System Prompt Design:
- Role: You are an expert app builder
- Output: Complete React/TypeScript apps
- Constraints: Single entry point, CF Workers compatible
- Style: Clean, minimal, functional

Files to create/update:
├── services/api/src/
│   ├── services/
│   │   └── claude.ts
│   │       - initializeClient()
│   │       - generateCode(prompt, history)
│   │       - streamResponse()
│   │       - extractCodeBlocks()
│   └── prompts/
│       └── codeGeneration.ts
```

**Definition of Done:**
- Claude API connected and working
- Can generate React apps from prompts
- Streaming works end-to-end
- Code extraction working

---

#### Module 6: Live Preview System [Agent 3]
**Depends on: M1, M4**
**Time: 5-6 hours (complex)**

```
Tasks:
1. Research and implement browser-based code execution:
   Option A: WebContainers (Stackblitz)
   Option B: iframe with blob URLs + esbuild-wasm
   Option C: CodeSandbox SDK

2. Build PreviewPanel component
3. Build PreviewFrame (sandboxed iframe)
4. Implement hot reload on code changes
5. Add error boundary and error display
6. Loading states and skeleton UI

Implementation approach (recommended: Option B):
1. Use esbuild-wasm to bundle generated code in browser
2. Create blob URL from bundled output
3. Render in sandboxed iframe
4. Watch for code changes and rebundle

Files to create:
├── apps/web/src/
│   ├── components/
│   │   └── preview/
│   │       ├── PreviewPanel.tsx
│   │       ├── PreviewFrame.tsx
│   │       ├── PreviewError.tsx
│   │       └── PreviewLoading.tsx
│   ├── lib/
│   │   └── bundler/
│   │       ├── index.ts
│   │       ├── esbuild.ts (wasm bundler)
│   │       └── plugins.ts (virtual fs plugin)
│   └── hooks/
│       └── usePreview.ts
```

**Definition of Done:**
- Generated code renders in iframe
- Hot reload works on code changes
- Errors display gracefully
- Performance is acceptable (<2s to preview)

---

#### Module 7: Web3 Authentication [Agent 4]
**Depends on: M1, M2**
**Time: 2-3 hours**

```
Tasks:
1. Choose provider: Privy (recommended) or Dynamic
2. Install and configure SDK
3. Create AuthProvider wrapper
4. Build wallet connection UI:
   - Connect button in header
   - Social login options (Google, Twitter)
   - Wallet options (MetaMask, Coinbase, WalletConnect)

5. Handle auth state globally
6. Integrate with backend (JWT from wallet signature)

Files to create:
├── apps/web/src/
│   ├── providers/
│   │   └── AuthProvider.tsx (Privy config)
│   ├── components/
│   │   └── auth/
│   │       ├── ConnectButton.tsx
│   │       ├── WalletMenu.tsx
│   │       └── AuthModal.tsx
│   └── hooks/
│       └── useAuth.ts
```

**Definition of Done:**
- Can sign in with Google/Twitter
- Wallet auto-created for new users
- Can connect existing wallet
- Auth state persists
- Backend receives valid JWT

---

### Phase 2B - Afternoon Day 2 (Parallel)

#### Module 8: Token Launch Panel [Agent 1]
**Depends on: M2, M7, M9**
**Time: 3-4 hours**

```
Tasks:
1. Build TokenPanel component (right sidebar)
2. Build TokenForm:
   - Token name input
   - Ticker input (auto-prefix $)
   - Image upload/preview
   - AI image generator option (optional)

3. Build TokenStats (post-launch view):
   - Current price
   - Market cap
   - Holder count
   - Mini chart (using lightweight-charts)

4. Build Deploy & Launch button:
   - Pulsing animation
   - Transaction confirmation flow
   - Success confetti

5. Integrate with bonding curve contracts:
   - wagmi hooks for contract calls
   - Transaction status tracking

Files to create:
├── apps/web/src/
│   ├── components/
│   │   └── token/
│   │       ├── TokenPanel.tsx
│   │       ├── TokenForm.tsx
│   │       ├── TokenStats.tsx
│   │       ├── TokenChart.tsx
│   │       ├── DeployButton.tsx
│   │       └── TransactionModal.tsx
│   ├── hooks/
│   │   ├── useTokenLaunch.ts
│   │   └── useTokenStats.ts
│   └── lib/
│       └── contracts/
│           └── bondingCurve.ts (wagmi config)
```

**Definition of Done:**
- Can fill out token details
- Deploy button triggers contract call
- Token launches on Base Sepolia
- Stats display after launch
- Chart shows price history

---

#### Module 10: Discovery Page [Agent 2]
**Depends on: M2, M5, M9**
**Time: 3-4 hours**

```
Tasks:
1. Build discovery page layout
2. Build AppCard component:
   - App name and description
   - Token ticker and price
   - Market cap
   - Creator info
   - "Try App" button

3. Build filtering/sorting:
   - Sort by: market cap, recency, trending
   - Filter by: category (future)

4. Connect to /api/discovery endpoint
5. Add infinite scroll or pagination

Files to create:
├── apps/web/src/
│   ├── pages/
│   │   └── Discovery.tsx
│   ├── components/
│   │   └── discovery/
│   │       ├── AppGrid.tsx
│   │       ├── AppCard.tsx
│   │       ├── SortDropdown.tsx
│   │       └── SearchBar.tsx
│   └── hooks/
│       └── useDiscovery.ts
```

**Definition of Done:**
- Discovery page renders list of apps
- Can sort by market cap/recency
- Clicking app opens it
- Clicking token shows trading interface

---

#### Module 11: Deploy Service [Agent 3]
**Depends on: M5**
**Time: 3-4 hours**

```
Tasks:
1. Set up Cloudflare Workers deployment pipeline
2. Create project bundling service:
   - Take generated code
   - Bundle with esbuild
   - Create CF Worker entry point

3. Implement Cloudflare API integration:
   - Upload worker script
   - Configure routes
   - Custom domains (future)

4. Create deployment status tracking:
   - Pending → Building → Deploying → Live
   - Store deployment logs

5. Return deployment URL

Files to create:
├── services/deploy/
│   ├── package.json
│   ├── wrangler.toml
│   ├── src/
│   │   ├── index.ts
│   │   ├── bundler.ts
│   │   ├── cloudflare.ts
│   │   └── templates/
│   │       └── worker-entry.ts
│   └── test/
```

**Definition of Done:**
- Can deploy generated app to CF Workers
- Deployment URL returned
- Status tracking works
- Deployed apps are accessible

---

## Day 3: Integration & Polish

### Phase 3A - Final Integration [All Agents]

```
Tasks:
1. Connect all modules end-to-end
2. Build the main IDE layout (3-panel)
3. Wire up the full flow:
   - Sign in → Create project → Chat with AI → Preview → Deploy → Launch token

4. Add Projects Sidebar:
   - List user's projects
   - Create new project
   - Switch between projects

5. Error handling throughout
6. Loading states and skeletons
7. Polish animations and transitions
```

### Phase 3B - Testing & Launch Prep

```
Tasks:
1. End-to-end testing on Base Sepolia
2. Fix bugs and edge cases
3. Performance optimization
4. Security review:
   - Input sanitization
   - Wallet transaction safety
   - Rate limiting

5. Deploy to production:
   - Frontend to Vercel/Cloudflare Pages
   - API to Cloudflare Workers
   - Contracts to Base mainnet (when ready)
```

---

## Agent Assignment Summary

| Day | Time | Agent 1 | Agent 2 | Agent 3 | Agent 4 |
|-----|------|---------|---------|---------|---------|
| 1 | AM | M1: Foundation | M9: Contracts | M5: Backend | (waiting) |
| 1 | PM | (support) | M9 (cont) | M5 (cont) | M2: UI Library |
| 2 | AM | M3: Chat | M4: AI Service | M6: Preview | M7: Auth |
| 2 | PM | M8: Token UI | M10: Discovery | M11: Deploy | Integration |
| 3 | ALL | Integration & Polish across all agents |

---

## Quick Start Commands

```bash
# After Module 1 completes, all agents can run:
pnpm install
pnpm dev          # Start web app
pnpm dev:api      # Start backend

# Contract agent:
cd packages/contracts
pnpm hardhat test
pnpm hardhat deploy --network baseSepolia

# Deploy service:
cd services/deploy
pnpm wrangler dev
```

---

## Key Technical Decisions

1. **Monorepo**: Turborepo (fast, good DX)
2. **Frontend**: Vite + React 18 + TypeScript
3. **Styling**: TailwindCSS + Framer Motion
4. **State**: Zustand (simple, fast) + React Query (server state)
5. **Auth**: Privy (best Web3 social login)
6. **Backend**: Hono on Cloudflare Workers
7. **Database**: Turso (SQLite at edge) or Supabase
8. **Contracts**: Evaluate Clanker SDK first, custom if needed
9. **Preview**: esbuild-wasm + iframe blob URLs
10. **Deploy**: Cloudflare Workers API

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Contract complexity | Use existing SDK (Clanker) first |
| Preview performance | Start with simple iframe, optimize later |
| AI code quality | Iterate on prompts, add validation |
| Web3 UX friction | Privy handles wallet abstraction |

---

## Success Criteria (MVP)

- [ ] User can sign in with social
- [ ] User can describe app to AI
- [ ] AI generates working React code
- [ ] Code previews in real-time
- [ ] User can deploy to Cloudflare Workers
- [ ] User can launch token on Base
- [ ] Discovery page shows launched apps
- [ ] Full flow works end-to-end on testnet
