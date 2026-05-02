# Karpathy Baseline — built-in constitution

A curated bundle of behavioral guardrails that mcp-graph ships with, derived from
[Andrej Karpathy's observations on LLM coding pitfalls](https://x.com/karpathy/status/2015883857489522876).
The bundle complements existing DoR/DoD checks with structural enforcement of the one
principle the rest of the gate didn't cover: **Simplicity First**.

| Field | Value |
|---|---|
| Bundle name | `karpathy-baseline` |
| Principles | 4 |
| Upstream | https://github.com/andrej-karpathy/karpathy-skills |
| License | MIT (upstream) |

## Install

```bash
# Install the bundle into the active project's constitution
constitution install_builtin karpathy-baseline

# Verify
constitution list  # shows 4 principles under category "behavioral"
```

The action is **idempotent** — running `install_builtin` twice returns the existing
nodeId with `alreadyInstalled: true`. It does not overwrite a custom constitution;
each constitution node is independent.

## Activate enforcement

The bundle is observational by default (principles indexed in RAG, no DoD blocking).
To turn on the structural checks tied to the principles, apply a stricter preset:

```bash
preset apply strict-tdd   # or: enterprise
```

This activates `complexity_budget_pass` and `surgical_scope_pass` as part of the
DoD gate. They remain `recommended` severity (advisory) — they do not block
`finish_task`, but show up in the report and reduce the DoD score.

## Principle → check mapping

| # | Karpathy principle | mcp-graph anchor | Where it lives |
|---|---|---|---|
| 1 | **Think Before Coding** | DoR checks: `prd_quality_score`, `has_constraints`, `has_risks`, `has_acceptance_criteria` | `analyze(mode: "ready")` — gate ANALYZE → DESIGN |
| 2 | **Simplicity First** | DoD `complexity_budget_pass` (file > 200 LOC without subtasks, impl:test LOC ratio > 5:1) | `src/core/implementer/complexity-budget.ts` |
| 3 | **Surgical Changes** | DoD `surgical_scope_pass` (> 30% of modified files outside `metadata.declaredFiles`) | `src/core/implementer/surgical-scope.ts` |
| 4 | **Goal-Driven Execution** | DoD `has_acceptance_criteria` + `ac_quality_pass` (INVEST score), TDD-first via `start_task` / `finish_task` pipeline | `src/core/implementer/definition-of-done.ts`, `src/core/analyzer/ac-validator.ts` |

Principles 1 and 4 had near-complete coverage before this bundle and don't
introduce new checks — they're indexed for visibility in RAG / `axiom_gate`.
Principles 2 and 3 introduce structural DoD checks.

### `complexity_budget_pass` — heuristics

Two structural signals (no AST, no Code Intelligence dependency):

1. **File size cap** — any single file in `metadata.touchedFiles` exceeds 200 LOC
   *and* the node has no subtasks (was not decomposed). Suggests a unit that should
   have been split.
2. **Test ratio** — total implementation LOC ÷ total test LOC > 5:1. Suggests
   untested complexity. Skipped when no `testFiles` are declared (cannot infer
   without both signals).

Files that don't exist on disk are skipped gracefully (deleted, renamed,
future-tense paths). Empty inputs return a passing N/A result.

### `surgical_scope_pass` — heuristics

Compares two file lists on the node metadata:

- `metadata.declaredFiles` — the scope the task said it would touch
- `metadata.touchedFiles` — the files actually modified

Flags scope creep when **more than 30%** of the modified files fall outside the
declared list. Skips gracefully when either list is empty (avoids false positives
on tasks that didn't declare a scope up-front). Threshold is configurable per call.

## Related artifacts

- `.claude/rules/karpathy.md` — project-level rule with the 4 principles + project mapping
- `.agents/skills/karpathy-guidelines/` — invokable skill for on-demand guidance
- `karpathy-skills/` (in this repo) — upstream MIT reference, kept for traceability

If the bundle, the rule, and the skill ever drift, the bundle (this document)
is the source of truth — it ships with the product and the others reference it.

## Attribution

The four principles are derived from Andrej Karpathy's public observations
([X thread](https://x.com/karpathy/status/2015883857489522876)) and the
[andrej-karpathy/karpathy-skills](https://github.com/andrej-karpathy/karpathy-skills)
repository (MIT licensed).
