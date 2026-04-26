# ADR-0051 — CLI distribution strategy

- **Status:** Accepted (2026-04-24)
- **Driver:** v11 User-First DX Overhaul — 60-second install→first-value
- **Owner:** @diegonogueira

> **NOTE (2026-04-26):** O domínio `mcp-graph.dev` referenciado abaixo
> (em `https://mcp-graph.dev/install.sh` e `install.ps1`) **não está
> registrado**. Os comandos `curl`/`iwr` são aspiracionais até o registro
> do domínio. Por enquanto, o caminho de instalação suportado é apenas
> `npm install -g @mcp-graph-workflow/mcp-graph`.

## Context

v10 ships only as `npm install -g @mcp-graph-workflow/mcp-graph`. Two friction points block the 60-second goal:

1. **No curl-install one-liner** — non-Node-savvy users need to install Node first, then npm-install the CLI. That's three steps and at least one tool decision (npm vs pnpm vs yarn) before they see the banner.
2. **No standalone binary** — every install carries the full Node runtime + node_modules tree (~80–120 MB on disk). Power users on locked-down corporate boxes can't always `npm install -g`.

We need a strategy that keeps npm as the canonical channel (so the CLAUDE Code / Cursor / VS Code worlds can `npx` us) while offering escape hatches for users who need them.

## Decision

Three distribution channels, in priority order:

### 1. **npm primary** (always supported)

```bash
npm install -g @mcp-graph-workflow/cli
# or, no-install:
npx @mcp-graph-workflow/cli init
```

- Package: `@mcp-graph-workflow/cli` (new in v11; sibling of legacy `@mcp-graph-workflow/mcp-graph`)
- Bin entries: `mg` (daily) + `mcp-graph` (long form, matches v10 muscle memory)
- ESM bundle (`dist/cli.mjs`); deps externalized so install footprint mirrors npm-standard sizes
- Dual-published with `@mcp-graph-workflow/mcp-graph` v10.x for 6 months (deprecation banner; sunset in v12)

### 2. **curl-install one-liner** (recommended for non-technical users)

```bash
curl -fsSL https://mcp-graph.dev/install.sh | sh
```

Script (≤80 lines) detects `node` ≥ 20; if missing, suggests Volta/fnm/nvm with copy-pasteable commands. Then runs `npm install -g @mcp-graph-workflow/cli`. **Never silently installs Node** — the user sees what's about to happen.

The install script is hosted from the project's own GitHub Pages site (or a stable redirect). Source lives at `tools/cli/scripts/install.sh`, signed via SHA-256 published in the README so users can verify before piping to shell.

### 3. **Optional `bun --compile` single-file binary** (power users / locked boxes)

For users who can't `npm install -g`, we publish per-OS binaries on every GitHub release:

```
mg-linux-x64
mg-linux-arm64
mg-macos-x64
mg-macos-arm64
mg-windows-x64.exe
```

Built with `bun build --compile --target=bun-{os}-{arch}` from the same `src/cli.tsx` entry. Target binary size ≤ 30 MB (Bun runtime baseline ~25 MB; our code is tiny). Released to `https://github.com/diegonogueira/mcp-graph-workflow/releases/latest/download/mg-{os}-{arch}`.

**Not** the default install path — these are escape hatches. Documentation flow: `npm` → `curl` → binary, in that order.

## Alternatives considered

| Option | Why rejected |
|---|---|
| **Homebrew tap (`brew install mg`)** | High maintenance cost (formula updates per release). Defer to v11.1+ once the tap can be community-maintained. |
| **Docker image** | Pulls 200+ MB to run a CLI; defeats the "no Docker" architectural promise. |
| **`pkg` (Vercel) for binaries** | Project archived/stale; Bun's `--compile` is the modern replacement and produces smaller binaries. |
| **PyPI / `pipx`** | Wrong ecosystem; users would expect a Python tool. |
| **GitHub Releases binary only (no npm)** | Breaks `npx` and the Claude Code / Cursor ecosystems that already auto-discover `@mcp-graph-workflow/*` via npm registry. |

## Consequences

**Positive:**
- Same install surface as `gh`, `vercel`, `astro`, `bun` — users have priors for the curl one-liner.
- npm path keeps `npx` working (≅ critical for Claude Code MCP-config auto-emission via `mg init`).
- Binary path lets corporate users ship `mg` via internal artifact stores without Node.

**Negative / mitigations:**
- **Maintenance:** three channels = three release verifications. Mitigation: GitHub Actions matrix builds all three on tag push; a single failing channel blocks the release.
- **Trust on curl-install:** users piping arbitrary scripts to `sh` is risky. Mitigation: README documents SHA-256 of `install.sh` and a manual `curl -fsSL ... -o install.sh && sh install.sh` two-step.
- **Bun binary size (~30 MB):** acceptable but not negligible. Mitigation: only built on tag, not every commit; not the default flow.
- **Windows ergonomics:** PowerShell users may need `iwr -useb https://mcp-graph.dev/install.ps1 | iex`. Defer Windows install script to v11.1.

## Verification

- `time npm install -g @mcp-graph-workflow/cli` ≤ 30 s on warm cache.
- `time curl -fsSL https://mcp-graph.dev/install.sh | sh` ≤ 60 s end-to-end on a clean machine with Node already installed.
- `mg --version` works from all three channels; output identical.
- `bun build --compile` artifact ≤ 30 MB per OS/arch.

## References

- gh CLI install model: https://cli.github.com/manual/installation
- Astro install model: https://astro.build/install/
- Bun compile docs: https://bun.sh/docs/bundler/executables
