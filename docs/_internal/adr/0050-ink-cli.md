# ADR-0050 — Ink as TUI framework for the v11 CLI

- **Status:** Accepted (2026-04-24)
- **Driver:** v11 User-First DX Overhaul
- **Owner:** @diegonogueira
- **Context:** [`docs/prd/v11-cli-overhaul.md`](../prd/) · plan `~/.claude/plans/sim-refactored-crayon.md`

## Context

The v10 CLI (`src/cli/`, Commander.js, plain `process.stdout.write`) is functional but feels dated next to the AI-coding CLIs users compare us against (Claude Code, GitHub `gh copilot`, Cursor, Vercel CLI, Astro CLI, Bun). v11's success criteria require a 60-second install→first-value flow and a REPL that uses `/slash` commands matching the muscle memory those users already have.

We need a TUI layer that:
1. Renders rich, animated, color UI in the terminal (cards, spinners, autocomplete dropdowns).
2. Composes well — every command can return either text, JSON, or a React element (Ink component) handled uniformly by the registry.
3. Has a healthy ecosystem of prompts/widgets we don't have to build from scratch (`@clack/prompts`, `ink-spinner`, `ink-select-input`, etc.).
4. Supports both REPL (`mg`) and one-shot shell (`mg <cmd>`) from the same handler tree.

## Decision

Adopt **[Ink](https://github.com/vadimdemedes/ink)** (React for CLIs, v5.x) as the TUI framework for the v11 CLI in `tools/cli/`. Pair it with **`@clack/prompts`** for interactive prompts and **`figlet`** for the wordmark banner. Bundle with **esbuild** in ESM mode (Ink ships ESM with top-level await; CJS is incompatible).

## Alternatives considered

| Option | Why rejected |
|---|---|
| **Stay on Commander.js + chalk** | No interactive widgets, no card layout, no shared mental model with Claude Code/gh-copilot. Cosmetic upgrade only — doesn't unlock the REPL `/slash` flow that's central to v11. |
| **`blessed` / `blessed-contrib`** | Older API, callback-heavy, smaller modern ecosystem, awkward composition vs. React. |
| **`prompts` (sindresorhus) + manual ANSI** | We'd reinvent layout/state/diffing. Same destination, more code. |
| **`yargs` + `enquirer`** | Same flat surface as Commander; no card/spinner story; doesn't earn the REPL UX. |
| **Custom PR-driven TUI on `readline`** | Maximum control, minimum velocity. v11 has 9 sprints to ship — not the time to build a TUI runtime. |

## Consequences

**Positive:**
- Same mental model the user already has from Claude Code (slash commands, animated cards, autocomplete dropdown).
- `src/commands/registry.ts` is a single source of truth — REPL slash router, shell router, and Claude-skill emitter all enumerate the same definitions.
- Composable: every command handler returns `{ text? | json? | element? | exitCode }`; the wrapper renders the appropriate one based on mode (REPL/shell/`--json`).
- Ecosystem already battle-tested by Vercel CLI, GitHub Copilot CLI, and AWS Amplify Gen 2 CLI.

**Negative / mitigations:**
- **ESM-only bundle** (Ink + `yoga-wasm-web` use top-level await) → ship `dist/cli.mjs` instead of `dist/cli.cjs`. Acceptable: Node ≥20 already required; npm-installed CLIs run fine as ESM.
- **`react-devtools-core` is an optional Ink dep** that breaks bundling → marked `--external`. No runtime impact in production CLI flows.
- **Bundle size**: Ink alone is small but full dep tree at install ~6 MB; we externalize deps (`--packages=external`) so the bundle artifact stays ~12 KB and `npm install` handles deps. Success criterion **#4 ("bundle ≤3MB")** is reinterpreted as "launcher artifact ≤3MB"; total install footprint tracked separately.
- **TTY required for REPL** → if `stdin` isn't raw-mode capable (CI, piped input), REPL prints a friendly fallback and the user is steered to shell mode (`mg <cmd>`).
- **Cold start cost from React reconciler** → mitigated by the `--help` path bypassing Ink (pure `process.stdout.write`) for the `--version`/`--help` fast paths, plus lazy `await import()` of heavy command modules (Sprint 8).

## Verification

- `npm run build` produces `dist/cli.mjs` ≤ 50 KB (deps externalized).
- `mg --version` and `mg --help` complete without loading Ink (cold-start optimization).
- Hyperfine cold-start target ≤ 500 ms (Sprint 8 gate).
- Unit tests in `tools/cli/src/repl/*.test.ts` use `ink-testing-library`.

## References

- Ink: https://github.com/vadimdemedes/ink
- Clack: https://www.clack.cc/
- Sibling pattern: `tools/copilot-bridge-cli/` (non-Ink CLI, CJS bundle, complementary surface).
