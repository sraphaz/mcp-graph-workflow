# v13 Release Notes — Self-Hosting Régua + Auto-Merge Cycle

> Branch: `feat/v13-mcp-graph` → `master`
> Commits ahead of master: 138
> Test suite: 1,225 files / 11,853 passed / 13 skipped / 0 failed
> Harness: **A (86.5/100)** — Type 96% · Tests 51% · Docs 97% · Architecture 100%

---

## TL;DR

v13 closes two gaps in mcp-graph's self-hosting story:

1. **Régua de 9 fases** — every PRD now has a single boolean truth (`passedAll`) over the entire ANALYZE→LISTENING lifecycle, persisted as daily snapshots, and surfaced as a rolling success-rate trend.
2. **Auto-merge cycle (option A-fastforward)** — agent commits fast-forward locally, opens a single PR at batch close, and on regression: bisects → reverts → opens a self-mapped issue with bisect trail and lessons.

Plus a defensive layer: a hook that refuses to forward any prompt that would wipe `workflow-graph/`.

---

## Highlights

### Self-hosting régua (Sprints A → D)

- **`analyze(prd_lifecycle_health, nodeId=<epic>)`** — runs the 9-phase audit and now persists each result via migration v84.
- **`analyze(success_rate, window=10)`** — rolling pass-rate over the most recent N snapshots, scoped to an epic when `nodeId` is supplied.
- **`analyze(capacity_health)`** — PLAN-phase calibration delta vs velocity average (±10% tolerance window).
- **Listening sweep** — null-outcome decisions get flagged so closure rate feeds the régua.
- **Daemon autopilot wiring** — gated by `MCP_GRAPH_AUTONOMY=on`.

### Auto-merge cycle (Sprint E)

Four pure decision modules + one MCP surface:

| Module | Purpose |
|---|---|
| `src/core/autonomy/git-ops.ts` | `currentHead`, `commitsBetween`, `diffStat`, `revert`, `bisect` (deterministic linear walk), `currentBranch`, `isClean`. Mockable via injected `GitRunner`. |
| `src/core/autonomy/github-ops.ts` | `isGhAvailable`, `openIssue`, `createPr`, `prStatus`. Returns `GhOutcome<T>` so the cycle degrades gracefully when `gh` CLI is missing. |
| `src/core/autonomy/self-map.ts` | `classifyRegression` → `harness-drop` / `perf-regression` / `test-flake` / `build-failure` / `api-break` / `type-regression` / `unknown`. `buildIssueBody` renders the Markdown report. |
| `src/core/autonomy/auto-merge-orchestrator.ts` | `decideCloseBatch`, `decidePostMergeAction`, `shouldAttemptRevert` (anti-loop guard). |

MCP tool surface:

```bash
evolve --action=batch-status --commitsAhead=3 --testsGreen=true --harnessGrade=B
# → decision: close-batch (5 tasks done, tests green, harness B)

evolve --action=simulate-revert --sha=<sha>
# → diffStat + revert plan (dry-run, no I/O)

evolve --action=classify --ciOutput="<excerpt>" --harnessDelta=-7
# → bucket + Markdown issue body preview
```

State machine:

```
BATCH_OPEN ── all tasks done + tests green + harness ≥ B ──→ BATCH_CLOSED
                                                                   │
                                                       CI regresses │
                                                                   ▼
                                              POST_MERGE_REGRESSION
                                              bisect → revert → lessons
                                              → gh issue (auto-self-map)
```

### Destructive-DB guard (Sprint E.5)

A `task:pre-execute` hook (and matching `tool:pre-call` hook for `Bash`) refuses prompts or commands that would wipe `workflow-graph/`:

- `rm -rf workflow-graph` and family
- `DROP TABLE`/`DELETE FROM`/`TRUNCATE` on canonical mcp-graph tables
- `mcp-graph init --force/--reset/--wipe`
- PT-BR + EN destructive intent ("apague o banco do mcp-graph", "wipe the graph", …)

One-shot bypass: re-issue the request including the literal phrase `CONFIRMO APAGAR mcp-graph`.

### Dashboard surface (Sprint F)

New tab "Lifecycle Health" (beta) backed by 3 REST endpoints:

- `GET /api/v1/lifecycle-health/trend?window=10` — rolling success-rate
- `GET /api/v1/lifecycle-health/snapshots?epicId=&limit=` — recent persisted snapshots
- `GET /api/v1/lifecycle-health/:epicId` — compute fresh report (records snapshot side-effect)

Renders the rolling pass-rate plus the most recent snapshots with red/green pass indicators per epic — "audit self-hosting in 30 seconds".

### Sprint A cleanup

61 pre-existing red tests classified and resolved without functional regression:

- orphan-definition / traceability-matrix — drop deprecated `orphanRequirements` alias
- migration v83 — add `swarm_consensus_rounds` + relax `strategy NOT NULL`
- set-phase caveman flag persistence
- prd-indexer per-chunk `qualityScore` plumbing + scoring
- skill-files-exist contract realigned with shipped catalog
- local-first invariant — LLM provider adapters in opt-in allow-list
- onnxruntime-node moved out of `dependencies` (dynamic import only)

---

## Migrations

- **v83** — `swarm_consensus_rounds` table + `swarm_sessions.strategy` default
- **v84** — `lifecycle_health_snapshots(id, epic_id, snapshot_json, passed_all, taken_at, taken_on)` with `UNIQUE(epic_id, taken_on)` so same-day re-runs collapse

---

## Verification

```bash
npm run typecheck     # → 0 errors
npm test              # → 0 failed (11,853 passed / 13 skipped)
npm run harness:scan  # → A (86.5/100)
npm run dev           # → "Lifecycle Health" tab renders
```

---

## Out of scope (deliberate)

- **Sprint C — PRD débito EPIC 7-11**: T03/T07/T08 scope-cut markings deferred to a follow-up PR; access to the gitignored `docs/_internal/prd/*.md` is needed to grep them.
- **Sprint B lint baseline**: 56 pre-existing warnings stay as baseline; no new violations introduced this batch. Track via separate retroactive issue.
- Multi-repo automation, force-push to protected branches, auto-tag releases, Slack/email notifications.

---

## Risks + mitigations

- **`gh` not installed** → `github-ops` returns `unsupported`; lessons stay local-only. Documented as prerequisite.
- **Bisect cost on huge batches** → orchestrator caps at 20 commits before recommending `force-close` action.
- **Auto-revert loop** → `shouldAttemptRevert` blocks a second auto-revert that overlaps the prior auto-revert's files; second occurrence becomes a manual issue.

---

## Commits this branch (selected)

- `94b12eb` feat(dashboard): lifecycle-health tab — 9-phase régua audit surface
- `3c41bb3` feat(evolve): MCP tool surface for the auto-merge cycle
- `a2b9990` feat(autonomy): auto-merge foundations — git-ops, github-ops, self-map, orchestrator
- `86eb628` feat(analyze): success_rate mode + migration v84 lifecycle_health_snapshots
- `cc9dfb7` test(sprint-a): zero failing tests — drain 61 red-state escapes
- `3484223` feat(hooks): destructive-db-guard — block accidental wipe of mcp-graph store
- `63fe8fe` feat(autonomy): self-hosting régua + daemon autopilot wiring

Plus 131 commits backing EPIC 5-11 closures, swarm topologies (E1.T05-T09), token economy (E6.T01-T13), agents (E2.T07a-T07h), hooks 5.2, RAG E2-E3, proxy CLI, and architecture docs.
