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
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import type { GraphEdge, RelationType } from "../../core/graph/graph-types.js";
import { RelationTypeSchema } from "../../schemas/edge.schema.js";
import { NodeNotFoundError } from "../../core/utils/errors.js";
import { generateId } from "../../core/utils/id.js";
import { now } from "../../core/utils/time.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";
import { sequenceSubtasks } from "../../core/graph/auto-sequence.js";

/** registerEdge — auto-generated description placeholder. */
export function registerEdge(server: McpServer, store: SqliteStore): void {
  server.tool(
    "edge",
    "Manage edges: add, delete, list, or batch_add relationships between nodes",
    {
      action: z.enum(["add", "delete", "list", "batch_add", "sequence"]).describe("Action to perform"),
      // add params
      from: z.string().optional().describe("Source node ID (required for add)"),
      to: z.string().optional().describe("Target node ID (required for add)"),
      relationType: RelationTypeSchema.optional().describe("Relationship type (required for add, optional filter for list)"),
      reason: z.string().optional().describe("Why this relationship exists (add only)"),
      weight: z.number().min(0).max(1).optional().describe("Edge weight 0-1 (add only)"),
      // delete params
      id: z.string().optional().describe("Edge ID (required for delete)"),
      // batch_add params
      edges: z.array(z.object({
        from: z.string(),
        to: z.string(),
        relationType: RelationTypeSchema,
        reason: z.string().optional(),
        weight: z.number().min(0).max(1).optional(),
      })).max(50).optional().describe("Array of edges for batch_add (max 50)"),
      // list params
      nodeId: z.string().optional().describe("Filter edges by node ID (list only)"),
      // sequence params
      parentId: z.string().optional().describe("Parent node ID for sequence action"),
      direction: z.enum(["from", "to", "both"]).optional().describe("Edge direction relative to nodeId (list only, default: both)"),
    },
    async ({ action, from, to, relationType, reason, weight, id, edges: batchEdges, nodeId, direction, parentId }) => {
      logger.debug("tool:edge", { action, from, to, relationType });
      if (action === "add") {
        if (!from || !to || !relationType) {
          return mcpError("from, to, and relationType are required for add action");
        }

        // Bug #077: check existence before self-reference for clearer error messages
        const fromNode = store.getNodeById(from);
        if (!fromNode) {
          return mcpError(new NodeNotFoundError(from));
        }

        const toNode = store.getNodeById(to);
        if (!toNode) {
          return mcpError(new NodeNotFoundError(to));
        }

        if (from === to) {
          return mcpError("Self-referencing edges are not allowed");
        }

        // Bug #045: atomic check-and-insert to prevent duplicate edges under concurrency
        const db = store.getDb();
        const resultValue = db.transaction(() => {
          const existingEdges = store.getEdgesFrom(from);
          const duplicate = existingEdges.find(
            (e) => e.to === to && e.relationType === (relationType as RelationType),
          );
          if (duplicate) {
            return { existing: true as const, edge: duplicate };
          }

          const edge = {
            id: generateId("edge"),
            from,
            to,
            relationType: relationType as RelationType,
            reason,
            weight,
            createdAt: now(),
          };
          store.insertEdge(edge);
          return { existing: false as const, edge };
        })();

        if (resultValue.existing) {
          logger.info("tool:edge:ok", { action: "existing", edgeId: resultValue.edge.id, from, to, relationType });
          return mcpText({ ok: true, edge: resultValue.edge, existing: true });
        }

        const edge = resultValue.edge;

        logger.info("tool:edge:ok", { action: "add", edgeId: edge.id, from, to, relationType });
        return mcpText({ ok: true, edge });
      }

      if (action === "batch_add") {
        if (!batchEdges || batchEdges.length === 0) {
          return mcpError("edges array is required for batch_add action");
        }

        if (batchEdges.length > 50) {
          return mcpError("batch_add supports at most 50 edges");
        }

        const inserted: string[] = [];
        const errors: { index: number; message: string }[] = [];
        const validEdges: GraphEdge[] = [];

        for (let i = 0; i < batchEdges.length; i++) {
          const entry = batchEdges[i];

          // Check from node exists
          const fromNode = store.getNodeById(entry.from);
          if (!fromNode) {
            errors.push({ index: i, message: `Node not found: ${entry.from}` });
            continue;
          }

          // Check to node exists
          const toNode = store.getNodeById(entry.to);
          if (!toNode) {
            errors.push({ index: i, message: `Node not found: ${entry.to}` });
            continue;
          }

          // Prevent self-reference
          if (entry.from === entry.to) {
            errors.push({ index: i, message: "Self-referencing edges are not allowed" });
            continue;
          }

          // Check duplicates
          const existingEdges = store.getEdgesFrom(entry.from);
          const duplicate = existingEdges.find(
            (e) => e.to === entry.to && e.relationType === (entry.relationType as RelationType),
          );
          if (duplicate) {
            errors.push({ index: i, message: `Duplicate edge: ${entry.from} → ${entry.to} (${entry.relationType})` });
            continue;
          }

          const edgeId = generateId("edge");
          const edge: GraphEdge = {
            id: edgeId,
            from: entry.from,
            to: entry.to,
            relationType: entry.relationType as RelationType,
            reason: entry.reason,
            weight: entry.weight,
            createdAt: now(),
          };

          validEdges.push(edge);
          inserted.push(edgeId);
        }

        if (validEdges.length > 0) {
          store.mergeInsert([], validEdges);
        }

        logger.info("tool:edge:batch_add:ok", { inserted: inserted.length, errors: errors.length });
        return mcpText({ ok: true, inserted, errors });
      }

      if (action === "sequence") {
        if (!parentId) {
          return mcpError("parentId is required for sequence action");
        }
        const parent = store.getNodeById(parentId);
        if (!parent) {
          return mcpError(new NodeNotFoundError(parentId));
        }

        const resultValue = sequenceSubtasks(store, parentId);
        logger.info("tool:edge:sequence:ok", { parentId, edgesCreated: resultValue.edgesCreated });
        return mcpText({ ok: true, ...resultValue });
      }

      if (action === "delete") {
        if (!id) {
          return mcpError("id is required for delete action");
        }

        const deleted = store.deleteEdge(id);
        if (!deleted) {
          return mcpError(`Edge not found: ${id}`);
        }

        logger.info("tool:edge:ok", { action: "delete", deletedId: id });
        return mcpText({ ok: true, deletedId: id });
      }

      // action === "list"
      // Bug #037: warn if direction is used without nodeId
      if (direction && !nodeId) {
        return mcpError("direction requires nodeId — without nodeId, all edges are returned regardless of direction");
      }

      let edges: GraphEdge[];

      if (nodeId) {
        const node = store.getNodeById(nodeId);
        if (!node) {
          return mcpError(new NodeNotFoundError(nodeId));
        }

        const dir = direction ?? "both";
        if (dir === "from") {
          edges = store.getEdgesFrom(nodeId);
        } else if (dir === "to") {
          edges = store.getEdgesTo(nodeId);
        } else {
          edges = [...store.getEdgesFrom(nodeId), ...store.getEdgesTo(nodeId)];
        }
      } else {
        edges = store.getAllEdges();
      }

      if (relationType) {
        edges = edges.filter((e) => e.relationType === (relationType as RelationType));
      }

      logger.info("tool:edge:ok", { action: "list", total: edges.length });
      return mcpText({ ok: true, total: edges.length, edges });
    },
  );
}
