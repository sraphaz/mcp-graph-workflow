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
 * TDD tests for DEPRECATED_TOOLS infrastructure in unified-gate.ts (Task 5.1).
 *
 * Validates ACs:
 * - GIVEN tool em advisory WHEN chamada THEN executa normal mas log emit warning
 * - GIVEN tool em warning WHEN chamada THEN response inclui campo _deprecation_notice
 * - GIVEN tool em removed WHEN chamada THEN retorna erro estruturado com replacement
 * - GIVEN MCP_GRAPH_LEGACY_TOOLS=on WHEN setado THEN re-habilita tools removidas em advisory
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import {
  DEPRECATED_TOOLS,
  buildDeprecationNotice,
  buildRemovedToolError,
  getDeprecationEntry,
  isLegacyToolsModeEnabled,
  resolveEffectiveStage,
  wrapToolsWithGates,
  type DeprecationEntry,
  type DeprecationStage,
} from "../mcp/unified-gate.js";
import { clearLogBuffer, getLogBuffer } from "../core/utils/logger.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyServer = any;

interface ToolCallResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

function createServer(): McpServer {
  return new McpServer(
    { name: "test", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );
}

function tools(server: McpServer): Record<string, { handler: (...args: unknown[]) => Promise<unknown> }> {
  return (server as AnyServer)._registeredTools;
}

function setEnv(key: string, value: string | undefined): string | undefined {
  const prev = process.env[key];
  if (value === undefined) Reflect.deleteProperty(process.env, key);
  else process.env[key] = value;
  return prev;
}

// ── Pure helpers ────────────────────────────────────────────

describe("getDeprecationEntry", () => {
  afterEach(() => {
    delete DEPRECATED_TOOLS["__test_tool__"];
  });

  it("returns undefined for tools not in the map", () => {
    expect(getDeprecationEntry("tool_not_in_map_xyz")).toBeUndefined();
  });

  it("returns the entry when tool is registered as deprecated", () => {
    DEPRECATED_TOOLS["__test_tool__"] = { stage: "advisory", replacement: "new_tool" };
    const entry = getDeprecationEntry("__test_tool__");
    expect(entry).toBeDefined();
    expect(entry!.stage).toBe("advisory");
    expect(entry!.replacement).toBe("new_tool");
  });
});

describe("isLegacyToolsModeEnabled", () => {
  it("returns true when MCP_GRAPH_LEGACY_TOOLS=on", () => {
    expect(isLegacyToolsModeEnabled({ MCP_GRAPH_LEGACY_TOOLS: "on" })).toBe(true);
  });

  it("returns false when MCP_GRAPH_LEGACY_TOOLS is unset", () => {
    expect(isLegacyToolsModeEnabled({})).toBe(false);
  });

  it("returns false for any value other than 'on'", () => {
    expect(isLegacyToolsModeEnabled({ MCP_GRAPH_LEGACY_TOOLS: "true" })).toBe(false);
    expect(isLegacyToolsModeEnabled({ MCP_GRAPH_LEGACY_TOOLS: "1" })).toBe(false);
    expect(isLegacyToolsModeEnabled({ MCP_GRAPH_LEGACY_TOOLS: "off" })).toBe(false);
  });
});

describe("resolveEffectiveStage", () => {
  const advisoryEntry: DeprecationEntry = { stage: "advisory" };
  const warningEntry: DeprecationEntry = { stage: "warning" };
  const removedEntry: DeprecationEntry = { stage: "removed", replacement: "alt" };

  it("returns the original stage when legacy mode is off", () => {
    expect(resolveEffectiveStage(advisoryEntry, {})).toBe("advisory");
    expect(resolveEffectiveStage(warningEntry, {})).toBe("warning");
    expect(resolveEffectiveStage(removedEntry, {})).toBe("removed");
  });

  it("downgrades 'removed' to 'advisory' when MCP_GRAPH_LEGACY_TOOLS=on", () => {
    expect(resolveEffectiveStage(removedEntry, { MCP_GRAPH_LEGACY_TOOLS: "on" })).toBe("advisory");
  });

  it("does NOT change advisory or warning when legacy mode is on", () => {
    expect(resolveEffectiveStage(advisoryEntry, { MCP_GRAPH_LEGACY_TOOLS: "on" })).toBe("advisory");
    expect(resolveEffectiveStage(warningEntry, { MCP_GRAPH_LEGACY_TOOLS: "on" })).toBe("warning");
  });
});

describe("buildDeprecationNotice", () => {
  it("includes tool name and stage", () => {
    const notice = buildDeprecationNotice("old_tool", { stage: "warning" });
    expect(notice.tool).toBe("old_tool");
    expect(notice.stage).toBe("warning");
  });

  it("includes replacement, migrationDoc, reason, and since when present", () => {
    const notice = buildDeprecationNotice("old_tool", {
      stage: "warning",
      replacement: "new_tool",
      migrationDoc: "docs/_internal/migration/v11-maestro-surface.md",
      reason: "consolidated into new_tool",
      since: "v11.0.0",
    });
    expect(notice.replacement).toBe("new_tool");
    expect(notice.migrationDoc).toBe("docs/_internal/migration/v11-maestro-surface.md");
    expect(notice.reason).toBe("consolidated into new_tool");
    expect(notice.since).toBe("v11.0.0");
  });

  it("omits optional fields when not provided", () => {
    const notice = buildDeprecationNotice("old_tool", { stage: "advisory" });
    expect(notice.replacement).toBeUndefined();
    expect(notice.migrationDoc).toBeUndefined();
    expect(notice.reason).toBeUndefined();
    expect(notice.since).toBeUndefined();
  });
});

describe("buildRemovedToolError", () => {
  it("returns isError=true with tool_removed error code", () => {
    const result = buildRemovedToolError("removed_tool", { stage: "removed", replacement: "new_tool" });
    expect(result.isError).toBe(true);
    expect(result.content).toBeDefined();
    expect(result.content!.length).toBe(1);
    const payload = JSON.parse(result.content![0].text!);
    expect(payload.error).toBe("tool_removed");
    expect(payload.tool).toBe("removed_tool");
    expect(payload.replacement).toBe("new_tool");
  });

  it("includes hint mentioning MCP_GRAPH_LEGACY_TOOLS escape hatch", () => {
    const result = buildRemovedToolError("removed_tool", { stage: "removed", replacement: "new_tool" });
    const payload = JSON.parse(result.content![0].text!);
    expect(payload.hint).toContain("MCP_GRAPH_LEGACY_TOOLS");
  });

  it("includes migrationDoc when entry has one", () => {
    const result = buildRemovedToolError("removed_tool", {
      stage: "removed",
      replacement: "new_tool",
      migrationDoc: "docs/_internal/migration/v11-maestro-surface.md",
    });
    const payload = JSON.parse(result.content![0].text!);
    expect(payload.migrationDoc).toBe("docs/_internal/migration/v11-maestro-surface.md");
  });
});

// ── Wrapper integration ─────────────────────────────────────

describe("wrapToolsWithGates — deprecation integration", () => {
  let store: SqliteStore;
  let server: McpServer;
  let prevLegacyEnv: string | undefined;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    server = createServer();
    prevLegacyEnv = setEnv("MCP_GRAPH_LEGACY_TOOLS", undefined);
    clearLogBuffer();
  });

  afterEach(() => {
    delete DEPRECATED_TOOLS["dep_advisory_tool"];
    delete DEPRECATED_TOOLS["dep_warning_tool"];
    delete DEPRECATED_TOOLS["dep_removed_tool"];
    setEnv("MCP_GRAPH_LEGACY_TOOLS", prevLegacyEnv);
    store.close();
  });

  it("AC1 — advisory stage: tool runs normally and a warn log is emitted", async () => {
    DEPRECATED_TOOLS["dep_advisory_tool"] = {
      stage: "advisory",
      replacement: "new_tool",
    };
    let handlerExecuted = false;
    server.tool("dep_advisory_tool", "Deprecated tool (advisory)", {}, async () => {
      handlerExecuted = true;
      return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true }) }] };
    });

    wrapToolsWithGates(server, store);

    const result = await tools(server)["dep_advisory_tool"].handler({}) as ToolCallResult;

    expect(handlerExecuted).toBe(true);
    expect(result.isError).toBeFalsy();
    const payload = JSON.parse(result.content[0].text);
    expect(payload.ok).toBe(true);

    const warnLogs = getLogBuffer().filter(
      (e) => e.level === "warn" && /deprecated.*advisory/i.test(e.message),
    );
    expect(warnLogs.length).toBeGreaterThan(0);
    expect(warnLogs[0].context).toMatchObject({ tool: "dep_advisory_tool" });
  });

  it("AC1 — advisory stage: response does NOT include _deprecation_notice", async () => {
    DEPRECATED_TOOLS["dep_advisory_tool"] = { stage: "advisory", replacement: "new_tool" };
    server.tool("dep_advisory_tool", "Deprecated tool (advisory)", {}, async () => ({
      content: [{ type: "text" as const, text: JSON.stringify({ ok: true }) }],
    }));

    wrapToolsWithGates(server, store);

    const result = await tools(server)["dep_advisory_tool"].handler({}) as ToolCallResult;

    const hasNotice = result.content.some((c) => c.text && c.text.includes("_deprecation_notice"));
    expect(hasNotice).toBe(false);
  });

  it("AC2 — warning stage: response includes _deprecation_notice content item", async () => {
    DEPRECATED_TOOLS["dep_warning_tool"] = {
      stage: "warning",
      replacement: "new_tool",
      migrationDoc: "docs/_internal/migration/v11-maestro-surface.md",
      since: "v11.0.0",
    };
    server.tool("dep_warning_tool", "Deprecated tool (warning)", {}, async () => ({
      content: [{ type: "text" as const, text: JSON.stringify({ ok: true }) }],
    }));

    wrapToolsWithGates(server, store);

    const result = await tools(server)["dep_warning_tool"].handler({}) as ToolCallResult;

    expect(result.isError).toBeFalsy();
    const noticeItem = result.content.find((c) => c.text && c.text.includes("_deprecation_notice"));
    expect(noticeItem).toBeDefined();
    const parsed = JSON.parse(noticeItem!.text);
    expect(parsed._deprecation_notice).toBeDefined();
    expect(parsed._deprecation_notice.tool).toBe("dep_warning_tool");
    expect(parsed._deprecation_notice.stage).toBe("warning");
    expect(parsed._deprecation_notice.replacement).toBe("new_tool");
    expect(parsed._deprecation_notice.migrationDoc).toBe("docs/_internal/migration/v11-maestro-surface.md");
  });

  it("AC3 — removed stage: returns structured error with replacement, handler is NOT executed", async () => {
    DEPRECATED_TOOLS["dep_removed_tool"] = {
      stage: "removed",
      replacement: "new_tool",
      migrationDoc: "docs/_internal/migration/v11-maestro-surface.md",
      reason: "consolidated into new_tool",
    };
    let handlerExecuted = false;
    server.tool("dep_removed_tool", "Removed tool", {}, async () => {
      handlerExecuted = true;
      return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true }) }] };
    });

    wrapToolsWithGates(server, store);

    const result = await tools(server)["dep_removed_tool"].handler({}) as ToolCallResult;

    expect(handlerExecuted).toBe(false);
    expect(result.isError).toBe(true);
    const payload = JSON.parse(result.content[0].text);
    expect(payload.error).toBe("tool_removed");
    expect(payload.tool).toBe("dep_removed_tool");
    expect(payload.replacement).toBe("new_tool");
    expect(payload.migrationDoc).toBe("docs/_internal/migration/v11-maestro-surface.md");
    expect(payload.hint).toContain("MCP_GRAPH_LEGACY_TOOLS");
  });

  it("AC4 — MCP_GRAPH_LEGACY_TOOLS=on re-enables removed tools in advisory mode", async () => {
    setEnv("MCP_GRAPH_LEGACY_TOOLS", "on");
    DEPRECATED_TOOLS["dep_removed_tool"] = {
      stage: "removed",
      replacement: "new_tool",
    };
    let handlerExecuted = false;
    server.tool("dep_removed_tool", "Removed tool", {}, async () => {
      handlerExecuted = true;
      return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true }) }] };
    });

    wrapToolsWithGates(server, store);

    const result = await tools(server)["dep_removed_tool"].handler({}) as ToolCallResult;

    expect(handlerExecuted).toBe(true);
    expect(result.isError).toBeFalsy();
    const payload = JSON.parse(result.content[0].text);
    expect(payload.ok).toBe(true);

    const warnLogs = getLogBuffer().filter(
      (e) => e.level === "warn" && /deprecated.*advisory/i.test(e.message),
    );
    expect(warnLogs.length).toBeGreaterThan(0);
  });

  it("non-deprecated tools are unaffected by the deprecation gate", async () => {
    server.tool("normal_tool", "Normal tool", {}, async () => ({
      content: [{ type: "text" as const, text: JSON.stringify({ ok: true }) }],
    }));

    wrapToolsWithGates(server, store);

    const result = await tools(server)["normal_tool"].handler({}) as ToolCallResult;

    expect(result.isError).toBeFalsy();
    const payload = JSON.parse(result.content[0].text);
    expect(payload.ok).toBe(true);
    const hasNotice = result.content.some((c) => c.text && c.text.includes("_deprecation_notice"));
    expect(hasNotice).toBe(false);
  });
});

// ── Type-level smoke check ──────────────────────────────────

describe("DeprecationStage type", () => {
  it("supports the three expected stages", () => {
    const stages: DeprecationStage[] = ["advisory", "warning", "removed"];
    expect(stages).toHaveLength(3);
  });
});
