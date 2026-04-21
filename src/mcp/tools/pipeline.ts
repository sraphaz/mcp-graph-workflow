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
 * MCP Tool — pipeline
 * Execute sequential tool chains programmatically.
 * Results never enter LLM conversation context — only final summary returned.
 * Inspired by hermes-agent Programmatic Tool Calling (PTC).
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { ToolPipeline, type ToolHandler } from "../../core/pipeline/tool-pipeline.js";
import { PipelineStepSchema } from "../../schemas/pipeline.schema.js";
import { logger } from "../../core/utils/logger.js";
import { McpGraphError, NodeNotFoundError } from "../../core/utils/errors.js";
import { mcpText, mcpError } from "../response-helpers.js";

/**
 * Build a map of simple tool handlers for the pipeline.
 * Each handler wraps a store operation (read-only, safe for automation).
 */
function buildPipelineHandlers(store: SqliteStore): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  // list: list graph nodes
  handlers.set("list", async (args) => {
    const a = args as Record<string, unknown>;
    const doc = store.toGraphDocument();
    const type = a.type as string | undefined;
    const status = a.status as string | undefined;
    let nodes = doc.nodes;
    if (type) nodes = nodes.filter((n) => n.type === type);
    if (status) nodes = nodes.filter((n) => n.status === status);
    return {
      total: nodes.length,
      nodes: nodes.map((n) => ({ id: n.id, title: n.title, type: n.type, status: n.status, priority: n.priority })),
    };
  });

  // show: show a single node
  handlers.set("show", async (args) => {
    const a = args as Record<string, unknown>;
    const id = a.id as string | undefined;
    if (!id) throw new McpGraphError("show requires id");
    const doc = store.toGraphDocument();
    const node = doc.nodes.find((n) => n.id === id);
    if (!node) throw new NodeNotFoundError(`Node ${id} not found`);
    return node;
  });

  // metrics: basic project metrics
  handlers.set("metrics", async (_args) => {
    const doc = store.toGraphDocument();
    const done = doc.nodes.filter((n) => n.status === "done").length;
    const total = doc.nodes.length;
    return { total, done, completion: total > 0 ? Math.round((done / total) * 100) : 0 };
  });

  // search: full-text search
  handlers.set("search", async (args) => {
    const a = args as Record<string, unknown>;
    const query = a.query as string | undefined;
    if (!query) throw new McpGraphError("search requires query");
    const { searchNodes } = await import("../../core/search/fts-search.js");
    const results = searchNodes(store, query, { limit: 20, rerank: false });
    return {
      total: results.length,
      results: results.map((r) => ({ id: r.node.id, title: r.node.title, score: r.score })),
    };
  });

  return handlers;
}

export function registerPipeline(server: McpServer, store: SqliteStore): void {
  server.tool(
    "pipeline",
    "Execute a sequential chain of graph operations programmatically. Results are summarized without consuming LLM context.",
    {
      steps: z
        .array(
          z.object({
            tool: z.string().min(1).describe("Tool to call (list, show, metrics, search)"),
            args: z.record(z.string(), z.unknown()).optional().describe("Arguments for the tool"),
            extractField: z.string().optional().describe("Field to extract and pass to next step"),
          }),
        )
        .min(1)
        .max(10)
        .describe("Pipeline steps to execute in sequence (max 10)"),
    },
    async ({ steps }) => {
      logger.debug("tool:pipeline", { stepCount: steps.length });

      const project = store.getProject();
      if (!project) {
        return mcpError("No active project. Run init first.");
      }

      // Parse and validate steps
      const parsedSteps = steps.map((s, i) => {
        const result = PipelineStepSchema.safeParse({ tool: s.tool, args: s.args ?? {}, extractField: s.extractField });
        if (!result.success) {
          throw new McpGraphError(`Step ${i} validation failed: ${JSON.stringify(result.error.issues)}`);
        }
        return result.data;
      });

      const handlers = buildPipelineHandlers(store);
      const pipeline = new ToolPipeline(handlers);

      try {
        const result = await pipeline.execute(parsedSteps);
        logger.info("tool:pipeline:ok", {
          stepsTotal: result.stepsTotal,
          stepsCompleted: result.stepsCompleted,
          stepsFailed: result.stepsFailed,
          totalDurationMs: result.totalDurationMs,
        });
        return mcpText(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("tool:pipeline:error", { error: message });
        return mcpError(message);
      }
    },
  );
}
