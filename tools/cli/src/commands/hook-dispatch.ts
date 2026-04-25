/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { logEvent } from "../core/log/structured-logger.js";
import { getStore } from "../core/lazy-store.js";
import { getGateDeps } from "../core/lazy-gate.js";
import { detectConfigDrift } from "../core/hooks/install.js";
import {
  evaluatePreToolUse,
  parsePreToolUseStdin,
  type PreToolUseOutcome,
} from "./pre-tool-use.js";
import type {
  CommandHandlerArgs,
  CommandHandlerResult,
} from "./registry.js";

/**
 * `mg hook <name>` — internal dispatcher invoked by Claude Code hook entries.
 *
 * Each handler is non-blocking, fail-silent, and emits a structured event to
 * `~/.mcp-graph/logs/hooks.jsonl`. Claude Code passes hook context as JSON on
 * stdin; we read it best-effort but never wait on it (5ms tick).
 *
 * Sprint 7.5 ships skeleton handlers + structured emission. Sprint 7.6
 * extends each with the real workflow integration (harness scan diff,
 * phase auto-advance, AC validation chain, etc.).
 */

const HOOKS_OFF = process.env.MCP_GRAPH_HOOKS_OFF === "1";

export async function runHookDispatch(
  ctx: CommandHandlerArgs,
): Promise<CommandHandlerResult> {
  if (HOOKS_OFF) {
    return { exitCode: 0 };
  }

  const name = ctx.args[0];
  if (!name) {
    return {
      exitCode: 2,
      text: "internal: mg hook <name> — name required",
    };
  }

  const start = Date.now();
  let outcome: "ok" | "warn" | "error" = "ok";
  let detail: Record<string, unknown> = {};
  let exitCode = 0;
  let stdoutJson: object | undefined;

  try {
    const result = await dispatch(name);
    detail = result.detail;
    if (result.exitCode !== undefined) {
      exitCode = result.exitCode;
    }
    if (result.stdoutJson !== undefined) {
      stdoutJson = result.stdoutJson;
    }
  } catch (err) {
    outcome = "error";
    detail = { error: err instanceof Error ? err.message : String(err) };
  }

  logEvent("hooks", {
    source: "hook",
    actor: "claude-code",
    action: name,
    duration_ms: Date.now() - start,
    outcome,
    ctx: detail,
    trace_id: ctx.traceId,
  });

  // Default: hooks exit 0 to never break the user's session. The pre-tool-use
  // hook is the documented exception — it can request exit 2 + stdout JSON to
  // signal a block decision to Claude Code.
  if (stdoutJson !== undefined) {
    process.stdout.write(`${JSON.stringify(stdoutJson)}\n`);
  }
  return { exitCode };
}

interface DispatchResult {
  detail: Record<string, unknown>;
  exitCode?: number;
  stdoutJson?: object;
}

async function dispatch(name: string): Promise<DispatchResult> {
  switch (name) {
    case "session-start":
      return { detail: await handleSessionStart() };
    case "session-stop":
      return { detail: await handleSessionStop() };
    case "post-edit":
      return { detail: await handlePostEdit() };
    case "post-bash":
      return { detail: await handlePostBash() };
    case "post-finish-task":
      return { detail: await handlePostFinishTask() };
    case "pre-prompt":
      return { detail: await handlePrePrompt() };
    case "pre-tool-use":
      return await handlePreToolUse();
    default:
      return { detail: { unknown_hook: name } };
  }
}

async function handleSessionStart(): Promise<Record<string, unknown>> {
  // Sprint 7.4 #7.4.10 — config drift check.
  // Sprint 7.5 #7.5.6 — adds the 1-line `summary` string so Claude Code can
  // print a single-line health row at session boot regardless of drift state.
  // Fail-silent: any infra error keeps the session usable.
  let drift: ReturnType<typeof detectConfigDrift>;
  try {
    drift = detectConfigDrift(process.cwd());
  } catch {
    return {
      drift: "unknown",
      reason: "drift_check_failed",
      summary: "mg: drift check failed (session continues)",
    };
  }
  // Sprint 7.6 will add: project name, sprint progress, harness score,
  // bridge auth. For now the summary is anchored on drift state.
  if (drift.status === "stale") {
    return {
      drift: "stale",
      currentVersion: drift.currentVersion,
      installedVersion: drift.installedVersion,
      installedProfile: drift.installedProfile,
      hint: drift.hint,
      message: `mg hooks config is out of date (installed ${drift.installedVersion} vs current ${drift.currentVersion}). Re-run \`${drift.hint}\` to refresh.`,
      summary: `mg: hooks stale (${drift.installedVersion} → ${drift.currentVersion}) — \`${drift.hint}\``,
    };
  }
  return {
    drift: drift.status,
    currentVersion: drift.currentVersion,
    summary:
      drift.status === "ok"
        ? `mg: hooks ok @ ${drift.currentVersion}${drift.installedProfile ? ` (${drift.installedProfile})` : ""}`
        : "mg: hooks not installed — run `mg hooks install`",
  };
}

async function handleSessionStop(): Promise<Record<string, unknown>> {
  return { todo: "session-stop snapshot deferred to Sprint 7.6" };
}

async function handlePostEdit(): Promise<Record<string, unknown>> {
  // Sprint 7.6 will trigger an incremental harness scan on the edited files.
  return { todo: "post-edit harness scan deferred to Sprint 7.6" };
}

async function handlePostBash(): Promise<Record<string, unknown>> {
  return { todo: "post-bash phase advance deferred to Sprint 7.6" };
}

async function handlePostFinishTask(): Promise<Record<string, unknown>> {
  // Will chain validate(ac) + analyze(implement_done) + suggest next.
  return { todo: "post-finish-task chain deferred to Sprint 7.6" };
}

async function handlePrePrompt(): Promise<Record<string, unknown>> {
  return { todo: "pre-prompt context preload deferred to Sprint 7.6" };
}

async function handlePreToolUse(): Promise<DispatchResult> {
  // Best-effort stdin read with a 50ms budget. Claude Code writes the hook
  // payload before invoking us; if we get nothing, fail-open (filtered:no_input).
  const raw = await readStdinWithTimeout(50);
  const input = parsePreToolUseStdin(raw);

  // Load store + gate primitives lazily. Both are wrapped in try/catch so any
  // infra failure (missing dist/, locked DB, missing project) becomes a
  // fail-open path — the hook never breaks the user's session due to wiring
  // problems. The wrapper inside the MCP server still gates by default until
  // MCP_GRAPH_GATES_IN_HOOKS=on flips the responsibility.
  let store: unknown;
  let gateDeps: Awaited<ReturnType<typeof getGateDeps>> | undefined;
  try {
    [store, gateDeps] = await Promise.all([getStore(), getGateDeps()]);
  } catch {
    // No deps → evaluatePreToolUse falls through to skeleton fallback.
  }

  const outcome: PreToolUseOutcome = evaluatePreToolUse(input, {
    store,
    gateDeps,
  });
  return {
    detail: outcome.detail,
    exitCode: outcome.exitCode,
    stdoutJson: outcome.stdoutJson,
  };
}

function readStdinWithTimeout(timeoutMs: number): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }

    let buf = "";
    let settled = false;
    const settle = (value: string): void => {
      if (settled) return;
      settled = true;
      process.stdin.removeAllListeners("data");
      process.stdin.removeAllListeners("end");
      process.stdin.removeAllListeners("error");
      resolve(value);
    };

    const timer = setTimeout(() => settle(buf), timeoutMs);

    process.stdin.on("data", (chunk: Buffer) => {
      buf += chunk.toString("utf8");
    });
    process.stdin.on("end", () => {
      clearTimeout(timer);
      settle(buf);
    });
    process.stdin.on("error", () => {
      clearTimeout(timer);
      settle("");
    });
  });
}
