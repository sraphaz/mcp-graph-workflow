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
 * MCP Tool — validate
 * Consolidated validation tool (task browser validation + AC quality check).
 * Replaces separate validate_task and validate_ac tools.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { runValidation } from "../../core/capture/validate-runner.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { indexCapture } from "../../core/rag/capture-indexer.js";
import { indexAcValidationResult } from "../../core/rag/validation-indexer.js";
import { indexEntitiesForSource } from "../../core/rag/entity-index-hook.js";
import { validateAcQuality } from "../../core/analyzer/ac-validator.js";
import { createLogger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

const log = createLogger({ layer: "mcp", source: "validate.ts" });

/** registerValidate — auto-generated description placeholder. */
export function registerValidate(server: McpServer, store: SqliteStore): void {
  server.tool(
    "validate",
    "Validate tasks: browser-based validation (task) or acceptance criteria quality check (ac)",
    {
      action: z.enum(["task", "ac"]).describe("Action: 'task' for browser validation, 'ac' for AC quality check"),
      // task params
      url: z.string().url().optional().describe("URL to validate — required for action 'task'"),
      compareUrl: z.string().url().optional().describe("Second URL for A/B comparison (task only)"),
      selector: z.string().optional().describe("CSS selector to scope content extraction (task only)"),
      // shared
      nodeId: z.string().optional().describe("Graph node ID (task: associate validation; ac: validate specific node)"),
      // ac params
      all: z.boolean().optional().describe("Validate all nodes with AC (ac only, default: true if no nodeId)"),
    },
    async ({ action, url, compareUrl, selector, nodeId, all }) => {
      log.debug("tool:validate", { action, nodeId });

      if (action === "task") {
        if (!url) {
          return mcpError("url is required for task action");
        }

        const resultValue = await runValidation(url, { compareUrl, selector });

        // Index captured content into knowledge store
        const knowledgeStore = new KnowledgeStore(store.getDb());
        indexCapture(knowledgeStore, resultValue.primary);
        if (resultValue.comparison) {
          indexCapture(knowledgeStore, resultValue.comparison);
        }
        indexEntitiesForSource(store.getDb(), "web_capture");

        const response: Record<string, unknown> = {
          ok: true,
          url,
          wordCount: resultValue.primary.wordCount,
          title: resultValue.primary.title,
          timestamp: resultValue.timestamp,
        };

        if (nodeId) {
          response.nodeId = nodeId;
        }

        if (resultValue.diff) {
          response.comparison = {
            compareUrl,
            wordCountDelta: resultValue.diff.wordCountDelta,
            lengthDelta: resultValue.diff.lengthDelta,
          };
        }

        // V11 Maestro Phase 4.3 — soft deprecation in favor of graph_validate_ui.
        response._deprecation_notice = {
          stage: "advisory",
          replacement: "graph_validate_ui",
          migrationDoc: "docs/migration/v11-maestro-surface.md",
          reason: "validate(action=task) is being replaced by graph_validate_ui (plan-payload routed to Playwright MCP).",
          since: "v11.0.0",
        };

        log.info("tool:validate:task:ok", { nodeId, url, deprecated: true });
        return mcpText(response);
      }

      // action === "ac"
      const doc = store.toGraphDocument();
      const report = validateAcQuality(doc, nodeId, all ?? !nodeId);

      // Index AC validation results into knowledge store
      if (report.nodes.length > 0) {
        try {
          const knowledgeStore = new KnowledgeStore(store.getDb());
          for (const nodeReport of report.nodes) {
            indexAcValidationResult(knowledgeStore, {
              nodeId: nodeReport.nodeId,
              acResults: nodeReport.investChecks.map((c) => ({
                criterion: c.criterion,
                passed: c.passed,
                reason: !c.passed ? c.details : undefined,
              })),
              overallScore: nodeReport.score,
            });
          }
          indexEntitiesForSource(store.getDb(), "validation_result");
        } catch (err) {
          log.warn("tool:validate:ac:index_failed", { error: String(err) });
        }
      }

      log.info("tool:validate:ac:ok", { nodes: report.nodes.length, score: report.overallScore });
      return mcpText({ ok: true, ...report });
    },
  );
}
