/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/**
 * Minimal structured JSONL logger.
 *
 * Sprint 7.6 will extend this with redaction, async batching, rotation,
 * and a richer query surface (`mcp-graph log`). For Sprint 7.5 we ship just enough
 * to get hooks emitting consistently-shaped events to:
 *   ~/.mcp-graph/logs/<sink>.jsonl
 *
 * Synchronous append: hooks fire short bursts and we want the line on disk
 * before the hook returns. Once Sprint 7.6 lands its async sink + flush
 * semantics, callers will migrate without API changes.
 */

export type LogSource =
  | "cli"
  | "hook"
  | "mcp"
  | "agent"
  | "graph"
  | "bridge";

export type LogLevel = "info" | "warn" | "error";

export type LogOutcome = "ok" | "warn" | "error";

export interface LogEntry {
  readonly ts?: string;
  readonly level?: LogLevel;
  readonly source: LogSource;
  readonly actor?: string;
  readonly action: string;
  readonly target?: { type: string; id?: string };
  readonly duration_ms?: number;
  readonly outcome?: LogOutcome;
  readonly ctx?: Record<string, unknown>;
  readonly trace_id?: string;
}

const REDACTION_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/ghu_[A-Za-z0-9]{20,}/g, "<REDACTED:gh-user-token>"],
  [/ghs_[A-Za-z0-9]{20,}/g, "<REDACTED:gh-session-token>"],
  [/gho_[A-Za-z0-9]{20,}/g, "<REDACTED:gh-oauth-token>"],
  [/ghp_[A-Za-z0-9]{20,}/g, "<REDACTED:gh-pat>"],
  [/sk-ant-[A-Za-z0-9-_]{20,}/g, "<REDACTED:anthropic-key>"],
  [/sk-[A-Za-z0-9]{20,}/g, "<REDACTED:openai-key>"],
  [/Bearer [A-Za-z0-9._-]{12,}/g, "Bearer <REDACTED>"],
  [/tid=[^;\s]+/g, "tid=<REDACTED>"],
];

export function logsRoot(): string {
  return join(homedir(), ".mcp-graph", "logs");
}

export function logsPath(sink: "cli" | "hooks" | "events"): string {
  return join(logsRoot(), `${sink}.jsonl`);
}

export function redact(value: string): string {
  let out = value;
  for (const [pattern, replacement] of REDACTION_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export function logEvent(
  sink: "cli" | "hooks" | "events",
  entry: LogEntry,
): void {
  const enriched: LogEntry = {
    ts: entry.ts ?? new Date().toISOString(),
    level: entry.level ?? "info",
    ...entry,
  };

  const line = redact(JSON.stringify(enriched));
  const path = logsPath(sink);
  try {
    if (!existsSync(dirname(path))) {
      mkdirSync(dirname(path), { recursive: true });
    }
    appendFileSync(path, `${line}\n`, "utf8");
  } catch {
    // best-effort: never throw from the logger
  }
}

/**
 * Sprint 7.5 #7.5.10 — group entries from hooks.jsonl by action, returning
 * per-action last-fire + last-error timestamps with counts. `mcp-graph hooks status`
 * uses this to render a regression-aware row alongside listInstalledHooks().
 * Only reads the hooks sink. Returns `{}` when the file is missing or
 * unreadable — never throws.
 */
export interface HookActivity {
  readonly lastFire?: string;
  readonly lastError?: string;
  readonly fireCount: number;
  readonly errorCount: number;
}

export function summarizeHookActivity(): Record<string, HookActivity> {
  const path = logsPath("hooks");
  if (!existsSync(path)) return {};
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return {};
  }
  const acc: Record<string, HookActivity & { lastFire?: string; lastError?: string }> = {};
  for (const line of raw.split("\n")) {
    if (line.length === 0) continue;
    let entry: LogEntry;
    try {
      entry = JSON.parse(line) as LogEntry;
    } catch {
      continue;
    }
    if (entry.source !== "hook") continue;
    const a = entry.action;
    if (!a) continue;
    const prev = acc[a] ?? { fireCount: 0, errorCount: 0 };
    const next: HookActivity & { lastFire?: string; lastError?: string } = {
      fireCount: prev.fireCount + 1,
      errorCount: prev.errorCount + (entry.outcome === "error" ? 1 : 0),
      lastFire:
        entry.ts && (prev.lastFire === undefined || entry.ts > prev.lastFire)
          ? entry.ts
          : prev.lastFire,
      lastError:
        entry.outcome === "error" && entry.ts && (prev.lastError === undefined || entry.ts > prev.lastError)
          ? entry.ts
          : prev.lastError,
    };
    acc[a] = next;
  }
  return acc;
}
