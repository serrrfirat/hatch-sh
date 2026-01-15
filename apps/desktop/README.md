# Vibed Desktop

Tauri-based desktop application for Vibed with BYOA (Bring Your Own Agent) mode.

## Setup

### Prerequisites

- Node.js 18+
- Rust (for Tauri)
- pnpm

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm tauri dev
```

### Build

```bash
pnpm tauri build
```

## TODO: GitHub OAuth Setup

> **IMPORTANT**: Before the workspace/repository features will work, you need to set up a GitHub OAuth App.

### Steps to create a GitHub OAuth App:

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App" or "Register a new application"
3. Fill in the application details:
   - **Application name**: `Vibed Desktop` (or your preferred name)
   - **Homepage URL**: `https://vibed.fun` (or your URL)
   - **Authorization callback URL**: `http://localhost` (for device flow, this isn't used but required)
4. Click "Register application"
5. On the next page, note your **Client ID**
6. Update the Client ID in the code:
   - Open `src-tauri/src/github.rs`
   - Find the line: `const GITHUB_CLIENT_ID: &str = "Ov23liYourClientIdHere";`
   - Replace `Ov23liYourClientIdHere` with your actual Client ID

### Important Notes:

- We use GitHub's **Device Flow** for authentication (no client secret needed)
- The device flow is ideal for desktop apps as it doesn't require a redirect URL
- Users will be prompted to enter a code at github.com/login/device

### Testing OAuth:

1. Run the app with `pnpm tauri dev`
2. Click "Add repository" → "Quick start" or try to create a new repo
3. You should see the GitHub login flow appear
4. Enter the code shown at github.com/login/device
5. Once authenticated, you can create/clone repositories

## Features

- **Workspaces**: Isolated branches for parallel agent work
- **GitHub Integration**: Clone, create repos, and create PRs
- **Claude Code Integration**: BYOA mode with local Claude Code CLI
