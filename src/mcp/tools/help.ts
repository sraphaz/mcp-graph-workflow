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

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getToolReference,
  getAnalyzeModes,
  getSkillsByPhase,
  getCliCommands,
  getKnowledgePipeline,
  getPhaseGates,
  getDefinitionOfDone,
  getDefinitionOfReady,
  getToolPrerequisites,
  getWorkflows,
  getFlowPrinciples,
  getQualityMetrics,
  getTddEnforcement,
  getAgentAntipatterns,
  getPipelineTools,
  getHarnessReference,
  getVersionReference,
  getFullReference,
} from "../../core/config/reference-content.js";
import { createLogger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

const log = createLogger({ layer: "mcp", source: "help.ts" });

const WORKFLOW_SECTION = `### Fluxo de trabalho OBRIGATÓRIO

\`\`\`
next → context(compact) → context(rag) → [implementar com TDD] → analyze(implement_done) → update_status → next
\`\`\`

### Lifecycle (9 fases)

1. **ANALYZE** — Criar PRD, definir requisitos
2. **DESIGN** — Arquitetura, decisões técnicas
3. **PLAN** — Sprint planning, decomposição
4. **IMPLEMENT** — TDD Red→Green→Refactor
5. **VALIDATE** — Testes E2E, critérios de aceitação
6. **REVIEW** — Code review, blast radius
7. **HANDOFF** — PR, documentação, entrega
8. **DEPLOY** — CI pipeline, release, post-release validation
9. **LISTENING** — Feedback, novo ciclo`;

type HelpTopic =
  | "tools"
  | "analyze_modes"
  | "skills"
  | "cli"
  | "knowledge"
  | "workflow"
  | "gates"
  | "dod"
  | "dor"
  | "prerequisites"
  | "workflows"
  | "flow"
  | "quality_metrics"
  | "tdd"
  | "pipeline"
  | "antipatterns"
  | "harness"
  | "version"
  | "all";

function getTopicContent(topic: HelpTopic, phase?: string): string {
  switch (topic) {
    case "tools":
      return getToolReference(phase);
    case "analyze_modes":
      return getAnalyzeModes(phase);
    case "skills":
      return getSkillsByPhase(phase);
    case "cli":
      return getCliCommands();
    case "knowledge":
      return getKnowledgePipeline();
    case "workflow":
      return WORKFLOW_SECTION;
    case "gates":
      return getPhaseGates();
    case "dod":
      return getDefinitionOfDone();
    case "prerequisites":
      return getToolPrerequisites();
    case "workflows":
      return getWorkflows();
    case "dor":
      return getDefinitionOfReady();
    case "flow":
      return getFlowPrinciples();
    case "quality_metrics":
      return getQualityMetrics();
    case "tdd":
      return getTddEnforcement();
    case "pipeline":
      return getPipelineTools();
    case "antipatterns":
      return getAgentAntipatterns();
    case "harness":
      return getHarnessReference();
    case "version":
      return getVersionReference();
    case "all":
      return getFullReference();
  }
}

/** registerHelp — auto-generated description placeholder. */
export function registerHelp(server: McpServer): void {
  server.tool(
    "help",
    "On-demand reference for mcp-graph tools, analyze modes, skills, CLI commands, and workflow. Use this instead of memorizing static docs.",
    {
      topic: z
        .enum([
          "tools",
          "analyze_modes",
          "skills",
          "cli",
          "knowledge",
          "workflow",
          "gates",
          "dod",
          "dor",
          "prerequisites",
          "workflows",
          "flow",
          "quality_metrics",
          "tdd",
          "pipeline",
          "antipatterns",
          "harness",
          "version",
          "all",
        ])
        .describe("Reference topic to query"),
      phase: z
        .string()
        .optional()
        .describe(
          "Lifecycle phase to filter by (ANALYZE, DESIGN, PLAN, IMPLEMENT, VALIDATE, REVIEW, HANDOFF, DEPLOY, LISTENING)",
        ),
    },
    async ({ topic, phase }) => {
      log.debug("tool:help", { topic, phase });

      const content = getTopicContent(topic, phase);
      const phaseLabel = phase ? ` (fase: ${phase.toUpperCase()})` : "";

      log.info("tool:help:ok", {
        topic,
        phase,
        chars: content.length,
      });

      return mcpText({
        topic,
        phase: phase ?? null,
        label: `Referência: ${topic}${phaseLabel}`,
        content,
      });
    },
  );
}
