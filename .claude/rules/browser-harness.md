# Browser-Harness Rules

Constitutional rules for the `browser_harness` MCP tool and all CDP-automation
code in `src/core/browser-harness/`. These are non-negotiable; violations block
implementation review and CI gate.

## 1. No LLM on any hot path

**No LLM in mcp-graph; host drives via tool calls.**

Every op exposed by `browser_harness` (`cdp`, `js`, `click`, `type`,
`screenshot`, `helpers_add`, etc.) is a deterministic primitive. mcp-graph
never calls an LLM to decide which CDP method to invoke or what selector to
use. The host (Claude Code, an agent, a script) drives the browser by
composing tool calls. mcp-graph executes them.

Violation pattern: adding a `chat` or `plan` op that constructs a prompt and
calls the LLM gateway from within the handler. Use `src/core/browser-harness/`
for pure functions only; keep LLM routing in the host layer.

## 2. Connect to the user's Chrome — never spawn your own

**Connect to a Chrome instance the user already started.** mcp-graph does not
launch Chrome processes.

- Discovery: `discoverWsEndpoint()` reads `DevToolsActivePort` or probes
  `/json/version`. It never calls `child_process.spawn("chrome", ...)`.
- If Chrome is not found after polling: surface `cdp_unreachable` + hint
  (`--remote-debugging-port=9222`) and stop. Do not silently substitute a
  headless instance.
- Sessions registered via `new_tab` / `SessionStore` reference Chrome instances
  the user controls, not ones mcp-graph launched.

## 3. Secrets — never log the complete wsEndpoint

CDP WebSocket URLs carry a per-session UUID that grants full control of the
attached Chrome instance. Treat them as secrets.

**Log shape (always):**
```
ws://<host>:<port>/devtools/browser/<redacted>
```

Rules:
- Call `maskWsEndpoint(url)` before writing any CDP WS URL to logs, error
  messages, or MCP tool responses.
- Never echo `wsEndpoint` back to the LLM context in full form.
- `wss://` (TLS) is masked the same way.
- Bearer tokens, OAuth refresh tokens, and `vscode.lm` credential metadata
  must never appear in logs at any verbosity level.

Enforcement: `src/core/browser-harness/endpoint-discovery.ts::maskWsEndpoint`.

## 4. Helper changes require citation

Any `helpers_add` call that modifies or replaces an existing helper must
include a `§BROWSER_TEST-<runId>` citation in the rationale/comment so the
change is traceable back to the browser test run that motivated it.

Format: `§BROWSER_TEST-<runId>` where `runId` is the `runId` returned by the
`browser_harness` session or recorded in `bh_audit`.

Helpers submitted without a run-backed citation are advisory only and must be
reviewed before being used in a subsequent automated session.

## 5. Forbidden APIs in helpers

Helper source submitted via `helpers_add` is validated by `SelfHealService`
before persistence. The following are always rejected:

- `eval(...)`, `Function(...)` — dynamic code execution
- `require(...)`, `import(...)` — module loading
- `process`, `globalThis` — runtime escape hatches
- `child_process`, `fs` — system-level APIs

Violation → `forbidden_api` error. No exceptions, no override flags.

## 6. Domain enforcement

`allowedDomains` from the guardrail file (`src/browser-harness-skills/SKILL.md`)
is enforced at the agent layer. If a run requires a domain not in the allow-list,
it fails with `domain_blocked` (not retriable).

Never expand `allowedDomains` inside a handler to unblock a stalled run — that
decision belongs to the human operator editing the guardrail file.

## Where this is enforced

- `src/mcp/tools/browser-harness.ts` — op dispatch + `SelfHealService` gate
- `src/core/browser-harness/endpoint-discovery.ts` — `maskWsEndpoint`
- `src/core/browser-harness/helper-validator.ts` — `FORBIDDEN_TOKENS` + AST walk
- `src/core/browser-harness/guardrail-loader.ts` — domain + policy config
