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

import { describe, it, expect } from "vitest";

import { whichCommand, killProcess, IS_WINDOWS } from "../core/utils/platform.js";

describe("cross-platform utilities (runtime OS)", () => {
  describe("whichCommand", () => {
    it("should return the correct command for the current OS", () => {
      const cmd = whichCommand();
      if (process.platform === "win32") {
        expect(cmd).toBe("where");
      } else {
        expect(cmd).toBe("which");
      }
    });

    it("should return a non-empty string", () => {
      expect(whichCommand().length).toBeGreaterThan(0);
    });
  });

  describe("IS_WINDOWS", () => {
    it("should match process.platform", () => {
      expect(IS_WINDOWS).toBe(process.platform === "win32");
    });
  });

  describe("killProcess", () => {
    it("should not throw for null input", () => {
      expect(() => killProcess(null as unknown as import("node:child_process").ChildProcess)).not.toThrow();
    });

    it("should not throw for already-killed process", () => {
      const mockProc = { killed: true, pid: 1 } as unknown as import("node:child_process").ChildProcess;
      expect(() => killProcess(mockProc)).not.toThrow();
    });

    it("should handle process without pid gracefully on Windows scenario", () => {
      // On non-Windows this exercises the SIGTERM path
      const killFn = (): void => { /* no-op */ };
      const mockProc = {
        killed: false,
        pid: undefined,
        kill: killFn,
      } as unknown as import("node:child_process").ChildProcess;

      // Should not throw regardless of platform
      expect(() => killProcess(mockProc)).not.toThrow();
    });
  });
});
