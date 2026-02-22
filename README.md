<p align="center">
  <!-- Replace with your hero banner image -->
  <img src=".github/assets/hero.jpg" alt="Hatch" width="100%" />
</p>

<p align="center">
  <strong>Your ideas, hatched and shipped.</strong><br/>
  From brainstorm to production in one desktop app.
</p>

<p align="center">
  <a href="https://github.com/serrrfirat/hatch-sh/releases"><img src="https://img.shields.io/github/v/release/serrrfirat/hatch-sh?style=flat-square&color=blue" alt="Release" /></a>
  <a href="https://github.com/serrrfirat/hatch-sh/blob/master/LICENSE"><img src="https://img.shields.io/github/license/serrrfirat/hatch-sh?style=flat-square" alt="License" /></a>
  <a href="https://github.com/serrrfirat/hatch-sh/stargazers"><img src="https://img.shields.io/github/stars/serrrfirat/hatch-sh?style=flat-square" alt="Stars" /></a>
  <a href="https://github.com/serrrfirat/hatch-sh/releases"><img src="https://img.shields.io/github/downloads/serrrfirat/hatch-sh/total?style=flat-square&color=green" alt="Downloads" /></a>
</p>

<p align="center">
  <a href="#install">Install</a> &middot;
  <a href="#features">Features</a> &middot;
  <a href="#how-it-works">How It Works</a> &middot;
  <a href="#development">Development</a> &middot;
  <a href="RELEASING.md">Releasing</a>
</p>

---

<!-- Replace with your demo GIF -->
<p align="center">
  <img src=".github/assets/demo.gif" alt="Hatch demo" width="90%" />
</p>

## Install

### macOS (Homebrew)

```bash
brew tap serrrfirat/tap
brew install --cask hatch
```

### macOS (manual)

Download the `.dmg` from [Releases](https://github.com/serrrfirat/hatch-sh/releases), open it, and drag Hatch to Applications.
The app is not code-signed yet — right-click > **Open** on first launch.

### Linux

```bash
# Debian / Ubuntu
sudo dpkg -i Hatch_*.deb

# AppImage
chmod +x Hatch_*.AppImage && ./Hatch_*.AppImage
```

## Features

| | Feature | Description |
|---|---|---|
| **Build** | Bring Your Own Agent | Connect Claude Code, Cursor, or OpenCode — your agent, your rules |
| **Ideate** | Idea Maze | Visual canvas for brainstorming with AI-powered connections and critiques |
| **Design** | Superdesign | Browse 60,000+ community design prompts without leaving the app |
| **Extend** | Skills Marketplace | Discover and install Claude Code skills from 60,000+ options |
| **Ship** | One-Click Deploy | Push to Cloudflare, Railway, or HereNow in one click |
| **Collaborate** | Git Built-In | Clone, branch, commit, push, and open PRs — all from the UI |

## How It Works

Hatch combines four stages of product development into a single desktop app:

### 1. Ideate — Idea Maze

A spatial canvas where you brainstorm visually. Create idea nodes, connect them with semantic relationships (depends-on, contradicts, extends, alternative), and let AI find patterns you missed. Ask for critiques from five perspectives: Skeptic, Pessimist, Competitor, User, and Maintainer. When you're ready, export your moodboard as a structured plan.

### 2. Design — Superdesign Integration

Browse the community's largest AI design prompt library directly inside Hatch. Find UI patterns, animations, wireframes, and mockups to guide your build. Cached webview means instant tab switching — no reloads.

### 3. Build — BYOA Mode

Hatch doesn't lock you into one AI agent. Plug in Claude Code, Cursor, or OpenCode and work through a chat-based interface with live preview, a full file explorer, tabbed editor, and diff viewer. Workspaces use Git worktrees so you can run multiple ideas in parallel without merge conflicts.

### 4. Ship — Multi-Target Deploy

Deploy your finished product to Cloudflare Workers/Pages, Railway, or HereNow. Track deployment status and browse what others have shipped in the community discovery gallery.

## Architecture

```
hatch-sh/
├── apps/desktop/          # Tauri + React + Zustand + TailwindCSS
│   ├── src/               # React frontend
│   └── src-tauri/         # Rust backend (keychain, shell, fs)
├── services/api/          # Hono + Drizzle ORM (Cloudflare Workers)
├── packages/ui/           # Shared UI components
└── testing/e2e/           # Playwright E2E tests
```

**Stack**: Tauri 2 &middot; React 18 &middot; Zustand &middot; TailwindCSS &middot; Hono &middot; Drizzle ORM &middot; Turborepo &middot; pnpm

## Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- Rust (stable)

### Setup

```bash
pnpm install

# Start the desktop app
pnpm dev

# Optional: API server (separate terminal)
pnpm dev:api
```

### Testing

```bash
pnpm test                    # Unit tests (Vitest)
pnpm test:critical-flows     # E2E tests (Playwright)
```

### Building

```bash
pnpm build:desktop
```

## Privacy

Hatch is local-first. Your workspaces, moodboards, and designs stay on your machine. API keys are stored in your OS keychain (macOS Keychain, Linux Secret Service). Nothing leaves your computer unless you explicitly deploy or push to GitHub.

## License

[MIT](LICENSE)
