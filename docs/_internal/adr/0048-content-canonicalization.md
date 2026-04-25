
# ADR-0048 — Content canonicalization for stable artifact hashing

- **Status:** Accepted (retro-documenting code already shipped, 2026-04-25)
- **Driver:** ADR-0046 deduplicates `subtask_artifacts` by `content_hash`. Two semantically-identical TypeScript files (different whitespace, comment styles, import ordering) must produce the same hash — otherwise dedupe fails and idempotency breaks.
- **Owner:** @diegonogueira
- **Supersedes:** phantom citation `ADR-v11-002` referenced from `src/core/canonicalization/ts.ts` and `src/core/store/subtask-artifacts-store.ts`.

## Context

Subtask artifacts are deposited via `finish_task` (ADR-0046) and stored in `subtask_artifacts` (ADR-0046). The dedupe constraint `UNIQUE (project_id, subtask_id, kind, content_hash)` requires `content_hash` to be stable across superficial differences:

- Trailing whitespace
- LF vs CRLF line endings
- Comment-only differences
- Import order (alphabetical vs insertion-order)
- Blank-line padding

Without canonicalization, every retry of a subtask depositing the same code produces a new row, defeating idempotency.

## Decision

Apply per-kind canonicalization before computing `content_hash = SHA-256(canonicalize(kind, content))`.

### TypeScript canonicalization (kinds: `file`, `interface` with `.ts` / `.tsx` paths)

`src/core/canonicalization/ts.ts` provides `canonicalizeTypeScript(content)`:

1. **Try AST round-trip via `typescript` compiler API**: parse → print with stable formatter (consistent whitespace, sorted imports, comments stripped from the AST representation, semicolon insertion).
2. **Fallback to text canonicalization** if parse fails: LF normalization, trailing-whitespace strip, comment-block removal via regex.

The AST path catches semantically-equivalent rearrangements; the text fallback is a defensive degradation when input is invalid TS or partial code.

### Other kinds — text canonicalization

| Kind | Canonicalization |
|---|---|
| `file` (non-TS extensions) | LF normalization, trailing-WS strip |
| `diff` | Strip line numbers + file headers; preserve only `+`/`-`/context lines |
| `decision` | LF normalization, trailing-WS strip |
| `note` | LF normalization, trailing-WS strip |
| `interface` (non-TS) | Same as `file` |

### Hash function

`SHA-256` over UTF-8 bytes of the canonicalized string. 64-hex-char output. Stored as `content_hash` column.

### When canonicalization fails

If TS AST parse throws AND text-canonicalization succeeds, log a `WARN canonicalization.fallback{kind,reason}` event but proceed with text-canonical hash. The artifact still gets stored — dedupe just becomes weaker (only catches whitespace/EOL changes, not import-order changes).

## Alternatives considered

| Option | Why rejected |
|---|---|
| **No canonicalization** (raw byte hash) | Defeats dedupe entirely on TS code where formatters touch import order. |
| **Custom AST normalizer** (not via `typescript` package) | Reinvents the wheel; misses edge cases in modern TS syntax. |
| **Prettier-based canonicalization** | Adds a heavy dep; opinionated formatting differs from project convention. AST round-trip is lighter. |
| **Per-extension language-specific canonicalizers** (Go, Python, etc.) | Out of scope for v11; deferred until empirical demand. |

## Consequences

**Positive:**
- Idempotent deposits via `(subtask_id, kind, content_hash)` PK.
- TS-heavy codebases (this one) get strong dedupe.
- Non-TS still gets weak dedupe (whitespace/EOL).

**Negative / mitigations:**
- **AST round-trip is slow** (~5-50ms per file) — acceptable on the deposit path (post-task) but not in a hot loop. Mitigation: only called by `finish_task`, never by `start_task`'s read path.
- **Per-language scope creep** — if Go/Python/Rust subtasks become common, language-specific canonicalizers will be needed. Mitigation: document the limit; deferred.
- **Comment loss in TS canonicalization** — by design (comments don't affect semantics) but means a "decision" embedded as a comment block in code is stripped. Mitigation: capture decisions as `kind: "decision"` artifacts, not as inline comments.

## Verification

- `src/core/canonicalization/ts.ts` exports `canonicalizeTypeScript`.
- Tests at `src/tests/canonicalization/ts.test.ts` cover: import order, whitespace differences, comment differences, malformed input fallback.
- `src/tests/store/subtask-artifacts.test.ts` covers dedupe end-to-end via canonicalization.
- `rg -F 'ADR-v11-002' src/` returns zero hits after rename to `ADR-0048`.

## References

- `src/core/canonicalization/ts.ts`
- `src/core/store/subtask-artifacts-store.ts`
- ADR-0046 (`subtask_artifacts` store — relies on this hash)
- ADR-0046 (finish_task artifact persistence — calls this canonicalization)
