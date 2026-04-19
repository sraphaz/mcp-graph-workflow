/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

/**
 * Pidfile-based liveness check for the mcp-graph daemon.
 *
 * We use the classic `kill(pid, 0)` probe: signal 0 performs the error checks
 * for sending a signal but delivers nothing, so it is a cheap "is this PID
 * alive?" test supported on POSIX and Windows (Node maps it internally).
 *
 * Strategy:
 *   - acquireLock: read existing pidfile → alive? refuse. stale? replace.
 *     Write our PID with `wx` (exclusive create) to catch races; if that
 *     fails we re-check once to distinguish "another daemon won the race"
 *     from "leftover stale file we must overwrite".
 *   - releaseLock: unlink, tolerate ENOENT.
 */

import fs from "node:fs";
import { McpGraphError } from "../utils/errors.js";

export interface LockState {
  /** True iff a process with the recorded PID is currently alive. */
  alive: boolean;
  /** PID read from the file, if any. Undefined when the file is missing. */
  pid?: number;
  /**
   * True when a pidfile exists but the process it names is gone — safe to
   * reclaim.
   */
  stale?: boolean;
}

/** Inspect the pidfile without mutating anything. */
export function checkLock(pidFile: string): LockState {
  let raw: string;
  try {
    raw = fs.readFileSync(pidFile, "utf8");
  } catch {
    return { alive: false };
  }

  const pid = parseInt(raw.trim(), 10);
  if (!Number.isFinite(pid) || pid <= 0) {
    return { alive: false, stale: true };
  }

  try {
    process.kill(pid, 0);
    return { alive: true, pid };
  } catch {
    return { alive: false, pid, stale: true };
  }
}

/**
 * Acquire the lock for the current process. Throws `McpGraphError` if a live
 * daemon already holds it. Stale pidfiles are reclaimed automatically.
 */
export function acquireLock(pidFile: string): void {
  const state = checkLock(pidFile);
  if (state.alive) {
    throw new McpGraphError(`Daemon already running (pid=${state.pid})`);
  }
  if (state.stale) {
    try {
      fs.unlinkSync(pidFile);
    } catch {
      /* ignore — may have vanished between check and unlink */
    }
  }

  try {
    fs.writeFileSync(pidFile, String(process.pid), { flag: "wx" });
    return;
  } catch {
    // Race: another daemon may have acquired between the check and write.
    const recheck = checkLock(pidFile);
    if (recheck.alive) {
      throw new McpGraphError(`Daemon already running (pid=${recheck.pid})`);
    }
    // Leftover from a crash in the same millisecond — force-overwrite.
    fs.writeFileSync(pidFile, String(process.pid));
  }
}

/** Remove the pidfile. Tolerates already-missing files. */
export function releaseLock(pidFile: string): void {
  try {
    fs.unlinkSync(pidFile);
  } catch {
    /* no-op */
  }
}
