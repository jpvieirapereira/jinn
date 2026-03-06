# Contributing to Jimmy

Thanks for your interest in contributing. This guide covers the basics.

## Development Setup

1. Fork and clone the repository.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Build all packages:
   ```bash
   pnpm build
   ```
4. Start development mode:
   ```bash
   pnpm dev
   ```

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

- `packages/jimmy` -- Core gateway daemon and CLI.
- `packages/web` -- Web dashboard frontend.

## Questions?

Open an issue on GitHub if you have questions or run into problems.
