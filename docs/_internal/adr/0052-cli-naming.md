# ADR-0052 — CLI naming: `mcp-graph` long form, `mg` daily alias

- **Status:** Accepted (2026-04-24)
- **Driver:** v11 User-First DX Overhaul
- **Owner:** @diegonogueira

## Context

v10 ships a single binary: `mcp-graph`. It's clear, it's the brand, but it's 9 keystrokes plus a hyphen — every command in daily use becomes 2× longer than the modern peers (`gh`, `bun`, `npx`, `pnpm`, `vercel`). The REPL flagship UX (`mg` → `/init`) needs the entry to feel cheap to invoke.

We also can't drop the long form: existing scripts, MCP-config files (`.mcp.json` → `command: "mcp-graph"`), CI pipelines, and CLAUDE.md references would all break.

## Decision

The v11 npm package (`@mcp-graph-workflow/cli`) ships **two bin entries pointing at the same launcher**:

| Bin name | Use case |
|---|---|
| `mg` | Daily interactive use; REPL flagship; matches `gh`/`bun`/`pnpm` keystroke economy |
| `mcp-graph` | Scripts, CI, MCP config files, anywhere the long brand reads better; preserves v10 muscle memory and unblocks zero-effort migration |

Both names route through the same `dist/cli.mjs`. Identical behavior, identical commands, identical exit codes.

Inside the REPL, every command is invoked with the **`/slash` convention** (`/init`, `/next`, `/help`, `/exit`) regardless of which bin name the user typed to start the REPL. This matches Claude Code, gh-copilot, Cursor.

## Alternatives considered

| Option | Why rejected |
|---|---|
| **Drop `mcp-graph`, ship only `mg`** | Breaks every existing `.mcp.json`, CLAUDE.md reference, CI script. v11 promises zero v10 breakage during the 6-month dual-ship. |
| **Drop `mg`, only `mcp-graph`** | Loses the keystroke economy; the REPL UX would feel sluggish to invoke; users compare us to `gh`, not to `kubectl`. |
| **`mcg` / `mcgraph` / `graph`** | `graph` collides with too many tools; `mcg`/`mcgraph` lose brand recognition; `mg` is short, brand-derivable (m + g), and only collides with one obscure ImageMagick legacy tool. |
| **Configurable alias (`mg config alias <name>`)** | Adds a config layer for a fixed problem; users install once, don't rename. |

## Conflict check

Surveyed at the time of this ADR (2026-04):

- **`mg`** in Homebrew → Microsoft Movement Graph CLI (deprecated, abandoned). No active conflict.
- **`mg`** as a microemacs-clone editor on some Linux distros (`mg(1)`). Niche; users with the editor installed would override their PATH order. Documented in QUICKSTART; users can `alias mg=/path/to/mg-editor` to keep both.
- **npm registry** `mg` package: squatted, no active code. We don't need that name (we publish under `@mcp-graph-workflow/cli`).
- **GitHub Actions runner** has no `mg` reserved word.

If a future conflict materializes, fallback path: `mcp-graph` always works; users can `alias mg=mcp-graph` themselves. We do **not** fight for the name.

## Consequences

**Positive:**
- Daily REPL-driven workflows feel cheap (2 keystrokes to launch).
- v10 users upgrade by changing `mcp-graph` to `mg` zero-by-zero on their own pace; nothing forces it.
- README hero block reads naturally: `mg init && mg next && mg ui`.

**Negative / mitigations:**
- **mg(1) editor collision** on some Linux boxes → documented in QUICKSTART and `mg --help` footer; never crashes, just shadowed by PATH order.
- **Slight muscle-memory split** while users learn `mg` after years of `mcp-graph` → resolved by both working identically; help text uses `mg` as primary, `mcp-graph` shown in parens.
- **Brand discoverability**: `mg` is too short to be Googleable on its own. Mitigation: full brand `mcp-graph` everywhere docs/SEO matters; `mg` lives in muscle memory.

## Verification

- `which mg && which mcp-graph` both resolve after `npm install -g @mcp-graph-workflow/cli`.
- `mg --version` and `mcp-graph --version` print identical output.
- `mg init` and `mcp-graph init` both work; v10 `.mcp.json` files referencing `mcp-graph` keep functioning post-upgrade.
- Help footer mentions both: "`mg` (alias) and `mcp-graph` (long form) are equivalent."

## References

- gh: 2 chars, daily use, no long form needed.
- bun, pnpm, deno: short by design.
- vercel: medium length, no shorthand — and feels heavy to type. Anti-pattern for daily use.
