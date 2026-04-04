/**
 * Tests for the `manage_skill` MCP tool — action "list".
 * Covers listing all skills, filtering by phase, single skill lookup, and logger coverage.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { registerManageSkill } from "../mcp/tools/manage-skill.js";
import { getSkillByName } from "../core/skills/built-in-skills.js";
import { clearLogBuffer, getLogBuffer } from "../core/utils/logger.js";

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

describe("MCP manage_skill tool — action list", () => {
  let store: SqliteStore;
  let server: McpServer;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    server = createServer();
    registerManageSkill(server, store);
    clearLogBuffer();
  });

  afterEach(() => {
    store.close();
  });

  // ── list without filter ─────────────────────────────────

  describe("list without filter", () => {
    it("should list all built-in skills", async () => {
      const result = await tools(server)["manage_skill"].handler({ action: "list" });
      const parsed = parseResult(result);

      expect(parsed.total).toBeGreaterThan(0);
      expect(Array.isArray(parsed.skills)).toBe(true);
      const skills = parsed.skills as Record<string, unknown>[];
      expect(skills[0]).toHaveProperty("name");
      expect(skills[0]).toHaveProperty("description");
      expect(skills[0]).toHaveProperty("category");
      expect(skills[0]).toHaveProperty("phases");
    });

    it("should filter skills by phase", async () => {
      const result = await tools(server)["manage_skill"].handler({ action: "list", phase: "IMPLEMENT" });
      const parsed = parseResult(result);

      expect(parsed.total).toBeGreaterThan(0);
      expect(parsed.phase).toBe("IMPLEMENT");
      const skills = parsed.skills as Record<string, unknown>[];
      // Every skill should include IMPLEMENT in its phases
      for (const skill of skills) {
        expect((skill.phases as string[]).includes("IMPLEMENT")).toBe(true);
      }
    });
  });

  // ── list with skillName ─────────────────────────────────

  describe("list with skillName", () => {
    it("should return full instructions for skill by name", async () => {
      // Use a known built-in skill name — first skill from the list
      const allResult = await tools(server)["manage_skill"].handler({ action: "list" });
      const allParsed = parseResult(allResult);
      const skills = allParsed.skills as Record<string, unknown>[];
      const firstSkillName = skills[0].name as string;

      const result = await tools(server)["manage_skill"].handler({ action: "list", skillName: firstSkillName });
      const parsed = parseResult(result);

      expect(parsed.name).toBe(firstSkillName);
      expect(parsed.instructions).toBeDefined();
      expect(typeof parsed.instructions).toBe("string");
      expect(parsed.phases).toBeDefined();
    });

    it("should return error for unknown skill name", async () => {
      const result = await tools(server)["manage_skill"].handler({ action: "list", skillName: "nonexistent-skill" });
      const parsed = parseResult(result);

      expect(result.isError).toBe(true);
      expect(parsed.error).toContain("not found");
    });
  });

  // ── Logger coverage ─────────────────────────────────────

  describe("logger coverage", () => {
    const origDebug = process.env.MCP_GRAPH_DEBUG;

    beforeEach(() => {
      process.env.MCP_GRAPH_DEBUG = "1";
    });

    afterEach(() => {
      if (origDebug === undefined) {
        delete process.env.MCP_GRAPH_DEBUG;
      } else {
        process.env.MCP_GRAPH_DEBUG = origDebug;
      }
    });

    it("should log debug and info on successful list", async () => {
      clearLogBuffer();
      await tools(server)["manage_skill"].handler({ action: "list" });
      const buffer = getLogBuffer();

      expect(buffer.some((e) => e.level === "debug" && e.message.includes("tool:manage_skill"))).toBe(true);
      expect(buffer.some((e) => e.level === "info" && e.message.includes("tool:manage_skill:list:ok"))).toBe(true);
    });
  });

  describe("action: create_template", () => {
    it("should create a task template via MCP tool", async () => {
      const result = await tools(server)["manage_skill"].handler({
        action: "create_template",
        template: {
          name: "backend_ui",
          description: "Backend + UI pattern",
          subtasks: [
            { title: "Backend logic", type: "subtask" },
            { title: "UI components", type: "subtask" },
          ],
        },
      });

      const parsed = parseResult(result);
      expect(parsed.ok).toBe(true);
      const tmpl = parsed.template as Record<string, unknown>;
      expect(tmpl.name).toBe("backend_ui");
      expect((tmpl.subtasks as unknown[]).length).toBe(2);
    });

    it("should reject create_template without template param", async () => {
      const result = await tools(server)["manage_skill"].handler({
        action: "create_template",
      });

      expect(result.isError).toBe(true);
    });
  });

  describe("action: list_templates", () => {
    it("should list created templates", async () => {
      await tools(server)["manage_skill"].handler({
        action: "create_template",
        template: {
          name: "tmpl_1",
          description: "First",
          subtasks: [{ title: "S1", type: "subtask" }],
        },
      });

      const result = await tools(server)["manage_skill"].handler({
        action: "list_templates",
      });

      const parsed = parseResult(result);
      expect(parsed.ok).toBe(true);
      expect(parsed.total).toBe(1);
      expect((parsed.templates as unknown[]).length).toBe(1);
    });
  });

  // ── action: recommend ──────────────────────────────────

  describe("action: recommend", () => {
    it("should return recommendations for empty graph (ANALYZE phase)", async () => {
      const result = await tools(server)["manage_skill"].handler({ action: "recommend" });
      const parsed = parseResult(result);

      expect(parsed.phase).toBe("ANALYZE");
      expect(parsed.recommendations).toBeInstanceOf(Array);
      expect((parsed.recommendations as unknown[]).length).toBeGreaterThan(0);
    });

    it("should return recommendations filtered by specified phase", async () => {
      const result = await tools(server)["manage_skill"].handler({ action: "recommend", phase: "DEPLOY" });
      const parsed = parseResult(result);

      expect(parsed.phase).toBe("DEPLOY");
      expect(parsed.recommendations).toBeInstanceOf(Array);
    });

    it("should only recommend skills that exist in built-in registry", async () => {
      const result = await tools(server)["manage_skill"].handler({ action: "recommend" });
      const parsed = parseResult(result);

      const recs = parsed.recommendations as Array<{ skill: string; reason: string; phase: string }>;
      for (const rec of recs) {
        expect(getSkillByName(rec.skill), `Ghost skill "${rec.skill}" in recommend`).toBeDefined();
      }
    });
  });
});
