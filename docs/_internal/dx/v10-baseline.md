# v11 Alpha — DX Baselines

Captured **2026-04-25** against `tools/cli/` v11.0.0-alpha.1 on a single development machine. Numbers will vary by hardware; the targets in `~/.claude/plans/sim-refactored-crayon.md` come from the v11 success criteria.

## Cold-start

`tools/cli/scripts/bench-coldstart.mjs` measures wall-clock from process spawn to exit using `process.hrtime.bigint()`. Each run is an independent `node dist/cli.mjs <cmd>` invocation; one warm-up run is discarded.

### `mg --version` (10 runs)

| Metric | v11.0.0-alpha.1 | Target | Status |
|---|---:|---:|:---:|
| min | 89.3 ms | — | — |
| median | 90.3 ms | ≤ 500 ms | **PASS** ✓ |
| mean | 90.4 ms | — | — |
| p95 | 91.8 ms | — | — |
| max | 91.8 ms | — | — |

### `mg --help` (10 runs)

| Metric | v11.0.0-alpha.1 | Target | Status |
|---|---:|---:|:---:|
| median | 90.4 ms | ≤ 500 ms | **PASS** ✓ |
| p95 | 111.3 ms | — | — |
| max | 111.3 ms | — | — |

### 30-run baseline (`benchmarks/baseline-cli-v11-alpha.json`)

| Metric | Value |
|---|---:|
| median | 90.9 ms |
| p95 | 102.7 ms |
| pass | true |

**Why it's already this fast:**
- `--version` / `--help` paths bypass Ink reconciler entirely (pure `process.stdout.write`).
- esbuild ESM bundle (60 KB, deps externalized) loads only what's needed.
- Heavy command modules (`add`, `list`, `next`, `status`, …) are `await import()`-loaded lazily, so they don't count toward `--version` start.

Target ≤ 500 ms is met **5×** at alpha. CI gate (Sprint 8.6) will fail on regressions > 15%.

## Bundle size

| Artifact | Size |
|---|---:|
| `dist/cli.mjs` (esbuild ESM, minified, deps external) | 60.7 KB |
| `npm pack` tarball | 19.8 KB |
| Unpacked install footprint (no node_modules) | 64.0 KB |

Target ≤ 3 MB CJS is reinterpreted (per ADR-0050) as "launcher artifact ≤ 3 MB" — comfortably met. The total install footprint including node_modules dependencies (Ink, React, figlet, @clack/prompts, etc.) is governed by `package.json` dependency selection and tracked separately.

## Memory baseline

Deferred to Sprint 8 (post-Sprint 7 lifecycle landing). Will measure heap snapshot after `mg init && mg add task && mg next` against the 80 MB target.

## CLI surface coverage

15 commands registered, all with REPL slash + shell parity, all auto-instrumented for tracing:

| Category | Commands |
|---|---|
| meta | `help`, `exit`, `version` |
| lifecycle | `init`, `demo`, `add`, `start`, `finish`, `next`, `list` |
| auth | `login` |
| ops | `ui`, `status`, `config`, `hooks`, `log` |
| internal (hidden from --help) | `hook` (dispatcher) |

Per ADR-0053 the v11 surface is locked at this list; future additions require an ADR or registry-entry justification in the PR description.

## Reproduction

```bash
cd tools/cli
npm run build                                                  # esbuild → dist/cli.mjs
node scripts/bench-coldstart.mjs                               # 10-run --version
node scripts/bench-coldstart.mjs --cmd help --runs 10
node scripts/bench-coldstart.mjs --runs 30 --json > benchmarks/baseline-cli-v11-alpha.json
npm pack --dry-run                                             # report tarball + unpacked sizes
```

## Source

- `tools/cli/scripts/bench-coldstart.mjs` — benchmark runner
- `benchmarks/baseline-cli-v11-alpha.json` — persisted 30-run sample
- `../adr/0050-ink-cli.md` — explains why ESM + bundle-size redefinition
- `../adr/0053-cli-surface.md` — explains the 12-core (+3 ops) Pareto cut

---

## Main Package — post-T2.4 (tsup) baseline

Captured **2026-04-25** after T2.4 (build pipeline migrated from `tsc`
to `tsup`) and T2.5 (lazy `await import()` for the 49 tool modules).
Numbers reflect a full `npm run build` (tsup + copy-assets + docs
manifest + dashboard build + dashboard copy).

### `npm pack` output

| Metric | v10.1.0 (post-T2.4) | Target | Status |
|---|---:|---:|:---:|
| Tarball (gzipped) | **2.9 MB** | ≤ 4 MB | **PASS** ✓ |
| Unpacked | 12.4 MB | — | — |
| Total files | 218 | — | — |

### Bin entry sizes (tsup-bundled, sourcemap=off)

| Entry | Size |
|---|---:|
| `dist/cli/index.js` | 2.4 MB |
| `dist/mcp/stdio.js` | 2.4 MB |
| `dist/mcp/server.js` | 2.3 MB |
| `dist/mcp/daemon-entry.js` | 2.0 MB |
| `dist/mcp/stdio-proxy.js` | 3.7 KB |

Externals kept out of the bundle: `better-sqlite3` (native binding),
`playwright` / `@playwright/*` (browser binaries),
`web-tree-sitter` (WASM init), every `tree-sitter-*` parser,
`@modelcontextprotocol/sdk` (peer-style), `onnxruntime-node`,
`intelephense`, `typescript-language-server`. See `tsup.config.ts`.

### Largest individual files in tarball

| File | Size |
|---|---:|
| `dist/mcp/stdio.js` | 2.4 MB |
| `dist/cli/index.js` | 2.4 MB |
| `dist/mcp/server.js` | 2.3 MB |
| `dist/mcp/daemon-entry.js` | 2.0 MB |
| `dist/web/dashboard/dist/assets/runtime-guards-…` | 304 KB |
| `dist/web/dashboard/dist/assets/index-…` | 264 KB |
| `dist/web/dashboard/dist/assets/gitnexus-tab-…` | 213 KB |
| `dist/core/translation/ucr/construct-seed-data.json` | 210 KB |

### Production dependency tree (`npm ls --omit=dev --depth=0`)

29 direct production deps. Notable groups:

- **Native:** `better-sqlite3@12.6.2`, twelve `tree-sitter-*` parsers
  (c, c-sharp, cpp, go, java, kotlin, lua, php, python, ruby, rust,
  swift).
- **Browser:** `playwright@1.59.1`.
- **MCP / SDK:** `@modelcontextprotocol/sdk@1.29.0`, peer copy of
  `@mcp-graph-workflow/mcp-graph@9.4.0` (self-pinning intentional —
  used for the legacy parent-runtime contract until tools/cli takes
  over the user-facing surface, see T1.0 follow-up).
- **Document parsers:** `mammoth`, `pdf-parse`, `cheerio`,
  `fast-xml-parser`.
- **HTTP / CLI:** `express@5.2.1`, `commander@14.0.3`, `multer`,
  `update-notifier`, `lru-cache`, `adm-zip`.
- **LSP optional:** `intelephense`, `typescript-language-server`,
  `typescript@6.0.2`.

### Reproduction

```bash
npm run build       # tsup + copy-assets + dashboard + manifest
npm pack --dry-run  # report tarball + unpacked sizes + file list
npm ls --omit=dev --depth=0
```

### Drift signals to watch

- **Tarball > 4 MB** — likely a regression to `sourcemap: true` in
  `tsup.config.ts`, or a forgotten `external` entry pulling a native
  module into the bundle. First check for `*.js.map` in pack output,
  then re-verify externals against the table above.
- **File count > 230** — `dist/web/dashboard/dist/assets/` gained
  chunks or `copy-assets` started emitting more JSON. Inspect the
  diff with the largest-files table.
- **New direct production dep** — must be classified for both the
  `tsup.config.ts` externals list AND the `npm pack` budget.
  Native modules MUST be added as externals.
