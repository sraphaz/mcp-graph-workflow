
# ADR-0046 — `subtask_artifacts` store (5 artifact kinds, deduplicated by hash)

- **Status:** Accepted (retro-documenting code already shipped, 2026-04-25)
- **Driver:** v11 stateful subtask orchestration — the `assembleSiblingContext` mechanism (ADR-0047 sibling context, see also ADR-0048 token budget, ADR-0046 ready-to-prompt rendering) needs a typed, queryable store for what each subtask produces, separate from free-form text outputs.
- **Owner:** @diegonogueira
- **Supersedes/replaces:** the phantom citation `ADR-v11-001` referenced from `src/core/store/subtask-artifacts-store.ts` and `src/core/canonicalization/ts.ts` (no file under `docs/_internal/adr/` for the phantom; ADR numbering reconciled to `0049`).

## Context

In v10, subtask outputs were free-form text in the `nodes` table's `description` field. v11 introduces context-pollination — `start_task` injects prior-subtask context into the prompt of the next subtask in an epic — and that requires:

1. Outputs that are **typed** (so the renderer knows whether to fence as code, diff, or plain text).
2. Outputs that are **deduplicated** (so two subtasks emitting the same file content store one row, not two).
3. Outputs that are **canonicalized** (so equivalent code with different whitespace dedupes).
4. A **path-or-null** field so file artifacts can carry their target location.

A free-form text field in `nodes` cannot serve any of these without ad-hoc parsing.

## Decision

Introduce a `subtask_artifacts` table as the canonical artifact store. Schema:

```sql
CREATE TABLE subtask_artifacts (
  id            TEXT PRIMARY KEY,           -- UUID
  project_id    TEXT NOT NULL,              -- multi-project scoping
  subtask_id    TEXT NOT NULL,              -- foreign key to nodes(id)
  epic_id       TEXT NOT NULL,              -- denormalized for query speed
  kind          TEXT NOT NULL,              -- one of: diff | file | interface | decision | note
  path          TEXT,                       -- nullable; only file/interface/diff carry path
  content       TEXT NOT NULL,              -- canonicalized content
  content_hash  TEXT NOT NULL,              -- SHA-256 of canonicalized content
  created_at    TEXT NOT NULL,              -- ISO timestamp
  UNIQUE (project_id, subtask_id, kind, content_hash)
);
CREATE INDEX idx_subtask_artifacts_epic ON subtask_artifacts(epic_id, created_at);
CREATE INDEX idx_subtask_artifacts_subtask ON subtask_artifacts(subtask_id, kind);
```

### Five artifact kinds (`ArtifactKind`)

| Kind | Carries `path` | Purpose | Renderer choice (ADR-0046) |
|---|---|---|---|
| `file` | yes | Final canonical file content (whole file, post-edit state) | language-aware fence (`ts`, `py`, `go`, etc. by extension) |
| `diff` | optional | Patch-style change (unified diff) | `diff` fence |
| `interface` | yes | Type signature / API contract for downstream consumers | language fence (defaults to `ts`) |
| `decision` | no | Recorded design decision (why this approach) | plain markdown |
| `note` | no | Free-form annotation, comment, observation | plain markdown |

These five cover what `finish_task` (ADR-0047) needs to emit and what `assembleSiblingContext` (ADR-0047+0052) needs to render.

### Deduplication via canonical hash

`content_hash = SHA-256(canonicalize(content))` where `canonicalize` is per-kind:

- `file` and `interface` (TypeScript): AST-based canonicalization (strip comments, normalize whitespace, sort imports) per `src/core/canonicalization/ts.ts`. Falls back to text-canonicalization (LF, trailing-WS-trim) for non-TS extensions.
- `diff`: text-canonicalize the post-context lines only (ignore line numbers, file headers).
- `decision` and `note`: text-canonicalize (LF, trim).

The `UNIQUE (project_id, subtask_id, kind, content_hash)` constraint means a subtask can't deposit the same canonical content twice under the same kind. Idempotency for retry-safe writes.

### Reads — by subtask, by epic

Two query paths:

```sql
-- 1. All artifacts for one subtask (used by deposit-confirmation UI):
SELECT * FROM subtask_artifacts
  WHERE subtask_id = ? AND project_id = ?
  ORDER BY created_at;

-- 2. All artifacts for an epic, for sibling-context assembly:
SELECT * FROM subtask_artifacts
  WHERE epic_id = ? AND project_id = ?
  ORDER BY created_at;
```

The epic-level read feeds `assembleSiblingContext` (ADR-0047) which then topologically sorts and budgets.

## Alternatives considered

| Option | Why rejected |
|---|---|
| **Free-form text on `nodes.description`** (v10 status quo) | Cannot type, dedupe, or selectively render. Breaks under multi-artifact subtasks. |
| **Generic blob table** (any `kind`, any structure) | Loses validation; consumers must guess what each kind means. |
| **Filesystem persistence** (`.mcp-graph/artifacts/`) | Loses queryability. Hard to migrate, harder to multi-tenant. |
| **JSONL append-only log** | Cheap append but no dedupe, no PK, no relational queries. |

## Consequences

**Positive:**
- `assembleSiblingContext` can render typed artifacts cleanly.
- Idempotent writes via canonical hash.
- Multi-project isolation via `project_id` scope.
- Auditable lineage (every subtask output is row-addressable).

**Negative / mitigations:**
- **Schema migration cost** — v10 → v11 needs a one-shot migration emitting empty `subtask_artifacts` rows for existing nodes. Mitigation: migration script in `src/core/store/migrations/0049-subtask-artifacts.ts`.
- **Canonicalization is per-language** — only TS canonicalization is implemented today. Non-TS files fall back to text canonicalization. Mitigation: documented limit; expand per-language as adoption grows.
- **Five-kind closed set** — adding a 6th kind requires schema migration. Mitigation: deliberate discipline; current five cover all observed v11 use cases.

## Verification

- Schema present in `src/core/store/sqlite-store.ts` `migrations` array.
- `SubtaskArtifactsStore` class in `src/core/store/subtask-artifacts-store.ts` exposes typed deposit/read methods.
- Tests at `src/tests/store/subtask-artifacts.test.ts` cover dedupe, multi-project isolation, kind validation.
- `finish_task` writes via this store; `assembleSiblingContext` reads via this store.
- `rg -F 'ADR-v11-001' src/` returns zero hits after rename to `ADR-0046`.

## References

- `src/core/store/subtask-artifacts-store.ts` (implementation)
- `src/core/canonicalization/ts.ts` (TS canonicalization)
- `src/core/pipeline/finish-task.ts` (write path)
- `src/core/pipeline/assemble-sibling-context.ts` (read path; ADR-0047)
- ADR-0053 (CLI surface)
- ADR-0054 v2 (capability gate; this store is the substrate the gate operates on)
