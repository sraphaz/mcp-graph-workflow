/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importContinueSettings } from "../core/hooks/providers/continue.js";
import { importClineSettings } from "../core/hooks/providers/cline.js";

describe("providers/continue.ts — minimal MCP-bridge import", () => {
  let tmp: string;

  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "mcp-continue-")); });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("returns 0 imported + reports MCP server names", () => {
    const path = join(tmp, "config.json");
    writeFileSync(path, JSON.stringify({
      mcpServers: { "mcp-graph": {}, "filesystem": {} },
    }));
    const result = importContinueSettings({ source: path });
    expect(result.imported).toHaveLength(0);
    expect(result.provider).toBe("continue");
    expect(result.mcpServers.sort()).toEqual(["filesystem", "mcp-graph"]);
    expect(result.skipped[0].reason).toMatch(/no hook lifecycle/);
  });

  it("returns empty mcpServers when none configured", () => {
    const path = join(tmp, "config.json");
    writeFileSync(path, JSON.stringify({}));
    const result = importContinueSettings({ source: path });
    expect(result.mcpServers).toEqual([]);
  });

  it("returns skip reason when source missing", () => {
    const result = importContinueSettings({ source: join(tmp, "nope.json") });
    expect(result.imported).toEqual([]);
    expect(result.skipped[0].reason).toMatch(/not found/);
  });
});

describe("providers/cline.ts — VS Code settings bridge", () => {
  let tmp: string;

  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "mcp-cline-")); });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("reports MCP servers configured under cline.mcpServers", () => {
    const path = join(tmp, "settings.json");
    writeFileSync(path, JSON.stringify({
      "cline.mcpServers": { "mcp-graph": {}, "github": {} },
      "editor.fontSize": 14,
    }));
    const result = importClineSettings({ source: path });
    expect(result.imported).toHaveLength(0);
    expect(result.provider).toBe("cline");
    expect(result.mcpServers.sort()).toEqual(["github", "mcp-graph"]);
  });

  it("tolerates VS Code JSON-with-comments and trailing commas", () => {
    const path = join(tmp, "settings.json");
    writeFileSync(path, `{
  // user settings
  "editor.fontSize": 14,
  "cline.mcpServers": {
    "mcp-graph": {},
  },
}`);
    const result = importClineSettings({ source: path });
    expect(result.mcpServers).toEqual(["mcp-graph"]);
  });

  it("returns empty + reason when source missing", () => {
    const result = importClineSettings({ source: join(tmp, "nope.json") });
    expect(result.imported).toEqual([]);
    expect(result.mcpServers).toEqual([]);
    expect(result.skipped[0].reason).toMatch(/not found/);
  });
});
