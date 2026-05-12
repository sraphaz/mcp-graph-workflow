/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.1 — Registrar sentrux no IntegrationOrchestrator
 *
 * AC2 (updated): sentrux is an internal advisory mechanism, NOT an MCP server entry.
 *   MCP_SERVER_NAMES contains mcp-graph, context7, playwright, browser-use.
 * AC3: GIVEN evento `sentrux:scan_complete` emitido WHEN listener consome THEN payload tipado recebido
 */

import { describe, it, expect } from "vitest";
import { MCP_SERVER_NAMES, buildMcpServersConfig } from "../core/integrations/mcp-servers-config.js";
import { GraphEventBus } from "../core/events/event-bus.js";
import type { SentruxScanCompleteEvent } from "../core/events/event-types.js";

// ---------------------------------------------------------------------------
// AC2: registry includes core MCP servers; sentrux is internal (not MCP)
// ---------------------------------------------------------------------------

describe("MCP registry — AC2: core servers present, sentrux is internal", () => {
  it("MCP_SERVER_NAMES contains context7", () => {
    expect(MCP_SERVER_NAMES).toContain("context7");
  });

  it("MCP_SERVER_NAMES contains playwright", () => {
    expect(MCP_SERVER_NAMES).toContain("playwright");
  });

  it("MCP_SERVER_NAMES contains browser-use", () => {
    expect(MCP_SERVER_NAMES).toContain("browser-use");
  });

  it("sentrux is NOT in MCP_SERVER_NAMES (it is an internal advisory mechanism)", () => {
    expect(MCP_SERVER_NAMES).not.toContain("sentrux");
  });

  it("buildMcpServersConfig does NOT include sentrux entry", () => {
    const config = buildMcpServersConfig();
    expect(config.mcpServers).not.toHaveProperty("sentrux");
  });
});

// ---------------------------------------------------------------------------
// AC3: sentrux:scan_complete event is typed and receivable
// ---------------------------------------------------------------------------

describe("GraphEventBus — AC3: sentrux:scan_complete event", () => {
  it("emitting sentrux:scan_complete calls listener with typed payload", () => {
    const bus = new GraphEventBus();
    const received: SentruxScanCompleteEvent[] = [];

    bus.on("sentrux:scan_complete", (evt) => {
      received.push(evt as SentruxScanCompleteEvent);
    });

    bus.emit({
      type: "sentrux:scan_complete",
      timestamp: new Date().toISOString(),
      payload: {
        runId: "scan-001",
        issuesFound: 3,
        severity: "warn",
        timestamp: new Date().toISOString(),
      },
    });

    expect(received).toHaveLength(1);
    expect((received[0].payload as Record<string, unknown>)["runId"]).toBe("scan-001");
  });

  it("wildcard listener receives sentrux:scan_complete events", () => {
    const bus = new GraphEventBus();
    const allEvents: string[] = [];

    bus.on("*", (evt) => {
      allEvents.push(evt.type);
    });

    bus.emit({
      type: "sentrux:scan_complete",
      timestamp: new Date().toISOString(),
      payload: { runId: "scan-002", issuesFound: 0, severity: "ok", timestamp: "" },
    });

    expect(allEvents).toContain("sentrux:scan_complete");
  });
});
