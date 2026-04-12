import { describe, it, expect } from "vitest";
import path from "node:path";
import { introspectTools, type ToolInfo } from "../core/docs/tool-introspector.js";

const TOOLS_DIR = path.resolve(__dirname, "../mcp/tools");

describe("tool-introspector", () => {
  let tools: ToolInfo[];

  it("should extract tools from source files", () => {
    tools = introspectTools(TOOLS_DIR);

    // Reduced after context consolidation (rag_context + context_compress merged into context)
    expect(tools.length).toBeGreaterThanOrEqual(42);
  });

  it("should include known core tools", () => {
    tools = introspectTools(TOOLS_DIR);
    const names = tools.map((t) => t.name);

    expect(names).toContain("init");
    expect(names).toContain("next");
    expect(names).toContain("analyze");
    expect(names).toContain("help");
    expect(names).toContain("node");
    expect(names).toContain("validate");
  });

  it("should include consolidated siebel tool", () => {
    tools = introspectTools(TOOLS_DIR);
    const siebelTools = tools.filter((t) => t.name === "siebel");

    expect(siebelTools.length).toBe(1);
    expect(siebelTools[0].category).toBe("Siebel CRM");
  });

  it("should include consolidated translate tool", () => {
    tools = introspectTools(TOOLS_DIR);
    const names = tools.map((t) => t.name);

    expect(names).toContain("translate");
  });

  it("should not include deprecated tools (removed in v7.0)", () => {
    tools = introspectTools(TOOLS_DIR);
    const names = tools.map((t) => t.name);

    expect(names).not.toContain("add_node");
    expect(names).not.toContain("delete_node");
    expect(names).not.toContain("update_node");
    expect(names).not.toContain("validate_ac");
    expect(names).not.toContain("validate_task");
    expect(names).not.toContain("list_skills");
  });

  it("should have name, description, category, sourceFile for each tool", () => {
    tools = introspectTools(TOOLS_DIR);

    for (const tool of tools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.category).toBeTruthy();
      expect(tool.sourceFile).toBeTruthy();
      expect(typeof tool.deprecated).toBe("boolean");
    }
  });

  it("should assign categories based on index.ts groupings", () => {
    tools = introspectTools(TOOLS_DIR);

    const initTool = tools.find((t) => t.name === "init");
    expect(initTool?.category).toBe("Core");

    const siebelTool = tools.find((t) => t.name === "siebel");
    expect(siebelTool?.category).toBe("Siebel CRM");

    const translateTool = tools.find((t) => t.name === "translate");
    expect(translateTool?.category).toBe("Translation");
  });

  it("should extract memory tools (4 from one file)", () => {
    tools = introspectTools(TOOLS_DIR);
    const memoryTools = tools.filter((t) => t.sourceFile.includes("memory.ts"));

    expect(memoryTools.length).toBe(4);
    const names = memoryTools.map((t) => t.name);
    expect(names).toContain("write_memory");
    expect(names).toContain("read_memory");
    expect(names).toContain("list_memories");
    expect(names).toContain("delete_memory");
  });
});
