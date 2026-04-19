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

import { describe, it, expect, afterEach } from "vitest";
import {
  registerDaemon,
  unregisterDaemon,
  getDaemonStatus,
} from "../../mcp/daemon/daemon-registry.js";
import type { DaemonRunnerHandle } from "../../mcp/daemon/runner.js";

function stubHandle(count: number): DaemonRunnerHandle {
  let n = count;
  return {
    server: {} as DaemonRunnerHandle["server"],
    clientCount: () => n,
    close: async () => { n = 0; },
  };
}

describe("daemon-registry", () => {
  afterEach(() => {
    unregisterDaemon();
  });

  it("reports inactive when nothing is registered", () => {
    const status = getDaemonStatus();
    expect(status.mode).toBe("inactive");
    expect(status.clientCount).toBeUndefined();
  });

  it("reports daemon mode with live metadata after register", () => {
    const handle = stubHandle(3);
    registerDaemon({
      handle,
      socketPath: "/tmp/test.sock",
      workspacePath: "/tmp/workspace",
      idleShutdownMs: 60_000,
    });

    const status = getDaemonStatus();
    expect(status.mode).toBe("daemon");
    expect(status.clientCount).toBe(3);
    expect(status.socketPath).toBe("/tmp/test.sock");
    expect(status.workspacePath).toBe("/tmp/workspace");
    expect(status.idleShutdownMs).toBe(60_000);
    expect(status.pid).toBe(process.pid);
    expect(typeof status.startedAt).toBe("string");
    expect(status.uptimeSec).toBeGreaterThanOrEqual(0);
  });

  it("reflects live client count changes", () => {
    let n = 0;
    const handle: DaemonRunnerHandle = {
      server: {} as DaemonRunnerHandle["server"],
      clientCount: () => n,
      close: async () => {},
    };
    registerDaemon({ handle, socketPath: "/tmp/x.sock", workspacePath: "/tmp" });

    expect(getDaemonStatus().clientCount).toBe(0);
    n = 5;
    expect(getDaemonStatus().clientCount).toBe(5);
  });

  it("returns to inactive after unregister", () => {
    registerDaemon({
      handle: stubHandle(0),
      socketPath: "/tmp/s.sock",
      workspacePath: "/tmp",
    });
    unregisterDaemon();

    expect(getDaemonStatus().mode).toBe("inactive");
  });

  it("defaults idleShutdownMs to 0 when not provided", () => {
    registerDaemon({
      handle: stubHandle(1),
      socketPath: "/tmp/s.sock",
      workspacePath: "/tmp",
    });
    expect(getDaemonStatus().idleShutdownMs).toBe(0);
  });
});
