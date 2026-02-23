# Contributing to Hatch

Thanks for your interest in contributing to Hatch! Here's how to get started.

## Getting Started

1. **Fork** the repository and clone your fork
2. **Install dependencies**: `pnpm install`
3. **Run the app**: `pnpm dev`
4. **Run tests**: `pnpm test`

## Development Setup

### Prerequisites

- Node.js 20+
- pnpm 9+
- Rust (stable) — required for the Tauri desktop shell

### Project Structure

```
hatch-sh/
├── apps/desktop/          # Tauri + React frontend
│   ├── src/               # React app (components, stores, pages)
│   └── src-tauri/         # Rust backend (keychain, shell, fs)
├── services/api/          # Hono API (Cloudflare Workers)
├── packages/ui/           # Shared UI components
└── testing/e2e/           # Playwright E2E tests
```

### Running Locally

```bash
# Desktop app (frontend + Tauri shell)
pnpm dev

# API server (separate terminal, optional)
pnpm dev:api

# Unit tests
pnpm test

# E2E tests
pnpm test:critical-flows

# Lint + type check
pnpm lint && pnpm typecheck
```

## Making Changes

1. Create a branch from `master`: `git checkout -b my-feature`
2. Make your changes
3. Run `pnpm lint && pnpm test` to verify nothing is broken
4. Commit with a clear message (e.g., `feat: add dark mode toggle`)
5. Push and open a pull request against `master`

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation only
- `chore:` — maintenance (deps, CI, scripts)
- `refactor:` — code change that neither fixes a bug nor adds a feature
- `test:` — adding or updating tests

## Pull Requests

- Keep PRs focused — one feature or fix per PR
- Include a description of what changed and why
- Make sure CI passes (lint, typecheck, tests)
- Screenshots or GIFs are welcome for UI changes

## Reporting Bugs

Open an [issue](https://github.com/serrrfirat/hatch-sh/issues) with:

- Steps to reproduce
- Expected vs actual behavior
- OS and app version

## Code Style

- TypeScript throughout (strict mode)
- React functional components with hooks
- Zustand for state management
- TailwindCSS for styling
- Vitest for unit tests, Playwright for E2E

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
