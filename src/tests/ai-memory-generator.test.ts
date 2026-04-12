import { describe, it, expect } from "vitest";
import {
  generateClaudeMdSection,
  generateCopilotInstructions,
  MARKER_START,
  MARKER_END,
} from "../core/config/ai-memory-generator.js";

describe("generateClaudeMdSection", () => {
  it("should generate a non-empty section with markers", () => {
    const section = generateClaudeMdSection("my-project");

    expect(section).toContain(MARKER_START);
    expect(section).toContain(MARKER_END);
    expect(section).toContain("my-project");
  });

  it("should include tool reference", () => {
    const section = generateClaudeMdSection("test");

    expect(section).toContain("next");
    expect(section).toContain("context");
    expect(section).toContain("update_status");
    expect(section).toContain("import_prd");
  });

  it("should include lifecycle phases", () => {
    const section = generateClaudeMdSection("test");

    expect(section).toContain("ANALYZE");
    expect(section).toContain("IMPLEMENT");
    expect(section).toContain("VALIDATE");
  });

  it("should include XP Anti-Vibe-Coding principles", () => {
    const section = generateClaudeMdSection("test");

    expect(section).toContain("TDD");
    expect(section).toContain("Anti-Vibe-Coding");
  });
});

describe("generateCopilotInstructions", () => {
  it("should generate content with markers", () => {
    const content = generateCopilotInstructions("my-project");

    expect(content).toContain(MARKER_START);
    expect(content).toContain(MARKER_END);
    expect(content).toContain("my-project");
  });

  it("should include tool reference and lifecycle", () => {
    const content = generateCopilotInstructions("test");

    expect(content).toContain("next");
    expect(content).toContain("context");
    expect(content).toContain("ANALYZE");
    expect(content).toContain("IMPLEMENT");
  });
});

describe("tool completeness", () => {
  it("should include consolidated tools", () => {
    const section = generateClaudeMdSection("test");
    expect(section).toContain("node");
    expect(section).toContain("validate");
    expect(section).toContain("manage_skill");
  });

  it("should include core tools", () => {
    const section = generateClaudeMdSection("test");
    expect(section).toContain("set_phase");
    expect(section).toContain("analyze");
    expect(section).toContain("metrics");
    expect(section).toContain("bulk_update_status");
    expect(section).toContain("write_memory");
    expect(section).toContain("read_memory");
    expect(section).toContain("list_memories");
    expect(section).toContain("delete_memory");
  });

  it("should group tools by category", () => {
    const section = generateClaudeMdSection("test");
    expect(section).toContain("Projeto & Grafo");
    expect(section).toContain("Contexto & RAG");
    expect(section).toContain("Skills");
  });

  it("should claim correct tool count (v8.0 consolidated)", () => {
    const section = generateClaudeMdSection("test");
    expect(section).toContain("37 tools");
  });

  it("should include deprecated tools reference", () => {
    const section = generateClaudeMdSection("test");
    expect(section).toContain("Deprecated");
    expect(section).toContain("add_node");
    expect(section).toContain("update_node");
    expect(section).toContain("delete_node");
    expect(section).toContain("validate_task");
    expect(section).toContain("validate_ac");
    expect(section).toContain("list_skills");
  });
});

describe("analyze modes section", () => {
  it("should include analyze modes section", () => {
    const section = generateClaudeMdSection("test");
    expect(section).toContain("prd_quality");
    expect(section).toContain("implement_done");
    expect(section).toContain("design_ready");
    expect(section).toContain("backlog_health");
  });

  it("should group analyze modes by lifecycle phase", () => {
    const section = generateClaudeMdSection("test");
    expect(section).toContain("Modos do analyze por fase");
  });
});

describe("knowledge pipeline section", () => {
  it("should include knowledge pipeline section", () => {
    const section = generateClaudeMdSection("test");
    expect(section).toContain("Knowledge");
    expect(section).toContain("RAG");
    expect(section).toContain("knowledge(action:reindex)");
  });
});

describe("doctor CLI command", () => {
  it("should include doctor command", () => {
    const section = generateClaudeMdSection("test");
    expect(section).toContain("doctor");
  });
});

describe("copilot instructions enrichment", () => {
  it("should include set_phase and validate_ac", () => {
    const content = generateCopilotInstructions("test");
    expect(content).toContain("set_phase");
    expect(content).toContain("validate_ac");
    expect(content).toContain("analyze");
  });

  it("copilot instructions should also be idempotent", () => {
    const s1 = generateCopilotInstructions("test");
    const s2 = generateCopilotInstructions("test");
    expect(s1).toBe(s2);
  });
});

describe("copilot instructions parity", () => {
  it("should include mandatory execution rule", () => {
    const content = generateCopilotInstructions("test");
    expect(content).toContain("fonte de verdade ABSOLUTA");
  });

  it("should include full tool table by category", () => {
    const content = generateCopilotInstructions("test");
    expect(content).toContain("Projeto & Grafo");
    expect(content).toContain("Contexto & RAG");
    expect(content).toContain("37 tools");
  });

  it("should include analyze modes", () => {
    const content = generateCopilotInstructions("test");
    expect(content).toContain("prd_quality");
    expect(content).toContain("implement_done");
  });

  it("should include knowledge pipeline", () => {
    const content = generateCopilotInstructions("test");
    expect(content).toContain("Knowledge");
    expect(content).toContain("knowledge(action:reindex)");
  });

  it("should include skills section", () => {
    const content = generateCopilotInstructions("test");
    expect(content).toContain("Skills Built-in");
    expect(content).toContain("Self-Healing");
  });

  it("should include CLI commands", () => {
    const content = generateCopilotInstructions("test");
    expect(content).toContain("npx mcp-graph");
    expect(content).toContain("doctor");
  });
});

describe("skills section", () => {
  it("should include manage_skill tool in CLAUDE.md", () => {
    const section = generateClaudeMdSection("test");
    expect(section).toContain("manage_skill");
  });

  it("should include skills by phase table", () => {
    const section = generateClaudeMdSection("test");
    expect(section).toContain("create-prd-chat-mode");
    expect(section).toContain("subagent-driven-development");
    expect(section).toContain("code-reviewer");
    expect(section).toContain("self-healing-awareness");
  });

  it("should include custom skills reference", () => {
    const section = generateClaudeMdSection("test");
    expect(section).toContain("Custom Skills");
  });

  it("copilot instructions should mention manage_skill", () => {
    const content = generateCopilotInstructions("test");
    expect(content).toContain("manage_skill");
  });
});

describe("lean mode", () => {
  it("should generate lean section with < 800 tokens", () => {
    const section = generateClaudeMdSection("test", "lean");
    const estimatedTokens = Math.ceil(section.length / 4);

    // Lean mode: behavioral rules + gates + DoD + DoR + flow (~1700 tokens)
    // Full mode: ~5000 tokens — lean must be significantly smaller
    expect(estimatedTokens).toBeLessThan(1800);
  });

  it("should include behavioral rules and v6.0 pipeline in lean mode", () => {
    const section = generateClaudeMdSection("test", "lean");

    expect(section).toContain("fonte de verdade ABSOLUTA");
    expect(section).toContain("Fluxo de trabalho");
    expect(section).toContain("Lifecycle");
    expect(section).toContain("Anti-Vibe-Coding");
    expect(section).toContain("start_task");
    expect(section).toContain("finish_task");
    expect(section).toContain("Pipeline v6.0");
  });

  it("should include phase gates, DoD, DoR and flow principles in lean mode", () => {
    const section = generateClaudeMdSection("test", "lean");

    expect(section).toContain("Phase Gates");
    expect(section).toContain("design_ready");
    expect(section).toContain("Definition of Done");
    expect(section).toContain("has_acceptance_criteria");
    expect(section).toContain("Definition of Ready");
    expect(section).toContain("has_requirements");
    expect(section).toContain("Little's Law");
    expect(section).toContain("WIP = 1");
  });

  it("should NOT include full-only sections in lean mode", () => {
    const section = generateClaudeMdSection("test", "lean");

    expect(section).not.toContain("Tool Prerequisites (Modo Strict)");
    expect(section).not.toContain("Workflows Compostos");
    expect(section).not.toContain("Erros Comuns de Agentes");
    expect(section).not.toContain("Six Sigma");
    expect(section).not.toContain("TDD Enforcement");
  });

  it("should NOT include reference tables in lean mode", () => {
    const section = generateClaudeMdSection("test", "lean");

    expect(section).not.toContain("Projeto & Grafo");
    expect(section).not.toContain("Modos do analyze por fase");
    expect(section).not.toContain("Skills Built-in");
    expect(section).not.toContain("npx mcp-graph stats");
    expect(section).not.toContain("Tools Deprecated");
  });

  it("should include help tool discovery hint in lean mode", () => {
    const section = generateClaudeMdSection("test", "lean");

    expect(section).toContain("help");
    expect(section).toContain("on-demand");
  });

  it("lean copilot instructions should match lean CLAUDE.md body", () => {
    const claude = generateClaudeMdSection("test", "lean");
    const copilot = generateCopilotInstructions("test", "lean");

    const extractBody = (s: string): string => {
      const start = s.indexOf(MARKER_START) + MARKER_START.length;
      const end = s.indexOf(MARKER_END);
      return s.substring(start, end).trim();
    };

    expect(extractBody(copilot)).toBe(extractBody(claude));
  });

  it("full mode should include all operational sections", () => {
    const section = generateClaudeMdSection("test", "full");

    // Phase 1 sections
    expect(section).toContain("Phase Gates");
    expect(section).toContain("Definition of Done");
    expect(section).toContain("Tool Prerequisites (Modo Strict)");
    expect(section).toContain("Workflows Compostos");
    expect(section).toContain("Erros Comuns de Agentes");
    // Phase 2 sections (industrial methodologies)
    expect(section).toContain("Definition of Ready");
    expect(section).toContain("Little's Law");
    expect(section).toContain("Six Sigma");
    expect(section).toContain("DORA Metrics");
    expect(section).toContain("TDD Enforcement");
    expect(section).toContain("testabilityScore");
    // Extended analyze modes
    expect(section).toContain("sprint_health");
    expect(section).toContain("economy_simulation");
    // v6.0 Pipeline Tools
    expect(section).toContain("Pipeline Tools v6.0");
    expect(section).toContain("start_task");
    expect(section).toContain("finish_task");
    expect(section).toContain("nextAction");
    expect(section).toContain("37 tools");
  });

  it("full mode should be much larger than lean mode", () => {
    const lean = generateClaudeMdSection("test", "lean");
    const full = generateClaudeMdSection("test", "full");

    expect(full.length).toBeGreaterThan(lean.length * 2);
  });
});

describe("idempotency", () => {
  it("markers should be consistent for repeated calls", () => {
    const section1 = generateClaudeMdSection("test");
    const section2 = generateClaudeMdSection("test");

    expect(section1).toBe(section2);
  });
});

describe("structural parity (anti-drift)", () => {
  it("both outputs should have identical content between markers", () => {
    const claude = generateClaudeMdSection("test");
    const copilot = generateCopilotInstructions("test");

    const extractBody = (s: string): string => {
      const start = s.indexOf(MARKER_START) + MARKER_START.length;
      const end = s.indexOf(MARKER_END);
      return s.substring(start, end).trim();
    };

    expect(extractBody(copilot)).toBe(extractBody(claude));
  });
});
