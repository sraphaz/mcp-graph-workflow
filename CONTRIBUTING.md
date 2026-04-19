# Contributing to mcp-graph

Thank you for your interest in contributing! This guide will help you get started.

## Licensing (read this first)

mcp-graph v10.0.0+ is licensed under **AGPL-3.0-or-later** (see [`LICENSE`](LICENSE))
with a **dual-commercial-licensing** channel for organizations that cannot
adopt AGPL (see [`COMMERCIAL.md`](COMMERCIAL.md)).

To sustain that dual model, **every contribution must satisfy two requirements**:

1. **Contributor License Agreement** — sign [`CLA.md`](CLA.md) before your
   first pull request is merged. The CLA grants the copyright holder the
   right to re-license your contribution under the commercial tier. A GitHub
   Action (cla-assistant) will comment on your PR with a signing link; just
   comment the exact phrase it asks for and you are signed.
2. **Developer Certificate of Origin sign-off** — every commit must include
   a `Signed-off-by:` trailer. The simplest way is `git commit -s`. The
   commit-msg hook + CI will reject commits lacking the trailer. The DCO is
   enforced as a proxy until the CLA is signed, and as a belt-and-braces
   check afterwards.

If you are contributing on behalf of an employer, ensure you have authority
to sign the CLA on their behalf, or have an authorized representative co-sign
(see [`CLA.md`](CLA.md) §4.3).

By submitting a pull request, you confirm that your contribution is your
original work (or that you have the right to submit it) and that it is
licensed under AGPL-3.0-or-later with the re-licensing grant described in
`CLA.md`.

## Getting Started

```bash
# Fork and clone the repository
git clone https://github.com/<your-username>/mcp-graph-workflow.git
cd mcp-graph-workflow

# Install dependencies
npm ci

# Install dashboard dependencies
cd src/web/dashboard && npm ci && cd ../../..

# Build
npm run build

# Run tests
npm test
```

## Development Workflow

### TDD is mandatory

All new code follows Test-Driven Development: **Red -> Green -> Refactor**.

1. Write a failing test that describes the expected behavior
2. Write the minimum code to make the test pass
3. Refactor while keeping tests green

### Branch Naming

- `feat/short-description` — new features
- `fix/short-description` — bug fixes
- `docs/short-description` — documentation changes
- `refactor/short-description` — code refactoring
- `test/short-description` — test improvements

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) **and**
include a DCO `Signed-off-by:` trailer on every commit (enforced by
commitlint + CI). Use `git commit -s` to append the trailer automatically
from your `user.name` and `user.email`.

```
feat: add velocity calculation for sprint metrics

Signed-off-by: Jane Contributor <jane@example.com>
```

Examples of valid subjects:

```
feat: add velocity calculation for sprint metrics
fix: resolve transitive blocker detection loop
docs: update architecture guide with search module
test: add integration tests for PRD import pipeline
```

## Code Standards

- **Strict TypeScript** — `strict: true`, no `any` types, explicit return types on public functions
- **ESM only** — use `.js` extension in relative imports
- **Zod v4** — `import { z } from 'zod/v4'` (never `'zod'`)
- **Kebab-case files** — `graph-store.ts`, not `graphStore.ts`
- **PascalCase types** — `GraphNode`, `NodeStatus`
- **camelCase functions** — `findNextTask()`, `buildTaskContext()`
- **Typed errors** — use error classes from `src/core/utils/errors.ts`, never throw raw strings
- **Logger** — use `src/core/utils/logger.ts`, never `console.log`
- **Named exports only** — no default exports

See [CLAUDE.md](CLAUDE.md) for the full conventions reference.

## Testing

```bash
npm test               # Unit + integration tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
npm run test:e2e       # Playwright browser tests
npm run test:bench     # Performance benchmarks
npm run test:all       # Unit + E2E combined
```

### Test Guidelines

- **Vitest** with arrange-act-assert structure
- Test files in `src/tests/`, named `*.test.ts`
- Use factory functions for minimal valid test objects
- Prefer in-memory SQLite (`:memory:`) over file I/O
- Mock only external boundaries you don't control
- Descriptive test names: `it('should return next unblocked task sorted by priority')`

## Submitting a PR

1. Ensure all checks pass locally:
   ```bash
   npm run build && npm run lint && npm test
   ```
2. If you added new `.ts`/`.tsx` files under `src/`, run the SPDX header
   stamper so the `license-headers` CI check stays green:
   ```bash
   node scripts/license/headers.mjs --apply
   ```
3. Make sure every commit is signed off (`git commit -s`). If you forgot,
   `git rebase -i --signoff <base>` will add the trailer to past commits.
4. Push your branch and open a PR against `master`.
5. Fill out the [PR template](.github/PULL_REQUEST_TEMPLATE.md), including
   the Licensing checklist.
6. Sign the CLA via the bot comment on your PR (first-time contributors
   only).
7. Wait for CI (build, tests, license-headers, CLA, dep scan) to pass and a
   maintainer review.

## Adding Skills & Instructions

Skills live in `copilot-ecosystem/`. Each skill is a directory with a `SKILL.md` file:

1. Create a directory under the appropriate discipline in `copilot-ecosystem/skills/`
2. Add a `SKILL.md` with valid YAML frontmatter (`name`, `description`, `category`, `risk`)
3. Include `disable-model-invocation: true` in frontmatter to prevent auto-loading
4. Submit a PR with the skill

For instructions, create `.instructions.md` files in `.github/instructions/` with `applyTo` frontmatter targeting the correct file patterns.

## Code of Conduct

This project follows a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.
