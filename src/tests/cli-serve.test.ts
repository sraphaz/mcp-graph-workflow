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

import { describe, it, expect, vi, afterEach } from "vitest";
import { serveCommand } from "../cli/commands/serve.js";

describe("serveCommand", () => {
  const originalPort = process.env.MCP_PORT;

  afterEach(() => {
    if (originalPort !== undefined) {
      process.env.MCP_PORT = originalPort;
    } else {
      delete process.env.MCP_PORT;
    }
  });

  it("should return a Command with name 'serve'", () => {
    const cmd = serveCommand();

    expect(cmd.name()).toBe("serve");
    expect(cmd.description()).toContain("dashboard");
  });

  it("should have default port 3000", () => {
    const cmd = serveCommand();
    const _portOption = cmd.opts();

    // Before parsing, opts returns defaults from option definition
    // The default is set via Commander option string "3000"
    expect(cmd.getOptionValue("port")).toBe("3000");
  });

  it("should set process.env.MCP_PORT on valid port", async () => {
    const cmd = serveCommand();

    // Mock the dynamic import to prevent actual server startup
    vi.doMock("../mcp/server.js", () => ({}));

    // Parse with a valid port
    cmd.exitOverride(); // Prevent process.exit
    try {
      await cmd.parseAsync(["node", "serve", "--port", "4567"]);
    } catch {
      // Dynamic import may fail in test env, that's OK
    }

    expect(process.env.MCP_PORT).toBe("4567");
  });

  it("should reject invalid port with exit", async () => {
    const cmd = serveCommand();
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    cmd.exitOverride();

    // NaN port
    await expect(async () => {
      await cmd.parseAsync(["node", "serve", "--port", "abc"]);
    }).rejects.toThrow();

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});
