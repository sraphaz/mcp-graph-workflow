/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Pre-tool-use hook handler — Wave B of the v11.x roadmap.
 *
 * This module is the testable core of `mcp-graph hook pre-tool-use`. The CLI dispatcher
 * (hook-dispatch.ts) reads stdin best-effort and passes the parsed payload here.
 * `evaluatePreToolUse` returns a structured outcome that the dispatcher translates
 * into Claude Code's hook protocol (exit code + stdout JSON).
 *
 * Wave B1 (this file) ships the input filter + escape hatch; gate evaluation
 * arrives in B2 with `loadGateContext` + `checkGates` from src/mcp/unified-gate.
 */

const MCP_GRAPH_PREFIX = "mcp__mcp-graph__";

/**
 * Tools that are read-only and should not trigger the lifecycle/code-intel
 * gate. Kept in sync with `src/core/utils/constants.ts:READ_ONLY_TOOLS`.
 */
const MCP_GRAPH_READ_ONLY_TOOLS = new Set<string>([
  "init",
  "set_phase",
  "knowledge",
  "sync_stack_docs",
  "list",
  "show",
  "search",
  "metrics",
  "export",
  "context",
  "analyze",
  "snapshot",
  "next",
  "list_memories",
  "read_memory",
  "manage_skill",
  "stats",
  "velocity",
  "dependencies",
  "plan_sprint",
  "validate",
  "code_intelligence",
  "journey",
]);

export interface PreToolUseInput {
  readonly tool_name: string;
  readonly tool_input?: Record<string, unknown>;
  readonly session_id?: string;
  readonly hook_event_name?: string;
  readonly transcript_path?: string;
}

export interface PreToolUseOutcome {
  readonly detail: Record<string, unknown>;
  readonly exitCode: number;
  readonly stdoutJson?: object;
}

/**
 * Gate-warning shape — narrow contract that mirrors `LifecycleWarning` /
 * `CodeIntelWarning` from src/mcp/unified-gate.ts. Kept minimal so we don't
 * have to track every src-side field.
 */
export interface GateWarning {
  readonly severity: "error" | "warning" | "info";
  readonly message: string;
  readonly code?: string;
}

export interface GateCheckResult {
  readonly allowed: boolean;
  readonly warnings: ReadonlyArray<GateWarning>;
  readonly lifecycleBlock?: { phase?: string };
}

/**
 * Dependency contract for gate evaluation. Production wires this via
 * `lazy-gate.ts` (dynamic import from parent dist/). Tests inject stubs.
 */
export interface GateDeps {
  readonly loadGateContext: (store: unknown) => unknown;
  readonly checkGates: (
    store: unknown,
    toolName: string,
    args: unknown[],
    currentGitHash?: string | null,
    options?: { applyReadOnlySkip?: boolean; skipCodeIntel?: boolean },
  ) => GateCheckResult;
}

export interface EvaluateOptions {
  readonly store?: unknown;
  readonly gateDeps?: GateDeps;
}

/**
 * Decide whether to allow, block, or warn on a tool call. Pure function — no IO.
 *
 * Wave B1 covers filtering only:
 * - non-MCP tools → allow (exit 0)
 * - mcp-graph read-only tools → allow (exit 0)
 * - mutating mcp-graph tools → skeleton marker (B2 will add gate evaluation)
 *
 * Honours `MCP_GRAPH_LEGACY_HOOKS=on` as the escape hatch (mirroring
 * `MCP_GRAPH_LEGACY_TOOLS`): when set, every call short-circuits as filtered.
 */
export function evaluatePreToolUse(
  input: PreToolUseInput | null,
  options: EvaluateOptions = {},
): PreToolUseOutcome {
  if (process.env.MCP_GRAPH_LEGACY_HOOKS === "on") {
    return { detail: { filtered: "legacy_hooks_off" }, exitCode: 0 };
  }

  if (!input) {
    return { detail: { filtered: "no_input" }, exitCode: 0 };
  }

  if (!input.tool_name?.startsWith(MCP_GRAPH_PREFIX)) {
    return {
      detail: { filtered: "non_mcp", tool_name: input.tool_name },
      exitCode: 0,
    };
  }

  const bareTool = input.tool_name.slice(MCP_GRAPH_PREFIX.length);
  if (MCP_GRAPH_READ_ONLY_TOOLS.has(bareTool)) {
    return {
      detail: { filtered: "read_only", tool: bareTool },
      exitCode: 0,
    };
  }

  // Mutating mcp-graph tool. If the dispatcher provided gate dependencies,
  // run real evaluation; otherwise stay in skeleton mode (B1 behaviour) so the
  // hook is informational-only when wiring isn't complete.
  if (options.gateDeps && options.store !== undefined) {
    return evaluateWithGate(bareTool, input.tool_input ?? {}, options.store, options.gateDeps);
  }

  return {
    detail: { skeleton: "gate_eval_pending", tool: bareTool },
    exitCode: 0,
  };
}

function evaluateWithGate(
  bareTool: string,
  toolInput: Record<string, unknown>,
  store: unknown,
  deps: GateDeps,
): PreToolUseOutcome {
  let result: GateCheckResult;
  try {
    result = deps.checkGates(store, bareTool, [toolInput]);
  } catch (err) {
    // Fail-open: never break the user's session because of an infra error.
    return {
      detail: {
        filtered: "gate_error",
        tool: bareTool,
        error: err instanceof Error ? err.message : String(err),
      },
      exitCode: 0,
    };
  }

  if (result.allowed) {
    return {
      detail: {
        allowed: true,
        tool: bareTool,
        warnings_count: result.warnings.length,
        phase: result.lifecycleBlock?.phase ?? null,
      },
      exitCode: 0,
    };
  }

  const errorWarnings = result.warnings.filter((w) => w.severity === "error");
  const reason = errorWarnings.map((w) => w.message).join("; ");
  const phase = result.lifecycleBlock?.phase ?? "unknown";

  return {
    detail: {
      decision: "block",
      tool: bareTool,
      phase,
      reason,
      warnings_count: result.warnings.length,
    },
    exitCode: 2,
    stdoutJson: {
      decision: "block",
      reason,
      systemMessage: `lifecycle_gate_blocked: phase=${phase}, ${reason}`,
    },
  };
}

/**
 * Best-effort parse of stdin payload. Returns null on parse failure (fail-open).
 * The 5ms read budget is enforced by the caller (hook-dispatch).
 */
export function parsePreToolUseStdin(raw: string): PreToolUseInput | null {
  if (!raw || raw.trim() === "") return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.tool_name !== "string") return null;
    return {
      tool_name: obj.tool_name,
      tool_input: typeof obj.tool_input === "object" && obj.tool_input !== null
        ? (obj.tool_input as Record<string, unknown>)
        : undefined,
      session_id: typeof obj.session_id === "string" ? obj.session_id : undefined,
      hook_event_name: typeof obj.hook_event_name === "string" ? obj.hook_event_name : undefined,
      transcript_path: typeof obj.transcript_path === "string" ? obj.transcript_path : undefined,
    };
  } catch {
    return null;
  }
}
