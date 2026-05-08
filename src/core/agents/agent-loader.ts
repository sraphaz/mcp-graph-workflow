/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { parse as parseYaml } from "yaml";
import { McpGraphError } from "../utils/errors.js";
import { createLogger } from "../utils/logger.js";
import { AgentDefinitionSchema, type AgentDefinition } from "../../schemas/agent.schema.js";

const log = createLogger({ layer: "core", source: "agent-loader.ts" });

export class AgentLoadError extends McpGraphError {
  constructor(message: string, public readonly filePath?: string) {
    super(message);
    this.name = "AgentLoadError";
  }
}

/**
 * Extracts YAML frontmatter from markdown content.
 * Returns null if no frontmatter delimiters found.
 */
function extractFrontmatter(content: string): unknown {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    throw new AgentLoadError("No YAML frontmatter found (expected --- delimiters)");
  }
  try {
    return parseYaml(match[1]);
  } catch (err) {
    throw new AgentLoadError(`Invalid YAML frontmatter: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Loads and validates an agent definition from markdown string content.
 *
 * @param content    - Full markdown content including frontmatter
 * @param filename   - Filename (e.g. "prd-analyst.md") — stem must match frontmatter.name
 * @param phaseDir   - Parent directory name as a lifecycle phase (e.g. "ANALYZE")
 */
export function loadAgentFromContent(
  content: string,
  filename: string,
  phaseDir: string,
): AgentDefinition {
  const raw = extractFrontmatter(content);

  const parsed = AgentDefinitionSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => i.message).join("; ");
    log.warn("agent-loader:schema-invalid", { filename, issues });
    throw new AgentLoadError(`Schema validation failed for "${filename}": ${issues}`, filename);
  }

  const agent = parsed.data;

  // Filename guard: stem (without extension) must match frontmatter.name
  const stem = filename.replace(/\.md$/, "");
  if (stem !== agent.name) {
    log.warn("agent-loader:name-mismatch", { filename, frontmatterName: agent.name });
    throw new AgentLoadError(
      `Filename stem "${stem}" does not match frontmatter.name "${agent.name}" in "${filename}"`,
      filename,
    );
  }

  // Phase dir guard: parent directory must match frontmatter.phase
  if (phaseDir !== agent.phase) {
    log.warn("agent-loader:phase-mismatch", { phaseDir, frontmatterPhase: agent.phase, filename });
    throw new AgentLoadError(
      `Phase directory "${phaseDir}" does not match frontmatter.phase "${agent.phase}" in "${filename}"`,
      filename,
    );
  }

  log.debug("agent-loader:loaded", { name: agent.name, phase: agent.phase });
  return agent;
}

/**
 * Returns a SKILL.md scaffold template for the write-a-skill workflow.
 * When manage_skill(action: "create") is called without data, this template
 * is returned so the user can fill in the blanks.
 */
export function buildSkillScaffold(name = "<skill-name>"): string {
  return `---
name: ${name}
description: "<short description — used for discovery, keep under 120 chars>"
phase: <implement | design | plan | analyze | validate | review | any>
tools: [start_task, finish_task]
disable-model-invocation: false
---

# ${name}

<What this skill does and when to invoke it. 1-3 sentences.>

## When to Use

- <trigger condition or user signal 1>
- <trigger condition or user signal 2>

## Steps

1. <step 1>
2. <step 2>
3. <step 3>

## Output Format

\`\`\`
<Expected output structure>
\`\`\`
`;
}
