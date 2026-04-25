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
 * Multi-Agent Format Generator — generates context-aware instructions for AI agents.
 * ADR-11: template rendering per format, no AST intermediary.
 */

export type AgentFormat = "markdown" | "toml" | "skill_md" | "json";

export interface AgentContext {
  phase: string;
  constitutionPrinciples?: Array<{ title: string; description: string }>;
  relevantNodes?: Array<{ id: string; title: string; status: string }>;
  specContext?: string;
  /**
   * v11 Context-Pollination: pre-rendered markdown from done sibling subtasks
   * the current task depends on. Empty string / undefined means no pollination —
   * templates should render nothing (silent absence).
   */
  siblingContext?: string;
}

interface AgentDef {
  name: string;
  description: string;
  defaultFormat: AgentFormat;
}

interface FormatDef {
  name: AgentFormat;
  extension: string;
  description: string;
}

const AGENTS: AgentDef[] = [
  { name: "claude", description: "Anthropic Claude (CLAUDE.md format)", defaultFormat: "markdown" },
  { name: "cursor", description: "Cursor Agent (.cursorrules TOML)", defaultFormat: "toml" },
  { name: "copilot", description: "GitHub Copilot (skill.md format)", defaultFormat: "skill_md" },
  { name: "windsurf", description: "Windsurf Agent (markdown)", defaultFormat: "markdown" },
  { name: "codex", description: "OpenAI Codex (markdown)", defaultFormat: "markdown" },
  { name: "generic", description: "Generic agent (JSON)", defaultFormat: "json" },
];

const FORMATS: FormatDef[] = [
  { name: "markdown", extension: ".md", description: "Markdown instructions (CLAUDE.md compatible)" },
  { name: "toml", extension: ".toml", description: "TOML configuration (.cursorrules compatible)" },
  { name: "skill_md", extension: ".md", description: "Skill.md with YAML frontmatter" },
  { name: "json", extension: ".json", description: "Structured JSON instructions" },
];

function renderMarkdown(agent: string, ctx: AgentContext): string {
  const lines: string[] = [];
  lines.push(`# ${agent.charAt(0).toUpperCase() + agent.slice(1)} Instructions`);
  lines.push("");
  lines.push(`## Current Phase: ${ctx.phase}`);
  lines.push("");

  if (ctx.constitutionPrinciples?.length) {
    lines.push("## Constitution Principles");
    lines.push("");
    for (const p of ctx.constitutionPrinciples) {
      lines.push(`- **${p.title}**: ${p.description}`);
    }
    lines.push("");
  }

  if (ctx.relevantNodes?.length) {
    lines.push("## Active Tasks");
    lines.push("");
    for (const node of ctx.relevantNodes) {
      lines.push(`- [${node.status}] ${node.title} (${node.id})`);
    }
    lines.push("");
  }

  if (ctx.specContext) {
    lines.push("## Spec Context");
    lines.push("");
    lines.push(ctx.specContext);
    lines.push("");
  }

  if (ctx.siblingContext && ctx.siblingContext.length > 0) {
    lines.push("## Sibling Context (v11 Context-Pollination)");
    lines.push("");
    lines.push("Outputs from predecessor subtasks this task depends on. Extend — do not reinvent:");
    lines.push("");
    lines.push(ctx.siblingContext);
    lines.push("");
  }

  return lines.join("\n");
}

function renderToml(agent: string, ctx: AgentContext): string {
  const lines: string[] = [];
  lines.push(`[agent]`);
  lines.push(`name = "${agent}"`);
  lines.push(`phase = "${ctx.phase}"`);
  lines.push("");

  if (ctx.constitutionPrinciples?.length) {
    lines.push("[principles]");
    for (let i = 0; i < ctx.constitutionPrinciples.length; i++) {
      const p = ctx.constitutionPrinciples[i];
      lines.push(`[principles.p${i + 1}]`);
      lines.push(`title = "${p.title}"`);
      lines.push(`description = "${p.description}"`);
    }
    lines.push("");
  }

  if (ctx.relevantNodes?.length) {
    lines.push("[tasks]");
    for (const node of ctx.relevantNodes) {
      lines.push(`[[tasks.active]]`);
      lines.push(`id = "${node.id}"`);
      lines.push(`title = "${node.title}"`);
      lines.push(`status = "${node.status}"`);
    }
    lines.push("");
  }

  if (ctx.siblingContext && ctx.siblingContext.length > 0) {
    // TOML multi-line string — escape triple-quotes defensively and emit as block
    const escaped = ctx.siblingContext.replace(/"""/g, '\\"\\"\\"');
    lines.push("[sibling_context]");
    lines.push(`markdown = """`);
    lines.push(escaped);
    lines.push(`"""`);
  }

  return lines.join("\n");
}

function renderSkillMd(agent: string, ctx: AgentContext): string {
  const lines: string[] = [];
  lines.push("---");
  lines.push(`description: Instructions for ${agent} agent in ${ctx.phase} phase`);
  lines.push(`phase: ${ctx.phase}`);
  lines.push("---");
  lines.push("");
  lines.push(renderMarkdown(agent, ctx));
  return lines.join("\n");
}

function renderJson(_agent: string, ctx: AgentContext): string {
  const out: Record<string, unknown> = {
    phase: ctx.phase,
    principles: ctx.constitutionPrinciples ?? [],
    tasks: (ctx.relevantNodes ?? []).map((n) => ({ id: n.id, title: n.title, status: n.status })),
    specContext: ctx.specContext ?? null,
  };
  if (ctx.siblingContext && ctx.siblingContext.length > 0) {
    out.siblingContext = ctx.siblingContext;
  }
  return JSON.stringify(out, null, 2);
}

/** Render context-aware agent instructions in the specified output format. */
export function generateAgentInstructions(
  agentName: string,
  format: AgentFormat,
  context: AgentContext,
): string {
  switch (format) {
    case "markdown": return renderMarkdown(agentName, context);
    case "toml": return renderToml(agentName, context);
    case "skill_md": return renderSkillMd(agentName, context);
    case "json": return renderJson(agentName, context);
  }
}

/** List all supported output formats with their extensions and descriptions. */
export function listFormats(): FormatDef[] {
  return [...FORMATS];
}

/** List all supported AI agent definitions with their default formats. */
export function listAgents(): AgentDef[] {
  return [...AGENTS];
}
