# Repository Guidelines

## Project Structure & Module Organization
This repository is currently in a bootstrap state: no application source, test suite, or asset directories are checked in yet. Keep the top level minimal while the project takes shape. As code is added, use a predictable layout such as `src/` for runtime code, `tests/` for automated tests, and `assets/` for static media. Place small project notes in `docs/` instead of mixing them with code.

## Build, Test, and Development Commands
There are no build, test, or local run commands committed in this directory yet. Add commands alongside the tooling that needs them and document them in the root manifest or README. If Node tooling is introduced, prefer explicit scripts such as `npm run dev`, `npm test`, and `npm run build` rather than undocumented ad hoc commands.

## Coding Style & Naming Conventions
Match the conventions of the language and formatter chosen for the project. Use 2-space indentation for JSON, YAML, and Markdown. Prefer descriptive directory names and keep filenames consistent within a module: `kebab-case` for docs and assets, and language-native patterns for code such as `camelCase` functions and `PascalCase` types or classes. Add a formatter and linter early and run them before opening a PR.

## Testing Guidelines
No test framework is configured yet. When tests are added, keep them close to the code they verify or place them under `tests/` with names that mirror the target module, for example `tests/player-state.test.ts`. New features should include automated coverage for core behavior and edge cases.

## Commit & Pull Request Guidelines
Recent history uses Conventional Commit prefixes such as `feat:`. Continue with `feat:`, `fix:`, `docs:`, `refactor:`, and `test:` followed by a short imperative summary. Pull requests should explain the change, note any setup or migration steps, link related issues, and include screenshots or terminal output when UI or CLI behavior changes.

## Configuration & Repository Hygiene
Do not commit secrets, local env files, or generated artifacts. Keep repository-specific config checked in, and document required environment variables in `.env.example` once configuration exists.
