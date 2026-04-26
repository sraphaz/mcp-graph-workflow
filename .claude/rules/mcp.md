# MCP Tool Rules

- **Tool surface = `src/mcp/tools/<tool-name>.ts`** — one file per MCP tool; export a single `<toolName>Tool` object with `name`, `description`, `inputSchema`, `handler`
- **Zod v4 schemas** — `inputSchema` must be a Zod object schema (`import { z } from 'zod/v4'`); never hand-roll JSON Schema. Schemas live in `src/schemas/` when shared, inline when tool-local.
- **Handler signature** — `(input: z.infer<typeof inputSchema>) => Promise<ToolResult>` — never accept untyped `unknown` and always validate at the boundary
- **`ToolResult` contract** — return `{ content: [{ type: "text", text: ... }], isError?: boolean, structuredContent?: unknown }`. Never `throw` from a handler; surface failure via `isError: true` + a human-readable `text`.
- **Pure where possible** — tool handlers should be thin orchestration over `core/` functions. Side-effects (DB writes, network calls) live in core, not the tool file.
- **Lifecycle gate** — every mutating tool runs through `unified-gate` (lifecycle phase + code-intel + prerequisites). Read-only tools (`list`, `show`, `query_graph`, `help`) bypass — declare in `src/mcp/tools/_read-only-tools.ts` allowlist.
- **Telemetry** — every handler call goes through the wrapper that records `tool_token_usage` row with `success`, `duration_ms`, `error_kind` (migration v64). Don't bypass this for "fast paths".
- **Registration** — register in `src/mcp/server.ts` and add the tool name to the contract test in `src/tests/mcp-tool-registry.test.ts` (this catches drift)
- **Tests** — colocated unit test exercises (a) input validation rejects malformed payload, (b) golden path returns expected shape, (c) at least one domain-specific error (node not found, store empty, etc.)
