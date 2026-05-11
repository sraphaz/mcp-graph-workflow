---
name: browser-harness
description: Direct browser control via CDP through the browser_harness MCP tool. Use when automating, testing, or interacting with web pages. Connects to the user's already-running Chrome — never spawns its own.
---

# browser-harness

Atomic CDP primitives exposed as MCP tool calls. **No LLM on any hot path** — the host drives by composing tool calls; mcp-graph executes them deterministically.

Read this skill in full before using `browser_harness`. It has to be in context.

## Fast start

```jsonc
// 1. Open a new tab (get sessionId back)
{ "op": "new_tab", "cdpEndpoint": "ws://127.0.0.1:9222/devtools/browser/<UUID>" }
// → { "ok": true, "sessionId": "sess_abc123" }

// 2. Screenshot to understand the current page
{ "op": "screenshot", "sessionId": "sess_abc123" }
// → { "ok": true, "base64": "iVBOR..." }

// 3. Click a button by selector
{ "op": "click", "sessionId": "sess_abc123", "selector": "[aria-label='Submit']" }

// 4. Type into a field
{ "op": "type", "sessionId": "sess_abc123", "selector": "#email", "text": "user@example.com" }

// 5. Verify — screenshot again before assuming it worked
{ "op": "screenshot", "sessionId": "sess_abc123" }
```

Getting `cdpEndpoint`: start Chrome with `--remote-debugging-port=9222`. mcp-graph
reads `DevToolsActivePort` automatically via `discoverWsEndpoint()`.

## Tool call shape

Every call is a JSON object with an `op` field. Most ops require a `sessionId`
obtained from `new_tab`.

### All 11 ops

| op | Required fields | What it does |
|----|----------------|--------------|
| `new_tab` | `cdpEndpoint` | Attach to Chrome; returns `sessionId` |
| `screenshot` | `sessionId` | Capture PNG as base64 |
| `click` | `sessionId`, `selector` | Click element matching CSS selector |
| `type` | `sessionId`, `selector`, `text` | Type text into element |
| `page_info` | `sessionId` | Return Target.getTargetInfo (URL, title) |
| `wait_for_load` | `sessionId` | Wait for `body` or `selector` (5s timeout) |
| `js` | `sessionId`, `code` | Runtime.evaluate — returns `value` |
| `cdp` | `sessionId`, `method` | Raw CDP method + optional `params` |
| `helpers_add` | `name`, `source` | Add/replace a helper fn (validated) |
| `helpers_list` | _(none)_ | List all registered helpers |
| `recover` | `sessionId` | Invoke `recover` helper if registered |

### Examples

```jsonc
// Execute JavaScript
{ "op": "js", "sessionId": "sess_abc123", "code": "document.title" }
// → { "ok": true, "value": "My Page" }

// Raw CDP call
{ "op": "cdp", "sessionId": "sess_abc123", "method": "Page.navigate",
  "params": { "url": "https://example.com" } }

// Wait for a specific element
{ "op": "wait_for_load", "sessionId": "sess_abc123", "selector": "#app-loaded" }

// Add a safe helper (validated — no eval/fs/child_process)
{ "op": "helpers_add", "name": "get_text",
  "source": "async (args) => { return document.querySelector(args.sel)?.textContent ?? ''; }" }
```

## What actually works

- **Screenshots first** — `screenshot` is the fastest way to understand the
  current page, spot visible targets, and verify that an action took effect.
  Always screenshot before and after a meaningful interaction.

- **Selector-based clicks** — `click` with `[aria-label]`, `[data-testid]`,
  `[role]`, or semantic CSS. Prefer attribute selectors over class names
  (class names change with bundlers).

- **After navigation** — always call `wait_for_load` after `cdp` navigates
  (`Page.navigate`) to avoid acting on the old DOM.

- **DOM inspection** — use `js` with `document.querySelector(...)` or
  `document.querySelectorAll(...)` when a screenshot shows that you need
  exact text content or attribute values.

- **Custom helpers** — register reusable operations via `helpers_add` (they
  survive process restarts via SQLite). List them with `helpers_list`.

- **Recovery** — if a session goes stale, register a `recover` helper via
  `helpers_add` that re-attaches or navigates to a known state, then call
  `{ "op": "recover", "sessionId": "..." }`.

- **Raw CDP** for anything the 11 ops don't cover — `cdp` passes through
  any `Domain.method` directly.

## Gotchas (field-tested)

- **Chrome 144+ `DevToolsActivePort` vs `/json/version`**: Chrome 144+ does not
  reliably serve `/json/version` until the port is fully listening.
  `discoverWsEndpoint()` reads `DevToolsActivePort` first; fall back to
  `/json/version` polling for up to 30s.

- **`DevToolsActivePort` can exist before the port is listening.** If connection
  is refused, keep polling (not failing) for up to 30s. Surface
  `cdp_unreachable` only after the deadline.

- **`sessionId` is required for every op except `new_tab`, `helpers_add`,
  `helpers_list`**. Omitting it returns `"sessionId required or session not
  found"`.

- **`new_tab` requires the WS URL, not HTTP**. Use `ws://127.0.0.1:9222/...`
  not `http://`.

- **`helpers_add` rejects forbidden APIs** (`eval`, `require`, `import`,
  `process`, `globalThis`, `fs`, `child_process`). Source must be a function
  expression (`async (args) => ...` or `function ...`).

- **Evidence requirement**: `click`, `type`, `select`, `submit` ops should be
  followed by a `screenshot` call so the host has evidence the action worked.
  Missing evidence for these ops triggers an advisory warning.

- **wsEndpoint in logs is always masked**: `ws://<host>:<port>/devtools/browser/<redacted>`.
  Never log or surface the UUID segment.

- **After helpers_add, call helpers_list to verify**: the new helper should
  appear with `version ≥ 1`. A version increment means the helper was updated
  (monotonic versioning).

- **Chrome may show an Allow dialog on first CDP connect.** Tell the user to
  click Allow in Chrome if `new_tab` is hanging, then retry — the harness
  polls and will succeed once Chrome grants access.

- **cdpEndpoint for `new_tab`**: get it from `DevToolsActivePort` (line 2 gives
  the browser path: `/devtools/browser/<UUID>`), or from `page.webSocketDebuggerUrl`
  in the `/json/version` response.
