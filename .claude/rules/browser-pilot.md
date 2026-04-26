# Browser Pilot Rules

Constitutional rules for the `browser_pilot_run` capability and the
Copilot Bridge VS Code extension (`tools/copilot-bridge/`). These are
non-negotiable; if a check fails, the run aborts and no Copilot call is
made.

## Bridge readiness

- **Health check first.** Every `browser_pilot_run` call MUST invoke
  `bridge.ensureReady()` (HTTP `GET /health` with exponential backoff —
  250ms → 4s, 30s budget) BEFORE issuing any Copilot completion. A
  missing or stale bridge surfaces as `bridge_unreachable` (retriable)
  with a hint to start VS Code with the Copilot Bridge extension active.
- **No silent fallback to direct OpenAI.** If the bridge is unreachable,
  the run fails — never substitute a real `OPENAI_API_KEY` to keep the
  agent moving.

## Secrets in logs

- **Never log Copilot bearer tokens, OAuth refresh tokens, or any
  `vscode.lm` credential metadata.** This includes serialized
  `LanguageModelChat` instances (which can carry session tokens),
  `Authorization: Bearer ...` headers proxied through the bridge, and
  the literal string `OPENAI_API_KEY=copilot-dummy` is the only
  acceptable value to ever appear in env logs.
- **Never log full request/response bodies on the `/v1/chat/completions`
  path.** Trim to status code, model, prompt-token count, and finish
  reason. The prompt itself may contain user data; treat it as PII.

## CDP WebSocket URL

- **Mask CDP `wsEndpoint` in logs.** A WS URL like
  `ws://127.0.0.1:9222/devtools/browser/<UUID>` includes a per-launch
  identifier that grants full control of the Chrome instance. Log
  shape: `ws://<host>:<port>/devtools/browser/<redacted>` only.
- **Never echo `wsEndpoint` back to the LLM context** in error messages
  or progress notifications. Use a session label (`session-12ab`) when
  you must reference it.

## Domain enforcement

- `allowedDomains` is enforced at the agent layer (`browser-use`
  config), not on trust. If a run requires a domain not in the
  allow-list, it fails with `domain_blocked` (NOT retriable).
- `forbiddenCdpMethods` (default `["Browser.close"]`) is a security
  backstop — agents must not be able to terminate the Chrome instance
  the user attached to.

## Cost control

- `maxSteps` ceiling (default 25) is hard. Never raise it implicitly
  inside the orchestrator; the caller decides budget.
- If `tokenBudgetPerDay` is configured and exhausted, surface
  `quota_exceeded` (retriable=false) — do NOT retry on a different model
  to "save the run".

## Graph traceability

- Every `browser_pilot_run` invocation MUST persist a `runId` in the
  runs-store and cross-link it back to the originating graph task. A
  successful response always returns the `runId` so the caller can
  reconstruct the trail later.

## Where this is enforced

- VS Code Bridge: `tools/copilot-bridge/src/server/health.ts` (readiness),
  `tools/copilot-bridge/src/server/lm-error-map.ts` (error
  classification).
- CLI Bridge: `tools/copilot-bridge-cli/src/server/server.ts` (same
  surface, same rules). `Editor-Version` pin (`src/config.ts`)
  MUST NOT be logged at higher granularity than the minor version.
- MCP Graph Workflow orchestrator: the `executeBrowserPilot` handler is
  the single entry point. Bypassing it (e.g. shelling out to a browser
  agent directly with a real Copilot key) violates this rule. Both
  bridges expose identical wire format on `:9876` — orchestrator does
  not need to know which one is running.
