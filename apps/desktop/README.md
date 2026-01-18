# Hatch Desktop

Tauri-based desktop application for Hatch with BYOA (Bring Your Own Agent) mode.

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
   - **Application name**: `Hatch Desktop` (or your preferred name)
   - **Homepage URL**: `https://hatch.sh` (or your URL)
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

- **IDE Mode**: Full-featured code editor with file tree navigation and diff viewer
- **Idea Maze**: Visual brainstorming canvas for organizing ideas with connections
- **Skills Marketplace**: Browse and install Claude Code skills, agents, and commands
- **GitHub Integration**: Clone, create repos, and create PRs via GitHub OAuth Device Flow
- **Claude Code Integration**: BYOA (Bring Your Own Agent) mode with local Claude Code CLI
- **Live Preview**: In-app preview of web applications with esbuild bundling
- **Multi-Agent Support**: Pluggable agent architecture with Claude, Gemini, and custom adapters

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React 18 + Vite |
| Desktop Runtime | Tauri 2 |
| Language | TypeScript |
| State Management | Zustand |
| Styling | Tailwind CSS |
| Animation | Framer Motion, GSAP |
| Code Display | React Syntax Highlighter |
| Markdown | React Markdown + GFM |
| UI Components | @hatch/ui (workspace package) |

## File Structure

```
apps/desktop/
├── index.html              # Entry HTML
├── package.json            # Dependencies
├── vite.config.ts          # Vite configuration
├── tailwind.config.ts      # Tailwind configuration
├── tsconfig.json           # TypeScript config
├── src/
│   ├── main.tsx            # React entry point
│   ├── App.tsx             # Root component with routing
│   ├── index.css           # Global styles
│   ├── components/
│   │   ├── chat/           # Chat UI (ChatInput, MessageBubble, ToolUseBlock, etc.)
│   │   ├── editor/         # Code editor (DiffViewer, FileViewer)
│   │   ├── ideaMaze/       # Idea canvas (IdeaCard, connections, sidebar)
│   │   ├── marketplace/    # Skills marketplace (SkillCard, SkillGrid, etc.)
│   │   ├── preview/        # Live preview (PreviewPanel, PreviewFrame)
│   │   ├── layout/         # Layout components (Layout, ProjectTree)
│   │   ├── icons/          # Custom icons (AgentIcons, FileIcon)
│   │   ├── discovery/      # App discovery gallery
│   │   ├── repository/     # Repository management
│   │   └── token/          # Token launch components
│   ├── hooks/
│   │   ├── useChat.ts      # Chat state and AI interaction
│   │   ├── useIdeaMazeChat.ts  # Idea Maze AI integration
│   │   └── usePreview.ts   # Preview state management
│   ├── lib/
│   │   ├── agents/         # Multi-agent adapter system
│   │   ├── bundler/        # esbuild-wasm bundling
│   │   ├── claudeCode/     # Claude Code CLI bridge
│   │   ├── git/            # Git operations bridge
│   │   ├── github/         # GitHub API bridge
│   │   └── ideaMaze/       # Idea Maze utilities (storage, types, animations)
│   ├── pages/
│   │   ├── IDEPage.tsx     # Main IDE view
│   │   ├── IdeaMazePage.tsx    # Idea brainstorming canvas
│   │   ├── MarketplacePage.tsx # Skills marketplace
│   │   └── DesignPage.tsx  # Design view
│   ├── services/
│   │   └── skillsService.ts    # Skills marketplace API client
│   └── stores/
│       ├── chatStore.ts    # Chat message state
│       ├── editorStore.ts  # Editor file/tab state
│       ├── ideaMazeStore.ts    # Idea cards and connections
│       ├── marketplaceStore.ts # Marketplace state
│       ├── projectStore.ts # Current project state
│       ├── repositoryStore.ts  # Git repository state
│       └── settingsStore.ts    # User settings and preferences
└── src-tauri/
    ├── Cargo.toml          # Rust dependencies
    ├── tauri.conf.json     # Tauri configuration
    └── src/
        ├── main.rs         # Tauri entry point
        ├── lib.rs          # Core Tauri commands
        ├── git.rs          # Git operations (clone, commit, branch, etc.)
        ├── github.rs       # GitHub OAuth Device Flow
        └── skills.rs       # Skills installation commands
```

## Roadmap

### Workspace Integration
- [ ] Implement moodboard filtering by workspace
- [ ] Store workspace-specific moodboards in workspace directories
- [ ] Add workspace selector to sidebar

### Moodboard & Idea Maze
- [ ] Export/Import moodboards
- [ ] Image and URL support in idea cards
- [ ] AI Analysis for moodboards
- [ ] Garbage collection for orphaned images
- [ ] Cloud sync across devices
