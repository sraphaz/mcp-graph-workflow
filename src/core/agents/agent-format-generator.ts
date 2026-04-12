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
  return JSON.stringify({
    phase: ctx.phase,
    principles: ctx.constitutionPrinciples ?? [],
    tasks: (ctx.relevantNodes ?? []).map((n) => ({ id: n.id, title: n.title, status: n.status })),
    specContext: ctx.specContext ?? null,
  }, null, 2);
}

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

export function listFormats(): FormatDef[] {
  return [...FORMATS];
}

export function listAgents(): AgentDef[] {
  return [...AGENTS];
}
