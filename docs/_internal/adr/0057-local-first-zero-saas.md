# ADR-0057 — Local-first principle: zero mandatory SaaS dependencies

- **Status:** Accepted (codifying an existing invariant, 2026-04-26)
- **Driver:** Privacy, air-gap compatibility, data sovereignty, offline-first developer experience. The product has always been local-first; this ADR makes the contract explicit and provides regression guards.
- **Owner:** @diegonogueira
- **Related:** ADR-0055 (optional ONNX), ADR-0056 (EmbeddingProvider interface).

## Context

mcp-graph runs on a developer's machine. It manages PRDs, an execution graph, knowledge, and RAG over local SQLite. None of that requires a cloud service to function. Yet the product surface has grown — LLM integrations, MCP servers, browser automation, model downloads — and each of those is a potential vector for accidental SaaS coupling.

A 2026-04-26 audit confirmed the invariant holds today. But "holds today" is not a contract. Without explicit codification:

- A future PR can add `posthog-js` to `dependencies` for "anonymous error reporting" and ship before anyone notices.
- A new feature can hardcode `https://api.openai.com/...` in production code instead of behind a credential gate.
- The list of opt-ins becomes folklore — known to the maintainer, invisible to new users.

## Decision

**mcp-graph is 100% local-first. No external service, API, CDN, or registry is contacted at runtime in the default install.** Every external integration is opt-in and meets all four conditions:

1. **Explicit user action required** — env var, config file, CLI command, or interactive prompt.
2. **Graceful fallback** — the rest of the product keeps working when the integration is unavailable.
3. **Documented in this ADR** — table below.
4. **Disable mechanism documented** — user can turn it off without uninstalling.

### Inventory of opt-in externals

| Integration | What it does | Trigger | Fallback | How to disable |
|---|---|---|---|---|
| `update-notifier` | Daily npm-registry version check, non-blocking banner | On by default in interactive CLI | Banner is non-blocking; product runs regardless | `MCP_GRAPH_NO_UPDATE_CHECK=1` env var, or run under `CI=true`, or use MCP stdio mode (skipped automatically) |
| LLM API (Anthropic / GitHub Copilot) | Powers `browser-harness` LLM-driven flows | Credentials in `workflow-graph/bh-auth.json` (chmod 600) or env vars (`ANTHROPIC_API_KEY`, `GITHUB_COPILOT_TOKEN`) | Browser-harness only; rest of product unaffected | Delete the auth file / unset env vars |
| Hugging Face model download | Downloads `all-MiniLM-L6-v2` for neural RAG embeddings | `mcp-graph install-neural` CLI command | `HashEmbeddingProvider` (TF-IDF, deterministic, ~30% lower retrieval quality) | Don't run `install-neural`; or `rm -rf workflow-graph/models/` to force fallback |
| Context7 MCP server | Fetches library docs into the RAG store | User adds it to `.mcp.json` | Library name passed through as-is (`mcp-context7-fetcher.ts:57`) | Remove from `.mcp.json` |
| browser-use MCP / Playwright MCP | Browser automation for `browser_pilot_run` | User adds to `.mcp.json` and runs Copilot Bridge | `browser_pilot_run` tool fails fast with `bridge_unreachable`; rest of product unaffected | Remove from `.mcp.json` |

**That is the complete list.** Anything not in this table that contacts an external service is a violation of this ADR.

### Regression guards

Two test files enforce the invariant:

- `src/tests/local-first-invariant.test.ts` — scans `package.json` for banned SaaS-client packages (Sentry, PostHog, AWS SDK, Supabase, OpenAI SDK, etc.) and scans `src/**/*.ts` for hardcoded SaaS API URLs outside the explicit opt-in allow-list (`browser-harness/llm-client.ts`, `rag/onnx-embeddings.ts`).
- `src/tests/package-onnx-zero-deps.test.ts` — narrow guard on `onnxruntime-node` specifically (ADR-0055).

Adding a new opt-in requires:
1. A new entry in the table above (this file).
2. Updating `OPT_IN_FILES` in `local-first-invariant.test.ts` if the integration introduces new SaaS URL literals in production code.
3. Documenting the disable mechanism in the README "Network & Privacy" section.

### What we explicitly are NOT doing

- **No anonymous telemetry.** Even opt-in. Telemetry creep is the most common path from local-first to SaaS-coupled. If error reporting becomes valuable later, a new ADR must justify it from scratch.
- **No remote feature flags.** The product runs offline; flags are local config.
- **No automatic crash uploading.** Logs stay in `workflow-graph/logs/` unless the user copies them out.
- **No "phone home if disabled" pattern.** Opt-out is real opt-out — no heartbeat to confirm the opt-out registered.

## Consequences

- ✅ Air-gap deployment works out of the box. Run `npm install -g @mcp-graph-workflow/cli` on a machine that has never touched the public internet (after the install) and the product functions fully.
- ✅ Privacy-conscious developers, regulated industries (finance, healthcare, defense), and offline-first contexts (planes, trains, rural areas) get a first-class experience.
- ✅ The maintainer can audit network behavior with one command: `lsof -i` while the product runs, or `tcpdump`. Default-mode shows zero connections.
- ⚠️ Some features (neural RAG, LLM-driven harness, Context7 docs) require an explicit setup step. Acceptable trade-off — those are advanced features with clear network costs.
- ⚠️ The team cannot use product analytics to drive prioritization. Decisions stay grounded in user reports, GitHub issues, and explicit feedback channels — slower signal but higher fidelity.

## Verification

- `npm test src/tests/local-first-invariant.test.ts` — green.
- `MCP_GRAPH_NO_UPDATE_CHECK=1 mcp-graph --help` — no network activity (verifiable with `lsof -i` or `tcpdump`).
- `mcp-graph doctor` reports `onnx: unavailable, fallback: hash` on a fresh install.
- Default `mcp-graph next` run on an air-gapped machine succeeds.
