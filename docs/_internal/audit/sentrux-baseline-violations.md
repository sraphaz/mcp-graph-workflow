# Sentrux Baseline — mcp-graph v13.4.0

**Date:** 2026-05-08  
**Sentrux:** v0.5.7  
**Command:** `sentrux gate --save .`  
**Baseline file:** `.sentrux/baseline.json`

## Quality Signal

| Metric | Value |
|--------|-------|
| **quality_signal** | **0.4346** (4346 / 10000) |

## 5-Dimension Breakdown

| Dimension | Value | Notes |
|-----------|-------|-------|
| coupling_score | 0.1150 | Cross-module coupling ratio |
| cycle_count | 3 | Circular dependency cycles |
| god_file_count | 16 | Files with too many responsibilities |
| hotspot_count | 4 | High-churn + high-complexity files |
| complex_fn_count | 118 | Functions exceeding complexity threshold |

## Graph Stats

| Metric | Value |
|--------|-------|
| Files scanned | 3581 |
| Import edges | 7251 |
| Cross-module edges | 5485 |
| Call edges | 17316 |
| Inheritance edges | 63 |

## Observations

- **3 circular dependency cycles** — candidates for architectural review (separate PRD)
- **16 god files** — large files with broad responsibilities; top candidates in `src/core/` and `src/api/`
- **4 hotspots** — high-churn + high-complexity intersection; highest regression risk
- **118 complex functions** — exceed cyclomatic complexity threshold

## Next Steps (Task 0.2)

Run `sentrux gate .` scoped to the deletion zone:
- `tools/feature-depth/`
- `src/core/feature-depth/`

Confirm zero inbound import edges before any deletion. Refactor candidates from this scan → `docs/prd/_candidates/`.

---

## Rules Violations Catalog (Task 0.4)

**Date:** 2026-05-09
**Scan method:** grep-based (sentrux check returns 0 rules — TOML schema mismatch; deterministic grep used as authoritative fallback per §ADR-deterministic-first)
**Rules scanned:** `core-no-cli`, `provider-sdk-confinement`

### Summary

| Rule | Severity | Real violations | False positives | Total findings |
|------|----------|-----------------|-----------------|---------------|
| `core-no-cli` | error | 0 | 0 | 0 |
| `provider-sdk-confinement` | error | 0 | 3 | 3 |
| **Total** | | **0** | **3** | **3** |

### Rule: core-no-cli

Guard: `src/core/**` must not import from `src/cli/**`.

**Result: 0 violations — CLEAN.**

No files in `src/core/` import from `src/cli/`. Dependency direction is enforced.

### Rule: provider-sdk-confinement

Guard: `openai`, `@anthropic-ai/sdk`, `@google/genai` imports must be confined to `src/core/llm/adapters/`.

**Findings: 3 (all false positives)**

| # | File | Line | Finding | Disposition |
|---|------|------|---------|-------------|
| 1 | `src/tests/entity-cross-source-integration.test.ts` | 382 | `import { generateId } from "@anthropic-ai/sdk"` inside a template literal (test fixture text, not a real import) | accepted out of scope — grep false positive; string inside template literal |
| 2 | `src/tests/seam-audit.test.ts` | 57 | `import OpenAI from "openai"` inside a JS array of strings used to test `extractImportSpecifiers` | accepted out of scope — test fixture using import syntax as string data |
| 3 | `src/tests/seam-audit.test.ts` | 71 | `import OpenAI from "openai"` inside a JS array of strings used to test `auditFile` | accepted out of scope — test fixture using import syntax as string data |

**Conclusion:** Zero real violations. All 3 findings are template-literal or string-array test fixtures where import syntax appears as data, not as actual module resolution. The rule is satisfied.

### Sentrux TOML Schema Gap

`sentrux check .` reports "0 rules checked" — our `rules.toml` uses keys (`guard`, `forbidden`, `allowed_zone`, `forbidden_imports`) that Sentrux v0.5.7 does not recognize. Owner-PRD candidate: `docs/prd/_candidates/sentrux-toml-schema-alignment.md`.

**Action:** When Sentrux documents its TOML schema, update `rules.toml` to match. Until then, grep-based CI gate (`scripts/check-layer-rules.sh`) is the enforcement mechanism.

