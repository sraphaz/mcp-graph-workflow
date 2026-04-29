# LLM Gateway — MCP-Graph Proxy SDK

> Internal SDK for routing LLM calls with budget guard, ledger, and tier policy.
> Part of the **MCP-Graph Proxy v12.x** initiative (Epic [`node_108760264df6`](../../workflow-graph/graph.db) — see PRD).

---

## Overview

The MCP-Graph Proxy ships in two layers:

| Layer | Module | Purpose |
|-------|--------|---------|
| 1 | `src/core/llm/` | **`LlmGateway`** SDK — in-process routing, budget guard, cost ledger |
| 2 | `src/core/proxy/` _(Fase E — TBD)_ | OpenAI-compatible HTTP server bound to `127.0.0.1` |

Layer 1 is consumed by `browser-harness/llm-client.ts` (regression shim), MCP tools (e.g. `llm`), and runners. Layer 2 wraps Layer 1 to expose `/v1/chat/completions` for external clients (browser-use, Copilot, Continue) — not yet implemented.

ADR references: [ADR-llm-01](../../docs/_internal/adr/) (facade), [ADR-llm-02](../../docs/_internal/adr/) (provider contract), [ADR-llm-03](../../docs/_internal/adr/) (migration v66 ledger), [ADR-llm-04](../../docs/_internal/adr/) (budget guard).

---

## MCP tool `llm`

Surface for agents to interact with the gateway.

| Action | Read-only | Description |
|--------|-----------|-------------|
| `generate` | no | Routes a chat completion through the gateway, records the cost. |
| `list_models` | yes | Lists registered models filtered by `tier` / `allowExpensive`. |
| `budget_status` | yes | Returns `{totalUsd, callCount, byProvider}` for a `cellId` / `runId`. |
| `proxy_status` | yes | Returns `{available, reason}` for the HTTP proxy (`available: false` until Fase E). |

### Example

```json
{
  "action": "generate",
  "model": "anthropic/claude-haiku-4-5",
  "messages": [
    { "role": "user", "content": "Say pong." }
  ],
  "caller": "agent-A",
  "cellId": "node_abc123"
}
```

Returns `{content, model, usage}` plus `structuredContent` mirroring the same fields. Errors (`LlmModelUnknown`, `LlmBudgetExceededError`, `LlmAuthError`, …) come back as `{isError: true, content: [{text: "<ClassName>: <message>"}]}` — never a thrown exception.

---

## Default models

The registry seed (`src/core/llm/registry.ts`) ships with:

| Model id | Provider | Tier | Context | Notes |
|----------|----------|------|---------|-------|
| `anthropic/claude-haiku-4-5` | anthropic | cheap | 200k | Default for cheap pool |
| `anthropic/claude-sonnet-4-6` | anthropic | **expensive** | 200k | Blocked unless `allowExpensive=true` |
| `anthropic/claude-opus-4-7` | anthropic | **expensive** | 200k | Blocked unless `allowExpensive=true` |
| `openai/gpt-4o-mini` | openai | cheap | 128k | |
| `openai/gpt-4o` | openai | **expensive** | 128k | Blocked unless `allowExpensive=true` |
| `openrouter/auto` | openrouter | mid | 128k | Cheap pool, OpenRouter-routed |
| `copilot/gpt-4.1` | copilot | mid | 128k | Pricing N/A (Copilot subscription) |
| `ollama/llama3.2` | ollama | cheap | 128k | Local, zero cost |

Pricing values are static seed; refresh via TODO `scripts/sync-openrouter-prices.mjs` (out-of-scope for v12).

---

## Budget caps

Default policy is **`<$1.00/cell`** (constraint enforced by the project — see `docs/_internal/prd/`). Configure via `project_settings`:

| Key | Default | Effect |
|-----|---------|--------|
| `llm.budget.cap_usd_per_cell` | `1.00` | Per-graph-node cap; `LlmBudgetExceededError` on overrun |
| `llm.budget.cap_usd_per_run` | _(unset)_ | Per-run cap if set |
| `llm.allowExpensive` | `false` | When `true`, expensive-tier models become callable |

Pre-flight estimate uses `maxTokens × outputPerMtok`; the post-call `record()` writes the real cost into `llm_call_ledger` (migration v66). Concurrency overshoot is bounded to ≤1 call per concurrent agent (ADR-llm-04).

---

## Ledger schema (migration v66)

```sql
CREATE TABLE llm_call_ledger (
  id                  TEXT PRIMARY KEY,    -- ulid-ish
  ts                  INTEGER NOT NULL,    -- unix ms
  project_id          TEXT,
  cell_id             TEXT,                -- graph node id correlation
  run_id              TEXT,
  caller              TEXT NOT NULL,       -- 'browser-harness' | 'mcp-tool' | ...
  provider            TEXT NOT NULL,
  model               TEXT NOT NULL,
  input_tokens        INTEGER,
  output_tokens       INTEGER,
  cached_input_tokens INTEGER,
  cost_usd            REAL NOT NULL,
  latency_ms          INTEGER,
  status              TEXT NOT NULL,       -- 'ok' | 'error'
  error_kind          TEXT
);
```

Indexes: `idx_llm_ledger_cell`, `idx_llm_ledger_run`, `idx_llm_ledger_ts`.

Errors (LlmAuthError, LlmTransportError, …) are persisted with `status='error'` and `cost_usd=0`.

---

## Roadmap — Fase E (HTTP proxy)

Pending work to expose the gateway via HTTP:

- `src/core/proxy/server.ts` — `node:http` server bound to `127.0.0.1` (ADR-proxy-01, ADR-proxy-03)
- `/v1/chat/completions` — OpenAI ↔ LlmRequest mapping (ADR-proxy-02), non-streaming only in v12.x (ADR-proxy-04)
- `/v1/models` — filtered by tier/allowExpensive
- `/healthz`, `/readyz` — open routes; everything under `/v1/*` requires `Authorization: Bearer <token>`
- `~/.mcp-graph/proxy.token` (mode 0600) — token storage; rotated via `mcp-graph proxy token --rotate`
- Caller identity via `X-MCP-Graph-Caller` header (ADR-int-01)

Until Fase E lands, `llm proxy_status` returns `{available: false, reason: "proxy not started — Fase E not yet implemented"}`.
