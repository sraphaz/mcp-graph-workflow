---
name: graph-observability
description: Observability audit using Three Pillars (Logs, Metrics, Traces), RED/USE methods, OpenTelemetry semantic conventions, and ECS (Elastic Common Schema) compliance
triggers:
  - graph-observability
version: 1.0.0
author: Diego Nogueira
date: 2026-04-04
---

# graph-observability

Observability audit using the Three Pillars (Logs, Metrics, Traces), RED/USE methods, OpenTelemetry semantic conventions, and ECS (Elastic Common Schema) compliance. Ensures every module is debuggable, measurable, and traceable in production.

## When to Use

- After IMPLEMENT phase, to audit observability before DEPLOY
- Before DEPLOY phase, as a production-readiness gate
- When debugging production issues and finding blind spots
- When adding new modules that need logging, metrics, or tracing
- During REVIEW phase to verify observability coverage

## Mandatory Flow

```
logger coverage --> structured logging --> OTel compliance --> ECS schema --> error paths --> metrics --> trace context --> health checks --> report --> write_memory
```

## Workflow

### Step 1: Logger Coverage

Grep for modules without `logger.*` calls. Every exported function should log at:

- **Entry points:** `logger.info` with operation name and key parameters
- **Error paths:** `logger.error` with error message, stack trace, and operation context
- **External calls:** `logger.debug` with timing (duration in ms)

Flag modules in `src/core/` and `src/mcp/` with zero log statements. Use the project logger at `src/core/utils/logger.ts` — never raw `console.log`.

**Target:** 100% of modules in `src/core/` have at least one logger call.

### Step 2: Structured Logging Check

Verify all log calls use the project logger (`src/core/utils/logger.ts`). Check that:

- No raw `console.log`, `console.warn`, or `console.error` in production code
- Log fields are queryable — key=value pairs or JSON objects, not free-text sentences
- Log levels are appropriate: `info` for business events, `error` for failures, `debug` for diagnostics, `warn` for degraded conditions
- Sensitive data is never logged (tokens, passwords, API keys, PII)

Flag violations with file path and line number.

### Step 3: OpenTelemetry Compliance

Validate traces follow OTel semantic conventions:

- **Service identity:** `service.name`, `service.version` set in trace root
- **HTTP spans:** `http.method`, `http.route`, `http.status_code`, `http.target`
- **Database spans:** `db.system` (sqlite), `db.statement` (query), `db.operation`
- **RPC spans:** `rpc.system`, `rpc.method`, `rpc.service`
- **Span naming:** `<verb> <noun>` format (e.g., `import PRD`, `query RAG`)

Check that spans have proper parent-child relationships. No orphaned spans without a parent trace.

### Step 4: ECS Schema Validation

Verify log fields follow Elastic Common Schema:

- **Event fields:** `event.action` (what happened), `event.category` (type), `event.outcome` (success/failure), `event.duration`
- **Error fields:** `error.message`, `error.stack_trace`, `error.type` for all error logs
- **Service fields:** `service.name`, `service.version`, `service.environment`
- **Labels and tags:** ECS-compliant naming (lowercase, dot-separated namespaces)

Flag non-compliant log entries with suggested corrections.

### Step 5: Error Path Coverage

Audit all `try-catch` blocks and error handling paths:

- Every `catch` block must log with: error message, stack trace, operation context (what was being done), correlation ID (trace/request ID)
- No empty catch blocks — at minimum `logger.debug` for intentionally swallowed errors
- No swallowed errors without logging — if caught, it must be logged or re-thrown
- Typed errors from `src/core/utils/errors.ts` used consistently — no raw `throw new Error("string")`
- Error propagation preserves original stack trace (`{ cause: originalError }`)

Flag empty catch blocks and swallowed errors as critical findings.

### Step 6: Metrics and Dashboards

Check existing metrics coverage and apply RED/USE methods:

**Existing metrics modules:**
- RAG trace: `src/core/rag/rag-trace.ts`
- Token budget: `src/core/context/token-budget-tracker.ts` (if present)
- DORA forecast: `forecast` tool
- Velocity: `metrics` tool

**RED Method (request-driven):**
- **Rate:** Requests/operations per second tracked?
- **Errors:** Error rate by type and endpoint tracked?
- **Duration:** Latency percentiles (P50, P95, P99) tracked?

**USE Method (resource-driven):**
- **Utilization:** SQLite connection pool, memory usage tracked?
- **Saturation:** Queue depths, pending operations tracked?
- **Errors:** Resource error rates tracked?

Flag missing RED/USE coverage areas.

### Step 7: Trace Context Propagation

Verify trace ID and span ID propagation across module boundaries:

- `RagTracer` (`src/core/rag/rag-trace.ts`) maintains trace context through the RAG pipeline
- Code Intelligence wrapper maintains correlation across analysis calls
- Lifecycle wrapper preserves trace context in tool enrichment
- API routes propagate request ID from entry to response
- No orphaned spans — every span has a parent or is a root span

Flag broken propagation chains where trace context is lost.

### Step 8: Health Checks

Audit health check coverage via Doctor checks (`src/core/doctor/`):

- **Database connectivity:** SQLite database accessible and writable
- **File permissions:** Working directory (`workflow-graph/`) has read/write access
- **Dependencies:** Required npm packages installed and compatible
- **Configuration validity:** Config schema validates against current settings

For API server (`src/api/`):
- Readiness probe: Can accept requests (DB connected, config loaded)
- Liveness probe: Process alive and responsive (not deadlocked)

Flag missing health checks for critical subsystems.

### Step 9: Observability Report

Compile the full audit report:

```
Logs: <N>% modules covered, <N> violations found
Metrics: RED <N>/3 covered, USE <N>/3 covered
Traces: <N>% spans OTel-compliant, <N> orphaned spans
OTel Score: <N>/100
ECS Score: <N>/100
Error Paths: <N> empty catches, <N> swallowed errors
Health Checks: <N>/<M> subsystems covered
Grade: <A-F>
```

**Grading:**
- **A (90-100):** All pillars covered, OTel + ECS > 90%, zero empty catches
- **B (75-89):** Minor gaps in one pillar, OTel + ECS > 75%, few violations
- **C (60-74):** One pillar significantly weak, some modules unlogged
- **D (45-59):** Two pillars weak, many empty catches, no trace propagation
- **F (< 45):** Critical observability debt, console.log in production, no structured logging

Save findings:
```
Tool: mcp__mcp-graph__write_memory (title: "Observability Audit Report — <date>", content: <report>)
```

## Output Format

```
Phase: OBSERVABILITY AUDIT
Log Coverage: <N>% modules
Metrics Coverage: RED <N>/3, USE <N>/3
Trace Coverage: <N>% OTel-compliant
OTel Score: <N>/100
ECS Score: <N>/100
Grade: <A-F>
Recommendations: <top 3 actions>
```

## Anti-Patterns

- Do NOT use `console.log` — use the project logger (`src/core/utils/logger.ts`)
- Do NOT log sensitive data (tokens, passwords, API keys, PII)
- Do NOT create logs without structured context objects — always include queryable fields
- Do NOT ignore error stack traces in catch blocks — always log the full stack
- Do NOT skip trace context propagation in async operations — correlation is essential
- Do NOT use free-text log messages without queryable fields — structure enables search
- Do NOT forget to log external API call durations — latency visibility is critical
