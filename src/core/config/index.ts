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

export { MARKER_START, MARKER_END, generateClaudeMdSection, generateCopilotInstructions, generateCodexAgentsMdSection, applySection } from './ai-memory-generator.js';
export { loadConfig } from './config-loader.js';
export { ContextModeSchema, ConfigSchema } from './config-schema.js';
export type { ContextMode, McpGraphConfig } from './config-schema.js';
export { getIgnoreTemplate, ensureClaudeIgnore, ensureCopilotIgnore } from './ignore-templates.js';
export { resolveLayeredConfig } from './layered-config.js';
export type { ConfigField, LayeredConfigResult, ResolveOptions } from './layered-config.js';
export { TOOL_TABLE_FULL, DEPRECATED_TOOLS_SECTION, ANALYZE_MODES_SECTION, KNOWLEDGE_PIPELINE_SECTION, SKILLS_SECTION, PHASE_GATES_SECTION, DOD_SECTION, TOOL_PREREQUISITES_SECTION, WORKFLOWS_SECTION, AGENT_ANTIPATTERNS_SECTION, FLOW_PRINCIPLES_SECTION, QUALITY_METRICS_SECTION, DOR_SECTION, TDD_ENFORCEMENT_SECTION, PIPELINE_TOOLS_SECTION, TEAM_TASK_SECTION, DREAM_MODE_SECTION, AGENT_ACTIVITY_SECTION, ADVANCED_TOOLS_SECTION, OPERATIONAL_TOOLS_SECTION, CLI_COMMANDS, getToolReference, getAnalyzeModes, getSkillsByPhase, getCliCommands, getKnowledgePipeline, getPhaseGates, getDefinitionOfDone, getToolPrerequisites, getWorkflows, getAgentAntipatterns, getFlowPrinciples, getQualityMetrics, getDefinitionOfReady, getTddEnforcement, getPipelineTools, HARNESS_SECTION, getHarnessReference, getFullReference } from './reference-content.js';
