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

import { writeFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { logger } from "../core/utils/logger.js";
import { GraphNotInitializedError } from "../core/utils/errors.js";
import { buildMcpServersConfig } from "../core/integrations/mcp-servers-config.js";
import { installAllMcpDeps } from "../core/integrations/mcp-deps-installer.js";
import { installLspDeps } from "../core/lsp/lsp-deps-installer.js";
import { detectProjectLanguages } from "../core/lsp/language-detector.js";
import { ServerRegistry } from "../core/lsp/server-registry.js";
import {
  generateClaudeMdSection,
  generateCopilotInstructions,
  generateCodexAgentsMdSection,
  applySection,
} from "../core/config/ai-memory-generator.js";
import { loadConfig } from "../core/config/config-loader.js";
import {
  ensureClaudeIgnore,
  ensureCopilotIgnore,
  updateClaudeIgnore,
  updateCopilotIgnore,
} from "../core/config/ignore-templates.js";
import { introspectTools } from "../core/docs/tool-introspector.js";
import { introspectRoutes } from "../core/docs/route-introspector.js";
import { generateReadmeStats, generateArchToolSection, generateArchRouteSection, generateToolRefSummary } from "../core/docs/doc-generator.js";
import { applySectionWithName } from "../core/docs/doc-updater.js";

import { STORE_DIR } from "../core/utils/constants.js";

const MCP_CONFIG_FILE = ".mcp.json";
const GITIGNORE_ENTRY = "workflow-graph/";
const CODEX_SKILL_NAMES = [
  "graph-prd",
  "graph-analyze",
  "graph-design",
  "graph-plan",
  "graph-implement",
  "graph-validate",
  "graph-review",
  "graph-handoff",
  "graph-deploy",
  "graph-listening",
  "graph-security",
  "graph-tests",
  "graph-quality-assurance",
  "graph-bug-hunter",
  "graph-fix-bugs",
  "graph-performance",
  "graph-refactor",
  "graph-docs",
  "graph-architecture",
  "graph-api-design",
  "graph-dependency",
  "graph-accessibility",
  "harness-engineering",
  "kanban-orchestrator",
  "ui-ux-pro-max",
] as const;

// --- Update types ---

export interface UpdateStepResult {
  step: string;
  status: "updated" | "up-to-date" | "created" | "skipped" | "error";
  message: string;
}

export interface UpdateReport {
  steps: UpdateStepResult[];
  hasChanges: boolean;
}

export interface UpdateOptions {
  only?: string[];
  dryRun?: boolean;
}

// --- Internal helpers ---

function _resolveCommand(): string {
  // Check if running via npx/global — use package name
  // Check if running from node_modules — use relative path
  const binPath = process.argv[1];
  if (binPath && binPath.includes("node_modules")) {
    return "npx";
  }
  return "npx";
}

function _resolveArgs(): string[] {
  const binPath = process.argv[1];
  if (binPath && binPath.includes("node_modules")) {
    return ["-y", "@mcp-graph-workflow/mcp-graph"];
  }
  return ["-y", "mcp-graph"];
}

function writeMcpJson(projectDir: string, dryRun?: boolean): UpdateStepResult {
  const mcpConfigPath = path.join(projectDir, MCP_CONFIG_FILE);

  let existing: Record<string, unknown> = {};
  const fileExists = existsSync(mcpConfigPath);
  if (fileExists) {
    try {
      existing = JSON.parse(readFileSync(mcpConfigPath, "utf-8"));
    } catch (err) {
      logger.debug("initProject:corruptedMcpJson", { error: err instanceof Error ? err.message : String(err) });
      // corrupted file, overwrite
    }
  }

  const config = buildMcpServersConfig(existing as Partial<{ mcpServers: Record<string, { command: string; args: string[] }> }>);
  const newContent = JSON.stringify(config, null, 2) + "\n";

  if (fileExists) {
    const currentContent = readFileSync(mcpConfigPath, "utf-8");
    if (currentContent === newContent) {
      return { step: "mcp-json", status: "up-to-date", message: ".mcp.json up-to-date" };
    }
  }

  if (!dryRun) {
    writeFileSync(mcpConfigPath, newContent, "utf-8");
    logger.info(`${MCP_CONFIG_FILE} configured with all MCP servers`, { path: mcpConfigPath });
  }

  return {
    step: "mcp-json",
    status: fileExists ? "updated" : "created",
    message: fileExists ? ".mcp.json updated" : ".mcp.json created",
  };
}

function writeVscodeMcpJson(projectDir: string, dryRun?: boolean): UpdateStepResult {
  const vscodeDir = path.join(projectDir, ".vscode");
  const vscodeMcpPath = path.join(vscodeDir, "mcp.json");

  let existing: Record<string, unknown> = {};
  const fileExists = existsSync(vscodeMcpPath);
  if (fileExists) {
    try {
      existing = JSON.parse(readFileSync(vscodeMcpPath, "utf-8"));
    } catch (err) {
      logger.debug("initProject:corruptedVscodeMcpJson", { error: err instanceof Error ? err.message : String(err) });
      // corrupted file, overwrite
    }
  }

  // Use buildMcpServersConfig to get all 5 MCPs, then convert to VS Code format
  const mcpConfig = buildMcpServersConfig();
  const servers = (existing.servers ?? {}) as Record<string, unknown>;
  for (const [name, entry] of Object.entries(mcpConfig.mcpServers)) {
    servers[name] = { type: "stdio", command: entry.command, args: entry.args };
  }

  const config = { ...existing, servers };
  const newContent = JSON.stringify(config, null, 2) + "\n";

  if (fileExists) {
    const currentContent = readFileSync(vscodeMcpPath, "utf-8");
    if (currentContent === newContent) {
      return { step: "vscode-mcp", status: "up-to-date", message: ".vscode/mcp.json up-to-date" };
    }
  }

  if (!dryRun) {
    mkdirSync(vscodeDir, { recursive: true });
    writeFileSync(vscodeMcpPath, newContent, "utf-8");
    logger.info(".vscode/mcp.json configured with all MCP servers", { path: vscodeMcpPath });
  }

  return {
    step: "vscode-mcp",
    status: fileExists ? "updated" : "created",
    message: fileExists ? ".vscode/mcp.json updated" : ".vscode/mcp.json created",
  };
}

function ensureGitignore(projectDir: string, dryRun?: boolean): UpdateStepResult {
  const gitignorePath = path.join(projectDir, ".gitignore");

  if (!existsSync(gitignorePath)) {
    if (!dryRun) {
      writeFileSync(gitignorePath, GITIGNORE_ENTRY + "\n", "utf-8");
      logger.info(".gitignore created", { entry: GITIGNORE_ENTRY });
    }
    return { step: "gitignore", status: "created", message: ".gitignore created with workflow-graph/" };
  }

  const content = readFileSync(gitignorePath, "utf-8");
  if (content.includes(GITIGNORE_ENTRY)) {
    return { step: "gitignore", status: "up-to-date", message: ".gitignore up-to-date" };
  }

  if (!dryRun) {
    const separator = content.endsWith("\n") ? "" : "\n";
    writeFileSync(gitignorePath, content + separator + GITIGNORE_ENTRY + "\n", "utf-8");
    logger.info(".gitignore updated", { entry: GITIGNORE_ENTRY });
  }

  return { step: "gitignore", status: "updated", message: ".gitignore updated with workflow-graph/" };
}

function generateAndWriteClaudeMd(projectDir: string, dryRun?: boolean, contextMode?: "ultra-lean" | "lean" | "full"): UpdateStepResult {
  const projectName = path.basename(projectDir);
  const claudeMdPath = path.join(projectDir, "CLAUDE.md");
  const section = generateClaudeMdSection(projectName, contextMode ?? "lean");

  const fileExists = existsSync(claudeMdPath);
  let existing = "";
  if (fileExists) {
    existing = readFileSync(claudeMdPath, "utf-8");
  }

  const resultValue = applySection(existing, section);

  if (fileExists && existing === resultValue) {
    return { step: "claude-md", status: "up-to-date", message: "CLAUDE.md up-to-date" };
  }

  if (!dryRun) {
    writeFileSync(claudeMdPath, resultValue, "utf-8");
    logger.info("CLAUDE.md updated with mcp-graph instructions", { path: claudeMdPath });
  }

  return {
    step: "claude-md",
    status: fileExists ? "updated" : "created",
    message: fileExists ? "CLAUDE.md updated" : "CLAUDE.md created",
  };
}

function generateAndWriteCopilotInstructions(projectDir: string, dryRun?: boolean, contextMode?: "ultra-lean" | "lean" | "full"): UpdateStepResult {
  const projectName = path.basename(projectDir);
  const githubDir = path.join(projectDir, ".github");
  const copilotPath = path.join(githubDir, "copilot-instructions.md");
  const section = generateCopilotInstructions(projectName, contextMode ?? "lean");

  const fileExists = existsSync(copilotPath);
  let existing = "";
  if (fileExists) {
    existing = readFileSync(copilotPath, "utf-8");
  }

  const resultValue = applySection(existing, section);

  if (fileExists && existing === resultValue) {
    return { step: "copilot-md", status: "up-to-date", message: "copilot-instructions.md up-to-date" };
  }

  if (!dryRun) {
    mkdirSync(githubDir, { recursive: true });
    writeFileSync(copilotPath, resultValue, "utf-8");
    logger.info("copilot-instructions.md updated", { path: copilotPath });
  }

  return {
    step: "copilot-md",
    status: fileExists ? "updated" : "created",
    message: fileExists ? "copilot-instructions.md updated" : "copilot-instructions.md created",
  };
}

function generateAndWriteCodexAgentsMd(projectDir: string, dryRun?: boolean, contextMode?: "ultra-lean" | "lean" | "full"): UpdateStepResult {
  const projectName = path.basename(projectDir);
  const agentsMdPath = path.join(projectDir, "AGENTS.md");
  const section = generateCodexAgentsMdSection(projectName, contextMode ?? "lean");

  const fileExists = existsSync(agentsMdPath);
  let existing = "";
  if (fileExists) {
    existing = readFileSync(agentsMdPath, "utf-8");
  }

  const resultValue = applySection(existing, section);

  if (fileExists && existing === resultValue) {
    return { step: "codex-md", status: "up-to-date", message: "AGENTS.md up-to-date" };
  }

  if (!dryRun) {
    writeFileSync(agentsMdPath, resultValue, "utf-8");
    logger.info("AGENTS.md updated with Codex mcp-graph instructions", { path: agentsMdPath });
  }

  return {
    step: "codex-md",
    status: fileExists ? "updated" : "created",
    message: fileExists ? "AGENTS.md updated" : "AGENTS.md created",
  };
}

function getCodexSkillAssetDirs(): string[] {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return [
    path.resolve(currentDir, "../assets/codex-skills"),
    path.resolve(currentDir, "../../dist/assets/codex-skills"),
    path.resolve(currentDir, "../../skills-graph"),
    path.resolve(process.cwd(), "dist/assets/codex-skills"),
    path.resolve(process.cwd(), "skills-graph"),
  ];
}

function getCodexSkillSourcePath(skillName: string): string | null {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));

  if (skillName === "ui-ux-pro-max") {
    const uiCandidates = [
      path.resolve(currentDir, "../assets/codex-skills/ui-ux-pro-max.md"),
      path.resolve(currentDir, "../../dist/assets/codex-skills/ui-ux-pro-max.md"),
      path.resolve(currentDir, "../../.claude/skills/ui-ux-pro-max/SKILL.md"),
      path.resolve(process.cwd(), ".claude/skills/ui-ux-pro-max/SKILL.md"),
    ];
    return uiCandidates.find((candidate) => existsSync(candidate)) ?? null;
  }

  for (const assetDir of getCodexSkillAssetDirs()) {
    const candidate = path.join(assetDir, `${skillName}.md`);
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

function generateFallbackCodexSkill(skillName: string): string {
  return `---\nname: ${skillName}\ndescription: mcp-graph Codex skill generated as a fallback because the packaged skill asset was unavailable.\n---\n\n# ${skillName}\n\nUse this skill with the mcp-graph lifecycle. Load project context with mcp-graph tools before making changes.\n`;
}

function adaptCodexSkillContent(skillName: string, content: string): string {
  const source = content.trim().length > 0 ? content : generateFallbackCodexSkill(skillName);
  return source
    .replaceAll("/graph-", "$graph-")
    .replaceAll("rag_context", "context(action: \"rag\")")
    .replaceAll("mcp__mcp-graph__rag_context", "mcp__mcp-graph__context")
    .replaceAll("mcp__mcp-graph__add_node", "mcp__mcp-graph__node")
    .replaceAll("mcp__mcp-graph__update_node", "mcp__mcp-graph__node")
    .concat("\n\n## Codex Notes\n\n- In Codex Plan Mode, use this skill for planning only and do not mutate files.\n- During implementation, follow the project `AGENTS.md` rules and use `apply_patch` for manual edits.\n");
}

function generateAndWriteCodexSkills(projectDir: string, dryRun?: boolean): UpdateStepResult {
  const skillsRoot = path.join(projectDir, ".agents", "skills");
  let created = 0;
  let updated = 0;
  let missingSources = 0;

  for (const skillName of CODEX_SKILL_NAMES) {
    const sourcePath = getCodexSkillSourcePath(skillName);
    const rawContent = sourcePath ? readFileSync(sourcePath, "utf-8") : generateFallbackCodexSkill(skillName);
    if (!sourcePath) missingSources++;

    const nextContent = adaptCodexSkillContent(skillName, rawContent).trimEnd() + "\n";
    const skillDir = path.join(skillsRoot, skillName);
    const skillPath = path.join(skillDir, "SKILL.md");
    const exists = existsSync(skillPath);
    const current = exists ? readFileSync(skillPath, "utf-8") : "";

    if (exists && current === nextContent) {
      continue;
    }

    if (!dryRun) {
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(skillPath, nextContent, "utf-8");
    }

    if (exists) {
      updated++;
    } else {
      created++;
    }
  }

  if (created === 0 && updated === 0) {
    return {
      step: "codex-skills",
      status: "up-to-date",
      message: `.agents/skills up-to-date (${CODEX_SKILL_NAMES.length} skills)`,
    };
  }

  return {
    step: "codex-skills",
    status: created > 0 ? "created" : "updated",
    message: `${created} Codex skill(s) ${dryRun ? "would be created" : "created"}, ${updated} ${dryRun ? "would be updated" : "updated"}${missingSources > 0 ? `, ${missingSources} fallback(s)` : ""}`,
  };
}

function initStore(projectDir: string): void {
  const storeDir = path.join(projectDir, STORE_DIR);
  mkdirSync(storeDir, { recursive: true });

  const store = SqliteStore.open(projectDir);
  const projectName = path.basename(projectDir);
  store.initProject(projectName);
  store.close();

  logger.info("Database initialized", { dir: STORE_DIR });
}

function generateAndUpdateDocs(projectDir: string, dryRun?: boolean): UpdateStepResult {
  // Only run inside the mcp-graph source repo
  const toolsDir = path.join(projectDir, "src", "mcp", "tools");
  const apiDir = path.join(projectDir, "src", "api");
  if (!existsSync(toolsDir) || !existsSync(apiDir)) {
    return { step: "docs", status: "skipped", message: "Not inside mcp-graph repo, skipping auto-docs" };
  }

  const tools = introspectTools(toolsDir);
  const routes = introspectRoutes(apiDir);

  const targets = [
    { file: "README.md", section: "readme-stats", content: generateReadmeStats(tools, routes) },
    { file: "docs/architecture/ARCHITECTURE-GUIDE.md", section: "arch-mcp", content: generateArchToolSection(tools) },
    { file: "docs/architecture/ARCHITECTURE-GUIDE.md", section: "arch-api", content: generateArchRouteSection(routes) },
    { file: "docs/reference/MCP-TOOLS-REFERENCE.md", section: "tools-summary", content: generateToolRefSummary(tools) },
  ];

  let changed = 0;
  for (const target of targets) {
    const filePath = path.join(projectDir, target.file);
    if (!existsSync(filePath)) continue;

    const existing = readFileSync(filePath, "utf-8");
    const updated = applySectionWithName(existing, target.section, target.content);

    if (existing !== updated) {
      if (!dryRun) {
        writeFileSync(filePath, updated, "utf-8");
      }
      changed++;
      logger.info(`Auto-docs: ${target.file} [${target.section}] updated`);
    }
  }

  if (changed === 0) {
    return { step: "docs", status: "up-to-date", message: "All docs up-to-date" };
  }

  return {
    step: "docs",
    status: dryRun ? "up-to-date" : "updated",
    message: `${changed} doc section(s) ${dryRun ? "would be " : ""}updated`,
  };
}

// --- Public API ---

/** runUpdate — auto-generated description placeholder. */
export async function runUpdate(
  projectDir: string,
  options: UpdateOptions = {},
): Promise<UpdateReport> {
  const dbPath = path.join(projectDir, STORE_DIR, "graph.db");

  if (!existsSync(dbPath)) {
    throw new GraphNotInitializedError();
  }

  const steps: UpdateStepResult[] = [];
  const shouldRun = (step: string): boolean =>
    !options.only || options.only.includes(step);

  // 1. DB migrations
  if (shouldRun("db")) {
    const store = SqliteStore.open(projectDir);
    store.close();
    steps.push({ step: "db", status: "up-to-date", message: "Database migrations applied" });
  }

  // 2. Config files
  if (shouldRun("mcp-json")) steps.push(writeMcpJson(projectDir, options.dryRun));
  if (shouldRun("vscode-mcp")) steps.push(writeVscodeMcpJson(projectDir, options.dryRun));
  if (shouldRun("gitignore")) steps.push(ensureGitignore(projectDir, options.dryRun));

  // 3. MCP dependencies
  if (shouldRun("deps")) {
    const depResults = await installAllMcpDeps(projectDir);
    const ready = depResults.filter((r) => r.status === "installed" || r.status === "already_available");
    steps.push({
      step: "deps",
      status: "up-to-date",
      message: `MCP dependencies: ${ready.length}/${depResults.length} ready`,
    });
  }

  // 3b. LSP language server dependencies
  if (shouldRun("lsp-deps")) {
    const registry = new ServerRegistry();
    const detected = detectProjectLanguages(projectDir, registry);
    const langIds = detected.map((d) => d.languageId);
    const lspResults = await installLspDeps(langIds);
    const available = lspResults.filter((r) => r.status === "already_available");
    const missing = lspResults.filter((r) => r.status === "not_found");
    const hints = missing.map((r) => `${r.languageId}: ${r.installHint ?? r.message}`).join("; ");
    steps.push({
      step: "lsp-deps",
      status: missing.length === 0 ? "up-to-date" : "updated",
      message: `LSP servers: ${available.length}/${lspResults.length} available${missing.length > 0 ? `. Missing: ${hints}` : ""}`,
    });
  }

  // 4. AI instruction files
  const config = loadConfig(projectDir);
  const ctxMode = config.contextMode;
  if (shouldRun("claude-md")) steps.push(generateAndWriteClaudeMd(projectDir, options.dryRun, ctxMode));
  if (shouldRun("copilot-md")) steps.push(generateAndWriteCopilotInstructions(projectDir, options.dryRun, ctxMode));
  if (shouldRun("codex-md")) steps.push(generateAndWriteCodexAgentsMd(projectDir, options.dryRun, ctxMode));
  if (shouldRun("codex-skills")) steps.push(generateAndWriteCodexSkills(projectDir, options.dryRun));

  // 5. Ignore files — always rewrite to match latest template so
  // template improvements reach existing projects on `update`.
  if (shouldRun("ignore-files")) {
    const claudeResult = updateClaudeIgnore(projectDir, options.dryRun);
    steps.push({ step: "ignore-files", status: claudeResult.status, message: claudeResult.message });
    const copilotResult = updateCopilotIgnore(projectDir, options.dryRun);
    steps.push({ step: "ignore-files", status: copilotResult.status, message: copilotResult.message });
  }

  // 6. Auto-docs (only inside mcp-graph repo)
  if (shouldRun("docs")) {
    steps.push(generateAndUpdateDocs(projectDir, options.dryRun));
  }

  const report: UpdateReport = {
    steps,
    hasChanges: steps.some((s) => s.status === "updated" || s.status === "created"),
  };

  logger.info("mcp-graph update complete", {
    updated: steps.filter((s) => s.status === "updated").length,
    upToDate: steps.filter((s) => s.status === "up-to-date").length,
  });

  return report;
}

/** runInit — auto-generated description placeholder. */
export async function runInit(projectDir: string): Promise<void> {
  logger.info("mcp-graph init", { dir: projectDir });

  initStore(projectDir);
  writeMcpJson(projectDir);
  writeVscodeMcpJson(projectDir);
  ensureGitignore(projectDir);

  // Install/verify MCP ecosystem dependencies
  const depResults = await installAllMcpDeps(projectDir);
  const installed = depResults.filter((r) => r.status === "installed" || r.status === "already_available");
  const failed = depResults.filter((r) => r.status === "failed" || r.status === "skipped");

  if (installed.length > 0) {
    logger.success("MCP dependencies ready", {
      ready: installed.map((r) => r.name).join(", "),
    });
  }
  if (failed.length > 0) {
    logger.warn("Some MCP dependencies unavailable", {
      unavailable: failed.map((r) => `${r.name}: ${r.message}`).join("; "),
    });
  }

  // Generate AI instruction files (idempotent)
  const initConfig = loadConfig(projectDir);
  generateAndWriteClaudeMd(projectDir, undefined, initConfig.contextMode);
  generateAndWriteCopilotInstructions(projectDir, undefined, initConfig.contextMode);
  generateAndWriteCodexAgentsMd(projectDir, undefined, initConfig.contextMode);
  generateAndWriteCodexSkills(projectDir);

  // Generate ignore files (does NOT overwrite existing)
  ensureClaudeIgnore(projectDir);
  ensureCopilotIgnore(projectDir);

  logger.success("mcp-graph initialized", {
    dir: projectDir,
    store: STORE_DIR,
  });
}
