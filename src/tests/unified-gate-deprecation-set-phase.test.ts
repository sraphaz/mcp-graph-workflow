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
 * TDD tests for D2 — set_phase advisory deprecation entry.
 *
 * Wave D of the hooks-collapse epic migrates `set_phase` from MCP tool to
 * `mg set-phase` CLI. D1 ships the CLI; D2 (this task) marks the MCP tool
 * advisory-deprecated so callers see a silent warn log signaling the move
 * — no behavior change in the response.
 *
 * Validates:
 * - DEPRECATED_TOOLS has a `set_phase` entry with stage:"advisory",
 *   replacement:"mg set-phase", since:"v11.x", migrationDoc pointing to
 *   the v11-maestro-surface guide.
 * - Calling the wrapped set_phase tool emits the advisory warn log.
 * - The migration doc has a #set_phase section.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import {
  DEPRECATED_TOOLS,
  wrapToolsWithGates,
} from "../mcp/unified-gate.js";
import { registerSetPhase } from "../mcp/tools/set-phase.js";
import { clearLogBuffer, getLogBuffer } from "../core/utils/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationDocPath = resolve(__dirname, "../../docs/_internal/migration/v11-maestro-surface.md");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyServer = any;

interface ToolCallResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

function tools(server: McpServer): Record<string, { handler: (...args: unknown[]) => Promise<unknown> }> {
  return (server as AnyServer)._registeredTools;
}

describe("D2 — set_phase advisory deprecation entry", () => {
  it("DEPRECATED_TOOLS has a set_phase entry with stage=advisory pointing to `mg set-phase`", () => {
    const entry = DEPRECATED_TOOLS["set_phase"];
    expect(entry).toBeDefined();
    expect(entry!.stage).toBe("advisory");
    expect(entry!.replacement).toBe("mg set-phase");
    expect(entry!.since).toBe("v11.x");
    expect(entry!.migrationDoc).toContain("docs/_internal/migration/v11-maestro-surface.md");
  });

  describe("integration — calling set_phase emits the advisory warn log", () => {
    let store: SqliteStore;
    let server: McpServer;

    beforeEach(() => {
      store = SqliteStore.open(":memory:");
      store.initProject("Test");
      server = new McpServer(
        { name: "test", version: "1.0.0" },
        { capabilities: { tools: {} } },
      );
      registerSetPhase(server, store);
      wrapToolsWithGates(server, store);
      clearLogBuffer();
    });

    afterEach(() => {
      store.close();
    });

    it("calling set_phase emits the advisory warn log AND the response is unchanged (still has ok=true)", async () => {
      const result = (await tools(server)["set_phase"].handler({ phase: "auto" })) as ToolCallResult;

      expect(result.isError).toBeFalsy();
      // Original response payload is preserved (set_phase still works)
      const payload = JSON.parse(result.content[0].text);
      expect(payload.ok).toBe(true);

      // Advisory warn log emitted with tool=set_phase
      const warnLogs = getLogBuffer().filter(
        (e) => e.level === "warn" && /deprecated tool called \(advisory\)/i.test(e.message),
      );
      const setPhaseLogs = warnLogs.filter((e) => e.context && e.context.tool === "set_phase");
      expect(setPhaseLogs.length).toBeGreaterThan(0);
    });

    it("response does NOT include _deprecation_notice (advisory stage is silent in the response)", async () => {
      const result = (await tools(server)["set_phase"].handler({ phase: "auto" })) as ToolCallResult;
      const hasNotice = result.content.some(
        (c) => c.text && c.text.includes("_deprecation_notice"),
      );
      expect(hasNotice).toBe(false);
    });
  });

  describe("migration doc — has a #set_phase section", () => {
    it("docs/_internal/migration/v11-maestro-surface.md exists and references set_phase → mg set-phase", () => {
      expect(existsSync(migrationDocPath)).toBe(true);
      const doc = readFileSync(migrationDocPath, "utf-8");
      // Either as a heading or a TL;DR table row, the migration must name
      // both the deprecated tool and the replacement.
      expect(doc).toMatch(/set_phase/);
      expect(doc).toMatch(/mg set-phase/);
    });

    it("migration doc has a heading or anchor #set_phase that the migrationDoc URL fragment points to", () => {
      const doc = readFileSync(migrationDocPath, "utf-8");
      // GitHub auto-generates anchors from headings: `## set_phase` → `#set_phase`.
      // Accept any heading whose slug would render as `#set_phase`.
      const hasMatchingHeading = /^#{1,6}\s+.*set_phase/m.test(doc);
      expect(hasMatchingHeading).toBe(true);
    });
  });
});
