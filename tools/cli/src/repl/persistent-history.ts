/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Sprint 7 #7.12 — persistent REPL history.
 *
 * Stored at `~/.mcp-graph/repl-history` as one raw command per line.
 * Read on REPL start, appended on each command submission. Capped at
 * MAX_ENTRIES so the file never grows unbounded; older entries fall
 * off the front when the cap is exceeded on read. Synchronous I/O is
 * fine here — the file is small (< 50KB even at the cap) and we want
 * the entry on disk before the REPL prompt re-renders.
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const MAX_ENTRIES = 1000;

export function historyPath(): string {
  return join(homedir(), ".mcp-graph", "repl-history");
}

/**
 * Load the persisted history. Returns the last MAX_ENTRIES lines in
 * chronological order (oldest first) — the REPL navigates from
 * newest-on-up to oldest-on-up after that.
 */
export function loadHistory(): string[] {
  const path = historyPath();
  if (!existsSync(path)) return [];
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return [];
  }
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length > MAX_ENTRIES) {
    return lines.slice(-MAX_ENTRIES);
  }
  return lines;
}

/**
 * Append one entry to the history file. Best-effort: never throws.
 * Skipped when `entry` is empty or matches the immediately-prior
 * appended line (cheap dedup so up-arrow scroll doesn't bloat the
 * file when the user repeats the previous command).
 */
export function appendHistory(entry: string, lastAppended?: string): void {
  const trimmed = entry.trim();
  if (trimmed.length === 0) return;
  if (lastAppended && trimmed === lastAppended) return;
  const path = historyPath();
  try {
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(path, `${trimmed}\n`, "utf8");
  } catch {
    // best-effort; never break the REPL
  }
}

/**
 * Truncate the file to the last MAX_ENTRIES lines. Called on demand by
 * the REPL bootstrap when the on-disk file already exceeds the cap, so
 * subsequent appends stay within budget. Best-effort.
 */
export function compactHistory(): void {
  const path = historyPath();
  if (!existsSync(path)) return;
  try {
    const raw = readFileSync(path, "utf8");
    const lines = raw.split("\n").filter((l) => l.length > 0);
    if (lines.length <= MAX_ENTRIES) return;
    const kept = lines.slice(-MAX_ENTRIES);
    writeFileSync(path, `${kept.join("\n")}\n`, "utf8");
  } catch {
    // best-effort
  }
}
