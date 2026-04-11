import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { registerSelfHealing } from "../mcp/tools/self-healing.js";
import { makeNode } from "./helpers/factories.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTools = any;

function createServer(): McpServer {
  return new McpServer({ name: "test", version: "1.0.0" }, { capabilities: { tools: {} } });
}

function tools(server: McpServer): AnyTools {
  return (server as AnyTools)._registeredTools;
}

function parseResult(result: { content: { type: string; text: string }[] }): Record<string, unknown> {
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

describe("MCP self_healing tool", () => {
  let store: SqliteStore;
  let server: McpServer;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    server = createServer();
    registerSelfHealing(server, store);
  });

  afterEach(() => {
    store.close();
  });

  it("should scan and find no issues on healthy graph", async () => {
    const epic = makeNode({ type: "epic", title: "Epic" });
    const task = makeNode({ status: "ready", title: "Task", parentId: epic.id });
    store.insertNode(epic);
    store.insertNode(task);

    const result = await tools(server)["self_healing"].handler({
      action: "scan",
      dryRun: true,
      staleHours: 48,
    });
    const parsed = parseResult(result);

    expect(parsed.ok).toBe(true);
    expect(parsed.action).toBe("scan");
    expect(parsed.issuesFound).toBe(0);
  });

  it("should scan and detect stuck tasks", async () => {
    const stuck = makeNode({
      status: "in_progress",
      title: "Stuck task",
      updatedAt: hoursAgo(72),
    });
    store.insertNode(stuck);

    const result = await tools(server)["self_healing"].handler({
      action: "scan",
      dryRun: true,
      staleHours: 48,
    });
    const parsed = parseResult(result);

    expect(parsed.ok).toBe(true);
    expect(parsed.issuesFound).toBeGreaterThanOrEqual(1);
    const issues = parsed.issues as Array<{ type: string; nodeId: string }>;
    expect(issues.some((i) => i.type === "stuck_task" && i.nodeId === stuck.id)).toBe(true);
  });

  it("should diagnose and return prioritized issues with planned actions", async () => {
    const stuck = makeNode({
      status: "in_progress",
      title: "Stuck",
      updatedAt: hoursAgo(100),
    });
    store.insertNode(stuck);

    const result = await tools(server)["self_healing"].handler({
      action: "diagnose",
      dryRun: true,
      staleHours: 48,
    });
    const parsed = parseResult(result);

    expect(parsed.ok).toBe(true);
    expect(parsed.action).toBe("diagnose");
    expect((parsed.actionsPlanned as number)).toBeGreaterThanOrEqual(1);
  });

  it("should heal in dry-run mode and return report", async () => {
    const stuck = makeNode({
      status: "in_progress",
      title: "Stuck task",
      updatedAt: hoursAgo(72),
    });
    store.insertNode(stuck);

    const result = await tools(server)["self_healing"].handler({
      action: "heal",
      dryRun: true,
      staleHours: 48,
    });
    const parsed = parseResult(result);

    expect(parsed.ok).toBe(true);
    expect(parsed.action).toBe("heal");
    expect(parsed.dryRun).toBe(true);
    const report = parsed.report as Record<string, unknown>;
    expect(report.successRate).toBeDefined();
    expect(report.totalHealed).toBeGreaterThanOrEqual(1);
  });

  it("should return report placeholder when no prior heal", async () => {
    const result = await tools(server)["self_healing"].handler({
      action: "report",
      dryRun: true,
      staleHours: 48,
    });
    const parsed = parseResult(result);

    expect(parsed.ok).toBe(true);
    expect(parsed.action).toBe("report");
  });
});
