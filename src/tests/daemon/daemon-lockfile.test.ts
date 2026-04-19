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

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkLock, acquireLock, releaseLock } from "../../core/daemon/daemon-lockfile.js";
import { McpGraphError } from "../../core/utils/errors.js";

function tempPidFile(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-graph-lock-"));
  return path.join(dir, "daemon.pid");
}

describe("checkLock", () => {
  let pidFile: string;

  beforeEach(() => {
    pidFile = tempPidFile();
  });

  afterEach(() => {
    try { fs.unlinkSync(pidFile); } catch { /* ignore */ }
    try { fs.rmdirSync(path.dirname(pidFile)); } catch { /* ignore */ }
  });

  it("reports alive=false when no pidfile exists", () => {
    expect(checkLock(pidFile)).toEqual({ alive: false });
  });

  it("reports alive=true when pidfile contains a live PID", () => {
    fs.writeFileSync(pidFile, String(process.pid));
    const state = checkLock(pidFile);
    expect(state.alive).toBe(true);
    expect(state.pid).toBe(process.pid);
  });

  it("reports stale=true when pidfile references a dead process", () => {
    // 0x7fffffff is unlikely to be a real PID on any modern kernel.
    fs.writeFileSync(pidFile, "2147483647");
    const state = checkLock(pidFile);
    expect(state.alive).toBe(false);
    expect(state.stale).toBe(true);
  });

  it("reports stale=true when pidfile contents are not numeric", () => {
    fs.writeFileSync(pidFile, "not-a-pid");
    const state = checkLock(pidFile);
    expect(state.alive).toBe(false);
    expect(state.stale).toBe(true);
  });
});

describe("acquireLock / releaseLock", () => {
  let pidFile: string;

  beforeEach(() => {
    pidFile = tempPidFile();
  });

  afterEach(() => {
    try { fs.unlinkSync(pidFile); } catch { /* ignore */ }
    try { fs.rmdirSync(path.dirname(pidFile)); } catch { /* ignore */ }
  });

  it("creates a pidfile with the current PID", () => {
    acquireLock(pidFile);
    expect(fs.readFileSync(pidFile, "utf8").trim()).toBe(String(process.pid));
  });

  it("throws when another live daemon already holds the lock", () => {
    // Simulate a sibling daemon by writing a PID we know is alive (this one).
    // We cannot re-acquire our own lock — that would be a race.
    fs.writeFileSync(pidFile, String(process.pid));
    expect(() => acquireLock(pidFile)).toThrow(McpGraphError);
  });

  it("reclaims a stale pidfile", () => {
    fs.writeFileSync(pidFile, "2147483647");
    acquireLock(pidFile);
    expect(fs.readFileSync(pidFile, "utf8").trim()).toBe(String(process.pid));
  });

  it("releaseLock removes the pidfile", () => {
    acquireLock(pidFile);
    releaseLock(pidFile);
    expect(fs.existsSync(pidFile)).toBe(false);
  });

  it("releaseLock is a no-op when the pidfile is already gone", () => {
    expect(() => releaseLock(pidFile)).not.toThrow();
  });
});
