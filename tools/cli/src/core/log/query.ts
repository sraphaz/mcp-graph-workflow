/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { existsSync, readFileSync } from "node:fs";
import { logsPath, type LogEntry } from "./structured-logger.js";

export interface LogQueryOptions {
  readonly sink?: "cli" | "hooks" | "events" | "all";
  readonly limit?: number;
  readonly level?: "info" | "warn" | "error";
  readonly action?: string; // exact match on action name
  readonly traceId?: string;
  readonly task?: string; // matches target.id
  readonly hook?: string; // matches action when source=hook
  readonly since?: string; // ISO duration like "1h", "30m", "1d"
}

export interface LogQueryResult {
  readonly entries: ReadonlyArray<LogEntry>;
  readonly read: number;
  readonly matched: number;
}

const DEFAULT_LIMIT = 50;

export function queryLogs(opts: LogQueryOptions = {}): LogQueryResult {
  const sinks =
    opts.sink === "all" || !opts.sink
      ? (["cli", "hooks", "events"] as const)
      : [opts.sink];

  const sinceMs = parseSince(opts.since);
  const cutoff = sinceMs !== null ? Date.now() - sinceMs : null;

  const allLines: string[] = [];
  for (const sink of sinks) {
    const path = logsPath(sink);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf8");
    for (const line of content.split("\n")) {
      if (line.length > 0) allLines.push(line);
    }
  }

  const limit = opts.limit ?? DEFAULT_LIMIT;
  const matches: LogEntry[] = [];
  let read = 0;
  // Walk from newest to oldest.
  for (let i = allLines.length - 1; i >= 0; i--) {
    read++;
    let entry: LogEntry;
    try {
      entry = JSON.parse(allLines[i]) as LogEntry;
    } catch {
      continue;
    }

    if (opts.level && entry.level !== opts.level) continue;
    if (opts.action && entry.action !== opts.action) continue;
    if (opts.traceId && entry.trace_id !== opts.traceId) continue;
    if (opts.hook && (entry.source !== "hook" || entry.action !== opts.hook))
      continue;
    if (opts.task) {
      const target = entry.target;
      if (!target || target.id !== opts.task) continue;
    }
    if (cutoff !== null && entry.ts) {
      const ts = Date.parse(entry.ts);
      if (Number.isNaN(ts) || ts < cutoff) continue;
    }

    matches.push(entry);
    if (matches.length >= limit) break;
  }

  return {
    entries: matches,
    read,
    matched: matches.length,
  };
}

function parseSince(value: string | undefined): number | null {
  if (!value) return null;
  const m = /^(\d+)\s*([smhd])$/.exec(value.trim());
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  const unit = m[2];
  switch (unit) {
    case "s":
      return n * 1000;
    case "m":
      return n * 60 * 1000;
    case "h":
      return n * 60 * 60 * 1000;
    case "d":
      return n * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}
