# CLAUDE.md — mcp-graph

## Overview

`mcp-graph` is a local-first CLI tool (TypeScript) that converts PRD text files into persistent execution graphs (SQLite), with an integrated knowledge store, RAG pipeline, and multi-agent integration mesh — enabling structured, token-efficient agentic workflows.

## Stack

- **Language:** TypeScript 5.x — strict mode, ESNext modules
- **Runtime:** Node.js ≥ 18 (no Docker, no external infra)
- **CLI:** Commander.js v14
- **Validation:** Zod v4 (`import { z } from 'zod/v4'`)
- **Testing:** Vitest v4
- **Search:** FTS5 + BM25 + TF-IDF (100% local)
- **Dashboard:** React 19 + Tailwind CSS + React Flow
- **Build:** `tsc` → `dist/` | Dev: `tsx`

## Commands

```bash
npm run build          # tsc → dist/
npm run dev            # tsx src/cli/index.ts
npm test               # vitest run
npm run test:watch     # vitest --watch
npm run test:e2e       # playwright browser tests
npm run test:coverage  # V8 coverage report
npm run test:bench     # performance benchmarks
npm run lint           # eslint
```

## Architecture

```
src/
  cli/               # Commander.js commands (6) — thin orchestration, NO business logic
  core/
    capture/         # web-capture, validate-runner, content-extractor
    doctor/          # doctor-checks, doctor-runner, doctor-types (environment validation)
    config/          # config-schema, config-loader
    context/         # compact, tiered, bm25-compressor, context-assembler, rag-context, token-estimator
    docs/            # stack-detector, mcp-context7-fetcher, docs-cache-store, docs-syncer
    events/          # event-bus, event-types (GraphEventBus)
    graph/           # graph-types, graph-indexes, mermaid-export
    importer/        # import-prd, prd-to-graph
    journey/         # journey-store (website journey mapping)
    insights/        # bottleneck-detector, metrics-calculator, skill-recommender
    integrations/    # integration-orchestrator, enriched-context, mcp-servers-config, mcp-deps-installer, tool-status
    parser/          # classify, extract, normalize, read-file, segment, file-reader, read-pdf, read-html
    planner/         # next-task, enhanced-next, decompose, dependency-chain, velocity, planning-report
    rag/             # embedding-store, rag-pipeline, memory-indexer, docs-indexer, capture-indexer, memory-rag-query, chunk-text, query-understanding, post-retrieval, enrichment-pipeline, citation-mapper, query-cache, rag-trace, source-contribution, benchmark-indexer
    search/          # fts-search, tfidf, tokenizer
    store/           # sqlite-store, migrations, knowledge-store
    utils/           # errors, fs, id, logger, time
  api/               # Express REST API — 30 routers, 130+ endpoints
  mcp/tools/         # MCP tool wrappers (54 active tools)
  schemas/           # Zod schemas (node, edge, graph, knowledge)
  web/dashboard/     # React + Tailwind + React Flow dashboard
```

## Capabilities

| Capability | Key Modules |
|------------|-------------|
| PRD Import | parser/, importer/ |
| 54 MCP Tools | mcp/tools/ |
| 19 REST API Routers | api/routes/ |
| Knowledge Store + RAG | store/knowledge-store, rag/ |
| Tiered Context Compression | context/ |
| Sprint Planning + Velocity | planner/ |
| Integration Mesh | integrations/, docs/, capture/ |

## Integration Agents

3 MCP agents coordinated by `IntegrationOrchestrator` via `GraphEventBus`:
**mcp-graph** (execution graph), **Context7** (library docs), **Playwright** (browser validation).
Native systems: **Code Intelligence** (code analysis), **Native Memories** (project knowledge).
See `src/core/integrations/` for implementation details.

## Non-Regression Rule

**MANDATORY — applies to every change, no exceptions.**

### Verification Gate (run ALL before delivering)

1. **Build** — `npm run build` must succeed. Compilation passing ≠ type check passing (ESM resolution, missing exports, bundler issues are caught here, not by `tsc --noEmit`).
2. **Type check** — `npm run typecheck` (or `tsc --noEmit`) must report zero errors.
3. **Test suite** — `npm test` must pass with zero failures. Zero tolerance for regressions.
4. **Linter** — `npm run lint` (if configured) must report no new violations.
5. **Smoke test** — if the project has a CLI or server, run it once (`npm run dev -- --help` or equivalent) and confirm it starts without crashing.

### Behavioral Guardrails

6. **Do not remove, rename, or change the signature** of any existing public function, type, or export unless the task explicitly requires it. If you must change a public API, find and update ALL callers/importers first.
7. **Do not remove or modify re-exports** (barrel `index.ts` files) without verifying no external module depends on them.
8. **Do not delete tests** unless the feature they cover is being intentionally removed.
9. **Do not change behavior of code you didn't intend to touch.** If a refactor, bugfix, or new feature inadvertently alters unrelated behavior, revert the unintended change.

### Schema & Data Integrity

10. **Schema changes must be backward-compatible** with existing persisted data (JSON files, SQLite rows, API contracts). If a field is removed or renamed, provide migration or handle both old and new format.
11. **Do not remove or downgrade dependencies** without verifying no module imports them. Adding deps requires explicit user request.

### Configuration Guard

12. **Do not relax strictness settings** — never change `strict: true` to `false`, never disable linter rules, never lower test coverage thresholds. If a strict check blocks your work, fix the code, don't weaken the check.

### If anything fails

13. **Stop and fix before proceeding.** Never deliver code that breaks existing functionality. Never skip a failing check with `--no-verify`, `@ts-ignore`, `// eslint-disable`, or equivalent without explicit user approval.

> The bar is simple: **after your change, everything that worked before must still work identically.**

## Testing & Quality Methodology

**MANDATORY — applies to all code production.**

- **TDD First** — Write failing test BEFORE implementation. No exceptions.
- **Test levels** — Unit (always), Integration (cross-module), E2E (user-facing), Browser (UI). Details in `.claude/rules/tests.md`.
- **Minimal mocks** — Factory functions for unit tests. Real instances for integration. Zero mocks for E2E.
- **Logger** — Every module uses project logger, never `console.log`. Structured fields (key=value).

### Harnessability Score

The project tracks **harnessability** as a composite agent-readiness metric across 7 dimensions:

| Dimension | Weight | What it measures |
|-----------|--------|-----------------|
| Type coverage | 25% | % of files without `any` usage |
| Test coverage | 25% | Structural module→test file match (not % lines) |
| Architecture fitness | 15% | 3 fitness functions: dependency direction, no cycles, barrel export integrity |
| Docs coverage | 15% | CLAUDE.md, README, rules/, docs/ presence |
| Naming clarity | 10% | Descriptive names (no generic data/result/temp/val) |
| Error handling | 5% | Typed errors, no swallowed catches, no console.error |
| Context density | 5% | JSDoc coverage on exported functions |

**Run:** `npm run harness:scan` or `analyze(mode: "harness_scan")` — score (0–100) and grade (A ≥85 / B ≥70 / C ≥55 / D <55).
**Help:** `help(topic: "harness")` — full reference with daily workflow per phase.
**Full guide:** `npm run harness:scan` — implementation in `src/core/harness/`
**Daily workflow:** Run `analyze(mode: "harness_scan")` at the start of each phase. `start_task` shows warnings if score < 70, `finish_task` detects regressions > 5pts.

## Critical Conventions

1. **ESM only** — always use `.js` extension in relative imports
2. **Zod v4** — `import { z } from 'zod/v4'` (never `'zod'`)
3. **Strict TS** — no `any`, explicit return types on public functions
4. **Kebab-case files** — `graph-store.ts`, not `graphStore.ts`
5. **PascalCase types** — `GraphNode`, `NodeStatus`
6. **camelCase functions** — `findNextTask()`, `buildTaskContext()`
7. **Typed errors** — use `src/core/utils/errors.ts`, never throw raw strings
8. **Logger** — use `src/core/utils/logger.ts`, never `console.log`
9. **Infer from Zod** — `z.infer<typeof Schema>` instead of duplicating types
10. **Tests** — TDD, arrange-act-assert, files in `src/tests/`

## Path-Specific Rules

Detailed rules per directory are in `.claude/rules/`:

| Rule File | Scope |
|---|---|
| `typescript.md` | `src/**/*.ts` — strict mode, ESM, Zod |
| `cli.md` | `src/cli/**/*.ts` — thin orchestration |
| `core.md` | `src/core/**/*.ts` — pure functions, typed errors |
| `schemas.md` | `src/schemas/**/*.ts` — Zod v4 patterns |
| `tests.md` | `tests/**/*.test.ts` — Vitest, arrange-act-assert |

## XP Anti-Vibe-Coding Workflow

This project follows an anti-vibe-coding methodology based on XP (Extreme Programming):

- **New projects**: Use `/xp-bootstrap` for the sequential workflow (Isolation → Foundation → TDD → Implementation → Optimization → Interface → Deploy)
- **Project setup**: Use `/project-scaffold` to auto-generate `.mcp.json`, `CLAUDE.md` template, and `.claude/rules/`
- **Continuous cycle**: Use `/dev-flow-orchestrator` for ongoing iterations (ANALYZE → DESIGN → PLAN → IMPLEMENT → VALIDATE → REVIEW → HANDOFF → LISTENING)
- **Graph sync**: Use `/track-with-mcp-graph` to keep the execution graph in sync with real work
- **Dev lifecycle**: See `src/core/pipeline/` for lifecycle implementation for the 8-phase cycle (ANALYZE → DESIGN → PLAN → IMPLEMENT → VALIDATE → REVIEW → HANDOFF → LISTENING)

Key principles:
1. **Build to Earning vs Learning** — Production code (Build to Earning) = full discipline, no shortcuts. Side projects (Build to Learning) = experimentation allowed. Know which mode you're in.
2. **Skeleton & Organs** — Dev defines architecture, AI implements. Never "create a SaaS" — define stack, services, domain first.
3. **Anti-one-shot** — Never use a single prompt to generate entire systems. Decompose into atomic tasks tracked in the graph.
4. **TDD enforced** — Tests before code. If AI suggests a feature without a test: REFUSE.
5. **Code detachment** — If the AI made a mistake, explain the error via prompt — never edit manually. Document error patterns in CLAUDE.md.
6. **CLAUDE.md as evolving spec** — Every error, pattern, or architectural decision must be documented to cumulatively train the agent.
7. **Graph visualization** — Use `export_mermaid` to visualize the execution graph in reviews, handoffs, and debugging.

See `src/core/pipeline/` for lifecycle implementation for the full methodology guide.

## Code Intelligence

Native code analysis engine at `src/core/code/` — symbol analysis, relationship tracking, impact analysis, FTS5 search, execution flow detection. Configure via `set_phase({codeIntelligence: "strict" | "advisory" | "off"})`. Use `help(topic: "code_intelligence")` for full reference.

## Tool Prerequisites & Enforcement

3 enforcement layers configured via `set_phase`: lifecycle mode, code intelligence mode, prerequisites mode. Each supports `strict` (blocks), `advisory` (warns), `off`. Use `help(topic: "prerequisites")` for detailed rules per phase. Full enforcement: `set_phase({ mode: "strict", codeIntelligence: "strict", prerequisites: "strict" })`

<!-- mcp-graph:start -->
## mcp-graph — mcp-graph-workflow

Este projeto usa **mcp-graph** para gestão de execução via grafo persistente (SQLite).
Dados armazenados em `workflow-graph/graph.db` (local, gitignored).

### ⚠️ Regra de Execução OBRIGATÓRIA

**O mcp-graph é a fonte de verdade ABSOLUTA. Nenhuma implementação acontece fora do grafo.**

1. **Node deve existir** — antes de escrever QUALQUER código, o node correspondente DEVE existir no grafo
2. **Fluxo obrigatório** — `start_task → [implementar com TDD] → finish_task` (pipeline v8.0) ou `next → context(compact) → context(rag) → [TDD] → analyze(implement_done) → update_status` (granular) — SEM EXCEÇÕES
3. **Epic = estrutura primeiro** — criar Epic + tasks filhas + edges ANTES de implementar
4. **Status tracking** — `update_status → in_progress` ANTES de codar, `→ done` APÓS completar
5. **Validação** — usar `validate` (action: `ac`) após cada task para checar critérios de aceitação
6. **Zero trabalho não-rastreado** — se não tem node no grafo, CRIAR PRIMEIRO

> **Sem node no grafo = sem código escrito.**

### Fluxo de trabalho OBRIGATÓRIO

**Pipeline v8.0 (recomendado — 2 calls):**
```
start_task → [implementar com TDD] → finish_task
```

**Granular (6 calls — disponível para controle fino):**
```
next → context(compact) → context(rag) → [implementar com TDD] → analyze(implement_done) → update_status
```

### Lifecycle (9 fases)

1. **ANALYZE** — Criar PRD, definir requisitos (`import_prd`, `add_node`)
2. **DESIGN** — Arquitetura, decisões técnicas (`add_node`, `edge`, `analyze`)
3. **PLAN** — Sprint planning, decomposição (`plan_sprint`, `analyze`, `sync_stack_docs`)
4. **IMPLEMENT** — TDD Red→Green→Refactor (`next`, `context`, `update_status`, `analyze` — modes: implement_done, tdd_check, progress)
5. **VALIDATE** — Testes E2E, critérios de aceitação (`validate`, `metrics`)
6. **REVIEW** — Code review, blast radius (`export`, `metrics`)
7. **HANDOFF** — PR, documentação, entrega (`export`, `snapshot`)
8. **DEPLOY** — CI pipeline, release, post-release validation (`export`, `snapshot`, `analyze`)
9. **LISTENING** — Feedback, novo ciclo (`add_node`, `import_prd`)

### Memory ≠ Estado Atual

Memory files são **snapshots point-in-time**, não estado live. Contagens de progresso ("X/Y done", "% complete") ficam stale rapidamente.

**Antes de planejar baseado em memories:**
1. Grep pelo arquivo/função — se existe com implementação real, o memory é stale
2. **Código vence memory** — se memory diz "X não existe" mas código mostra que sim, confiar no código
3. Contagens numéricas > 48h = possivelmente stale — verificar antes de usar

> **Nunca confiar em contagens de progresso de memories. Sempre verificar no código antes de planejar.**

> **Referências detalhadas on-demand:** Use `help` tool para consultar: `tools`, `analyze_modes`, `skills`, `cli`, `knowledge`, `workflow`, `gates`, `dod`, `dor`, `prerequisites`, `workflows`, `flow`, `quality_metrics`, `tdd`, `pipeline`, `antipatterns`, `harness`, `dream`, `siebel`, `davinci`, `translate`, `journey`, `teamtask`, `snapshot`, `graph_health`.
<!-- mcp-graph:end -->
