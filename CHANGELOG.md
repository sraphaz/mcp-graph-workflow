# Changelog

## [12.0.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v11.0.0...mcp-graph-v12.0.0) (2026-04-26)


### ⚠ BREAKING CHANGES

* **cli:** `mg` bin removed. Use `mcp-graph` (single unified bin). MicroEmacs (`/usr/bin/mg`) on macOS no longer collides with our binary.
* **packaging:** `@mcp-graph-workflow/cli` is no longer published to npm as a separate package. Its source is bundled into `@mcp-graph-workflow/mcp-graph` so a single `npm install -g @mcp-graph-workflow/mcp-graph` brings everything.

### Features

* **cli:** unified single bin `mcp-graph` exposes all 24 subcommands (8 v10 server CLI + 16 lifecycle/ops verbs) ([#251](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/251), [#254](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/254)).
* **build:** cross-platform CI compat — `scripts/prepare-husky.mjs` and `scripts/build-lib.mjs` replace bash-only `|| true` patterns ([#256](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/256)).
* **packaging:** `tools/cli` workspace marked `private: true`; bundle copied into root `dist/v11-cli.mjs` during build.

### Documentation

* All public docs (README, QUICKSTART, GUIDE, CHEATSHEET) rewritten as single-narrative v12 — no more "v10 legacy + v11 opt-in" split.
* `docs/guides/v11-cli-surface-map.md` renamed to `docs/guides/cli-surface-map.md` with updated content.
* `docs/migration/mg-to-mcp-graph.md` and `docs/guides/set-phase-migration.md` removed (audience never materialized).
* PT-BR (Brazilian Portuguese) docs in `docs/getting-started/` ([#250](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/250)).

## [11.0.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v10.3.0...mcp-graph-v11.0.0) (2026-04-26)


### ⚠ BREAKING CHANGES

* **cli:** `mg` bin removed. The `@mcp-graph-workflow/cli` package no longer ships a binary. Migrate scripts/CI/aliases to `mcp-graph` per docs/migration/mg-to-mcp-graph.md.

### Features

* **cli:** unified mcp-graph bin — drop mg, ship v12.0 (PR 3/3) ([#254](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/254)) ([4d5fb1b](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/4d5fb1b41b250b4420d8ec186223b30d76ebf048))


### Bug Fixes

* **cli:** cross-platform CI compat + remove mg deprecation legacy ([#256](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/256)) ([712fbf6](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/712fbf6e4c61cf0da3a146952788adda1314bf4f))

## [10.3.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v10.2.0...mcp-graph-v10.3.0) (2026-04-26)


### Features

* **cli:** mg deprecation banner + docs sweep to mcp-graph (PR 2/3) ([#253](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/253)) ([983f082](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/983f0827c212856cc78af757f17e67133cdfeb2b))
* **cli:** unify v11 lifecycle commands under single mcp-graph bin (PR 1/3) ([#251](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/251)) ([d126be8](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/d126be8438d3777910d87e481a23f9817d5885d9))

## [10.2.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v10.1.3...mcp-graph-v10.2.0) (2026-04-25)


### Features

* **capability-gate:** per-task-type granularity (H12-tests v4 confirmed) ([#245](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/245)) ([e963a06](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/e963a06f4cd131e5236c4efaea555dd275858f4a))
* **skills:** v11 CLI surface migration banner — 10 lifecycle skills ([#243](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/243)) ([cff1a79](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/cff1a79634fd9532809ff2eb99a0fcebc945fcae))
* **skills:** v11 surface migration banner — Phase 2 (13 more skills) ([#246](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/246)) ([2d7cd97](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/2d7cd9749dc5995ad2d1e00672f738e13950b5c5))

## [10.1.3](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v10.1.2...mcp-graph-v10.1.3) (2026-04-25)


### Bug Fixes

* **cli:** correct repository URL casing for npm provenance attestation ([#241](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/241)) ([0eed1f8](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/0eed1f87aa92c64493170439b71b93d86af60ed2))

## [10.1.2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v10.1.1...mcp-graph-v10.1.2) (2026-04-25)


### Bug Fixes

* **cli:** update isFeatureEnabled test for ADR-0054 v2 defaults ([#239](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/239)) ([2eb5369](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/2eb5369fb1040b2607ebd58e30be4c079964568e))

## [10.1.1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v10.1.0...mcp-graph-v10.1.1) (2026-04-25)


### Bug Fixes

* **cli:** hide parent-package import paths from TS resolution ([#237](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/237)) ([5de1e87](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/5de1e875b9f499563f6396b2762d18beb93042df))

## [10.1.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v10.0.2...mcp-graph-v10.1.0) (2026-04-25)


### Features

* **cli:** v11 beta — Ink REPL, hooks-collapse, set-phase, tools/cli [@beta](https://github.com/beta) ([#234](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/234)) ([94d215a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/94d215a7d680637b8bbe907348f7e4c5a4520912))


### Bug Fixes

* **cli:** sync VERSION constant in meta.ts with package.json (11.0.0-beta.0) ([#236](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/236)) ([0fd472e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/0fd472e1d406eb9c97ec4fad255185b4eb7a6ad6))
* **commitlint:** exempt release-please v4 monorepo `chore: release master` (no scope) ([c947bad](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/c947bad1b43c7bd1be562496f144fc42f378e1a2))
