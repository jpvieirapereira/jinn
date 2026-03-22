# Contributing to Jinn

Thanks for your interest in contributing. This guide covers the basics.

## Prerequisites

- Node.js 22 or later
- pnpm 10+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (`npm install -g @anthropic-ai/claude-code`)

## Development Setup

1. Fork and clone the repository.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Initialize Jinn (one-time — builds all packages and creates `~/.jinn`):
   ```bash
   pnpm setup
   ```
   This is safe to re-run; it skips files that already exist.
4. Start development mode:
   ```bash
   pnpm dev
   ```
   Then open [http://localhost:3000](http://localhost:3000). The Next.js dev
   server proxies API requests to the gateway on `:7777` automatically.

## Submitting Pull Requests

- Create a feature branch from `main`.
- Keep commits focused and descriptive.
- Run `pnpm typecheck` and `pnpm build` before submitting.
- Open a pull request against `main` with a clear description of your changes.

## Code Style

- TypeScript with strict mode enabled.
- ESM modules (no CommonJS).
- Tailwind CSS for styling in the web package.
- Follow existing patterns in the codebase.

## Project Layout

- `packages/jimmy` -- Core gateway daemon and CLI (package dir).
- `packages/web` -- Web dashboard frontend.

## Questions?

Open an issue on GitHub if you have questions or run into problems.
