# Hatch.sh

Your ideas, hatched and shipped.

## What is Hatch.sh?

Hatch.sh is your hatching centre for turning ideas into shipped products. Describe what you want to build, watch AI bring it to life in real-time, iterate until it's perfect, and deploy with one click.

## Features

- **AI-Powered Building**: Describe your idea in plain language and watch AI build it for you (supports Claude Code, Cursor, and OpenCode)
- **Live Preview**: See your product take shape in real-time as you iterate
- **Idea Maze**: Explore and refine your concept with AI-guided brainstorming
- **Superdesign Integration**: Browse the community's largest AI design prompt library directly in the app
- **Skills Marketplace**: Discover and install Claude Code skills to extend your AI capabilities
- **One-Click Deploy**: Ship your product to production instantly
- **Workspaces**: Run multiple ideas in parallel without conflicts

## Core Features

### Superdesign Integration

Hatch.sh embeds [Superdesign](https://app.superdesign.dev) directly into the desktop app, giving you access to the community's largest design prompt library without leaving your workflow.

**What is Superdesign?**

[Superdesign](https://www.superdesign.dev/) is an open-source AI design agent that generates UI mockups, components, and wireframes from natural language prompts. The [Superdesign Prompt Library](https://app.superdesign.dev/library) is the biggest community-driven collection of design prompts covering:

- **Styles**: Visual design patterns and aesthetics
- **Animations**: Motion design prompts and transitions
- **UI Components**: Reusable interface elements
- **Wireframes**: Low-fidelity layouts for rapid iteration
- **Product Mockups**: Complete screen designs

**Why it's integrated:**

By embedding Superdesign's prompt library in Hatch.sh, you can:

- Browse and discover design prompts while building your product
- Find inspiration for UI patterns and visual styles
- Copy prompts directly into your AI coding workflow
- Build and share design prompts with your team
- Access community contributions without context-switching

**How it works:**

The Design tab in Hatch.sh opens an embedded view of Superdesign's prompt library. The webview is cached for instant switching between tabs—no reload required when navigating back and forth. Built-in navigation controls let you browse the library seamlessly.

Superdesign works with any coding agent (Claude Code, Cursor, Windsurf, VS Code) and stores designs locally in a `.superdesign/` folder—your designs stay on your machine.

### Idea Maze

The Idea Maze is a visual brainstorming canvas that helps you explore, organize, and refine your concepts with AI assistance before you start building.

**Canvas-Based Ideation:**

- Create idea nodes by double-clicking anywhere on the canvas
- Drag and drop to organize your thoughts spatially
- Connect related ideas with relationship lines
- Paste text or images directly onto the canvas
- Support for multiple moodboards to separate different projects

**Relationship Types:**

Ideas can be connected with meaningful relationships:
- **Related**: Concepts that share common themes
- **Depends-on**: Prerequisites or foundational ideas
- **Contradicts**: Conflicting approaches to explore
- **Extends**: Ideas that build upon others
- **Alternative**: Different solutions to the same problem

**AI-Powered Features:**

The Idea Maze integrates with Claude Code to provide intelligent assistance:

1. **Find Connections**: AI analyzes all your ideas and suggests meaningful relationships you might have missed. Each suggestion includes a confidence score and reasoning.

2. **Generate Ideas**: Select one or more ideas and let AI suggest related concepts—extensions, alternatives, prerequisites, implications, or adjacent possibilities.

3. **Critique Ideas**: Get a devil's advocate analysis from multiple perspectives (Skeptic, Pessimist, Competitor, User, Maintainer) to identify gaps, edge cases, and blind spots.

**Keyboard Shortcuts:**
- `N`: Create new node
- `C`: Toggle connect mode
- `V`: Select mode
- `H`: Pan mode
- `Cmd+A`: Select all
- `Cmd+D`: Duplicate
- `Delete`: Remove selection

**Local-First Storage:**

All your moodboards are stored locally on your machine (`~/.local/share/sh.hatch.desktop/idea-maze/`). Your ideas never leave your computer unless you choose to export them.

### Skills Marketplace

The Skills Marketplace lets you discover and install Claude Code skills to extend what your AI agent can do.

**What are Skills?**

Skills are reusable prompts and capabilities that teach Claude Code new tricks—from writing commit messages in a specific style to generating code following particular patterns. Think of them as plugins for your AI assistant.

**Browsing Skills:**

- Search semantically across 60,000+ skills
- Filter by category (development, writing, analysis, etc.)
- View skill details, author, and GitHub stars
- One-click installation to your local or global skills folder

**Data Sources:**

The marketplace aggregates skills from multiple sources:
- [aitmpl.com](https://www.aitmpl.com) (AI Templates)
- [SkillsMP](https://skillsmp.com)
- GitHub repositories with `SKILL.md` files

**Installation Options:**

- **Local**: Install to `.claude/skills/` in your current project
- **Global**: Install to `~/.claude/skills/` for use across all projects

**Ask Agent:**

Not sure which skills would help? The "Ask Agent" feature analyzes your codebase and suggests relevant skills based on the technologies and patterns you're using.

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

## Desktop App

The desktop app is built with Tauri and provides a full IDE experience for building with AI.

### Features

- **BYOA Mode (Bring Your Own Agent)**: Connect your preferred AI coding agent (Claude Code, Cursor, or OpenCode)
- **GitHub Integration**: OAuth device flow authentication for seamless GitHub access
- **Repository Management**: Clone, create, and manage Git repositories
- **Workspaces**: Isolated branches for parallel agent work without conflicts
- **Project Tree**: Full file explorer with support for navigating your codebase
- **Editor with Tabs**: Open multiple files and diffs in a tabbed interface
- **Diff Viewer**: Side-by-side diff visualization with syntax highlighting for reviewing changes
- **Git Operations**: Stage, commit, push, and create pull requests directly from the app
- **Live Preview**: Real-time preview of your web application as you build

### Prerequisites

- Node.js 18+
- Rust (for Tauri native backend)
- pnpm

### Running the Desktop App

```bash
cd apps/desktop
pnpm tauri dev
```

### Building for Distribution

```bash
cd apps/desktop
pnpm tauri build
```

### GitHub OAuth Setup

Before repository features work, create a GitHub OAuth App:

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Set **Authorization callback URL** to `http://localhost` (device flow)
4. Copy your **Client ID** to `src-tauri/src/github.rs`

The app uses GitHub's Device Flow for authentication—no client secret required.

## Database

```bash
cd services/api

pnpm db:generate      # Generate migrations
pnpm db:migrate       # Run migrations
```

## License

MIT
