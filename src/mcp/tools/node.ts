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
 * MCP Tool — node
 * Consolidated CRUD for graph nodes (add, update, delete).
 * Replaces separate add_node, update_node, delete_node tools.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import type { GraphEdge, GraphNode, RelationType } from "../../core/graph/graph-types.js";
import { NodeTypeSchema, NodeStatusSchema, XpSizeSchema, PrioritySchema, GraphNodeSchema } from "../../schemas/node.schema.js";
import { NodeNotFoundError } from "../../core/utils/errors.js";
import { DEFAULT_NODE_STATUS, DEFAULT_NODE_PRIORITY } from "../../core/utils/constants.js";
import { generateId } from "../../core/utils/id.js";
import { now } from "../../core/utils/time.js";
import { logger } from "../../core/utils/logger.js";
import { checkCircularity } from "../../core/utils/circularity.js";
import { mcpText, mcpError, normalizeNewlines } from "../response-helpers.js";
import { indexNodeAsKnowledge, removeNodeFromKnowledge } from "../../core/rag/node-indexer.js";
import { extractAgentId } from "../agent-identity.js";

export function registerNode(server: McpServer, store: SqliteStore): void {
  server.tool(
    "node",
    "Manage graph nodes: add, update, delete, or batch_add",
    {
      action: z.enum(["add", "update", "delete", "batch_add"]).describe("Action to perform"),
      // add params
      type: NodeTypeSchema.optional().describe("Node type — required for add (epic, task, subtask, etc.)"),
      title: z.string().optional().describe("Node title — required for add"),
      description: z.string().optional().describe("Node description (add/update)"),
      status: NodeStatusSchema.optional().describe("Node status (add: default backlog, update: new status)"),
      priority: PrioritySchema.optional().describe("Priority 1-5 (add: default 3, update)"),
      xpSize: XpSizeSchema.optional().describe("Size: XS, S, M, L, XL (add/update)"),
      estimateMinutes: z.number().optional().describe("Time estimate in minutes (add/update)"),
      tags: z.array(z.string()).optional().describe("Tags for categorization (add/update)"),
      parentId: z.string().nullable().optional().describe("Parent node ID (add/update)"),
      sprint: z.string().nullable().optional().describe("Sprint identifier (add/update)"),
      acceptanceCriteria: z.array(z.string()).optional().describe("Acceptance criteria (add/update)"),
      acceptanceCriteria_append: z.array(z.string()).optional().describe("Append to existing acceptance criteria without replacing (update only)"),
      testFiles: z.array(z.string()).optional().describe("Test file paths that cover this node's ACs (add/update)"),
      blocked: z.boolean().optional().describe("Whether the node is blocked (add)"),
      autoSequence: z.boolean().optional().describe("Auto-create depends_on edge to previous sibling when parentId is set (add only)"),
      metadata: z.record(z.string(), z.unknown()).optional().describe("Custom metadata (add)"),
      evolutionReason: z.string().nullable().optional().describe("§extracta — Why this node was regenerated (update only). Increments evolution_count. Pass null to clear. Drives analyze(evolution_audit)."),
      // update/delete params
      id: z.string().min(1).optional().describe("Node ID — required for update/delete"),
      // batch_add params
      nodes: z.array(z.object({
        type: NodeTypeSchema,
        title: z.string(),
        description: z.string().optional(),
        status: NodeStatusSchema.optional(),
        priority: PrioritySchema.optional(),
        xpSize: XpSizeSchema.optional(),
        estimateMinutes: z.number().optional(),
        tags: z.array(z.string()).optional(),
        parentId: z.string().nullable().optional(),
        sprint: z.string().nullable().optional(),
        acceptanceCriteria: z.array(z.string()).optional(),
        blocked: z.boolean().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })).max(50).optional().describe("Array of nodes for batch_add (max 50)"),
    },
    async ({ action, id, type, title, description, status, priority, xpSize, estimateMinutes, tags, parentId, sprint, acceptanceCriteria, acceptanceCriteria_append, testFiles, blocked, autoSequence, metadata, nodes, evolutionReason }, extra) => {
      const agentId = extractAgentId(extra);
      logger.debug("tool:node", { action, id, type, title, agentId });

      if (action === "add") {
        if (!type || !title) {
          return mcpError("type and title are required for add action");
        }

        if (parentId) {
          const parent = store.getNodeById(parentId);
          if (!parent) {
            const err = new NodeNotFoundError(parentId);
            return mcpError(`Parent not found: ${err.message}`);
          }
        }

        const timestamp = now();
        // Sprint 7.6 #7.6.8 — auto-fill provenance metadata when absent.
        // Caller can pre-populate metadata.provenance to override (the
        // graph-importer / spec-sync paths already do this); for everyone
        // else we stamp source / actor / ts so downstream replay/audit
        // tooling can attribute the node to the channel that created it.
        const enrichedMetadata = ((): Record<string, unknown> | undefined => {
          if (metadata && typeof metadata.provenance === "object" && metadata.provenance !== null) {
            return metadata; // caller-supplied; respect.
          }
          const provenance = {
            source: "mcp" as const,
            actor: agentId ?? process.env.USER ?? "unknown",
            ts: timestamp,
          };
          return { ...(metadata ?? {}), provenance };
        })();
        const node = {
          id: generateId("node"),
          type,
          title,
          description: normalizeNewlines(description),
          status: status ?? DEFAULT_NODE_STATUS,
          priority: priority ?? DEFAULT_NODE_PRIORITY,
          xpSize,
          estimateMinutes,
          tags,
          parentId,
          sprint,
          acceptanceCriteria,
          testFiles,
          blocked,
          metadata: enrichedMetadata,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        store.insertNode(node, { agentId });

        if (parentId) {
          store.insertEdge({
            id: generateId("edge"),
            from: parentId,
            to: node.id,
            relationType: "parent_of" as RelationType,
            createdAt: timestamp,
          });
          store.insertEdge({
            id: generateId("edge"),
            from: node.id,
            to: parentId,
            relationType: "child_of" as RelationType,
            createdAt: timestamp,
          });

          if (autoSequence) {
            const siblings = store.toGraphDocument().nodes
              .filter(n => n.parentId === parentId && n.id !== node.id)
              .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
            const lastSibling = siblings[siblings.length - 1];
            if (lastSibling) {
              store.insertEdge({
                id: generateId("edge"),
                from: node.id,
                to: lastSibling.id,
                relationType: "depends_on" as RelationType,
                reason: "Auto-sequenced",
                createdAt: timestamp,
              });
            }
          }
        }

        indexNodeAsKnowledge(store.getDb(), node);
        logger.info("tool:node:add:ok", { nodeId: node.id, type: node.type });
        return mcpText({ ok: true, node });
      }

      if (action === "update") {
        if (!id) {
          return mcpError("id is required for update action");
        }

        // Handle acceptanceCriteria_append: merge with existing
        let mergedAC = acceptanceCriteria;
        if (acceptanceCriteria_append && acceptanceCriteria_append.length > 0 && !acceptanceCriteria) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- id validated at line ~120
          const existing = store.getNodeById(id!);
          if (existing) {
            mergedAC = [...(existing.acceptanceCriteria ?? []), ...acceptanceCriteria_append];
          }
        }

        const fields: Record<string, unknown> = {};
        if (title !== undefined) fields.title = title;
        if (description !== undefined) fields.description = normalizeNewlines(description);
        if (type !== undefined) fields.type = type;
        if (priority !== undefined) fields.priority = priority;
        if (xpSize !== undefined) fields.xpSize = xpSize;
        if (estimateMinutes !== undefined) fields.estimateMinutes = estimateMinutes;
        if (tags !== undefined) fields.tags = tags;
        if (sprint !== undefined) fields.sprint = sprint;
        if (parentId !== undefined) fields.parentId = parentId;
        if (mergedAC !== undefined) fields.acceptanceCriteria = mergedAC;
        if (testFiles !== undefined) fields.testFiles = testFiles;
        if (metadata !== undefined) fields.metadata = metadata;
        if (evolutionReason !== undefined) fields.evolutionReason = evolutionReason;

        // Bug #036: reject self-parenting and circularity in update action
        const circError = checkCircularity(store, id, parentId);
        if (circError) return mcpError(circError);

        // If parentId is changing, manage edges atomically (Bug #047)
        if (parentId !== undefined) {
          const db = store.getDb();
          db.transaction(() => {
            const existingNode = store.getNodeById(id);
            if (existingNode) {
              const oldParentId = existingNode.parentId;

              // Remove old parent/child edges
              if (oldParentId) {
                const edgesFromOldParent = store.getEdgesFrom(oldParentId);
                for (const edge of edgesFromOldParent) {
                  if (edge.to === id && edge.relationType === "parent_of") {
                    store.deleteEdge(edge.id);
                  }
                }
                const edgesFromNode = store.getEdgesFrom(id);
                for (const edge of edgesFromNode) {
                  if (edge.to === oldParentId && edge.relationType === "child_of") {
                    store.deleteEdge(edge.id);
                  }
                }
              }

              // Create new parent/child edges
              if (parentId !== null) {
                const timestamp = now();
                store.insertEdge({
                  id: generateId("edge"),
                  from: parentId,
                  to: id,
                  relationType: "parent_of" as RelationType,
                  createdAt: timestamp,
                });
                store.insertEdge({
                  id: generateId("edge"),
                  from: id,
                  to: parentId,
                  relationType: "child_of" as RelationType,
                  createdAt: timestamp,
                });
              }
            }
          })();
        }

        const updated = store.updateNode(id, fields, { agentId });
        if (!updated) {
          const err = new NodeNotFoundError(id);
          logger.warn("tool:node:update:fail", { error: err.message });
          return mcpError(err);
        }

        indexNodeAsKnowledge(store.getDb(), updated);
        logger.info("tool:node:update:ok", { id });
        return mcpText({ ok: true, node: updated });
      }

      if (action === "batch_add") {
        if (!nodes || nodes.length === 0) {
          return mcpError("nodes array is required for batch_add action");
        }

        if (nodes.length > 50) {
          return mcpError("batch_add supports at most 50 nodes");
        }

        const inserted: string[] = [];
        const errors: { index: number; message: string }[] = [];
        const validNodes: GraphNode[] = [];
        const autoEdges: GraphEdge[] = [];

        const batchNodeSchema = GraphNodeSchema.omit({ id: true, createdAt: true, updatedAt: true }).extend({
          status: NodeStatusSchema.optional(),
          priority: PrioritySchema.optional(),
        });

        for (let i = 0; i < nodes.length; i++) {
          const entry = nodes[i];

          const parsed = batchNodeSchema.safeParse(entry);
          if (!parsed.success) {
            errors.push({ index: i, message: parsed.error.message });
            continue;
          }

          // Validate parentId exists
          if (entry.parentId) {
            const parent = store.getNodeById(entry.parentId);
            if (!parent) {
              errors.push({ index: i, message: `Parent not found: ${entry.parentId}` });
              continue;
            }
          }

          const timestamp = now();
          const nodeId = generateId("node");
          const node: GraphNode = {
            id: nodeId,
            type: entry.type,
            title: entry.title,
            description: normalizeNewlines(entry.description),
            status: entry.status ?? DEFAULT_NODE_STATUS,
            priority: entry.priority ?? DEFAULT_NODE_PRIORITY,
            xpSize: entry.xpSize,
            estimateMinutes: entry.estimateMinutes,
            tags: entry.tags,
            parentId: entry.parentId,
            sprint: entry.sprint,
            acceptanceCriteria: entry.acceptanceCriteria,
            blocked: entry.blocked,
            // Sprint 7.6 #7.6.8 — same auto-fill as the single-add branch.
            metadata: ((): GraphNode["metadata"] => {
              const m = entry.metadata as Record<string, unknown> | undefined;
              if (m && typeof m.provenance === "object" && m.provenance !== null) {
                return m as GraphNode["metadata"];
              }
              const provenance = {
                source: "mcp" as const,
                actor: agentId ?? process.env.USER ?? "unknown",
                ts: timestamp,
              };
              return { ...(m ?? {}), provenance } as GraphNode["metadata"];
            })(),
            createdAt: timestamp,
            updatedAt: timestamp,
          };

          validNodes.push(node);
          inserted.push(nodeId);

          if (entry.parentId) {
            autoEdges.push({
              id: generateId("edge"),
              from: entry.parentId,
              to: nodeId,
              relationType: "parent_of" as RelationType,
              createdAt: timestamp,
            });
            autoEdges.push({
              id: generateId("edge"),
              from: nodeId,
              to: entry.parentId,
              relationType: "child_of" as RelationType,
              createdAt: timestamp,
            });
          }
        }

        if (validNodes.length > 0) {
          store.mergeInsert(validNodes, autoEdges);

          for (const node of validNodes) {
            indexNodeAsKnowledge(store.getDb(), node);
          }
        }

        logger.info("tool:node:batch_add:ok", { inserted: inserted.length, errors: errors.length });
        return mcpText({ ok: true, inserted, errors });
      }

      // action === "delete"
      if (!id) {
        return mcpError("id is required for delete action");
      }

      // Clean up knowledge BEFORE deleting node to avoid orphaned docs
      removeNodeFromKnowledge(store.getDb(), id);

      const deleted = store.deleteNode(id);
      if (!deleted) {
        const err = new NodeNotFoundError(id);
        logger.warn("tool:node:delete:fail", { error: err.message });
        return mcpError(err);
      }

      logger.info("tool:node:delete:ok", { id });
      return mcpText({ ok: true, deletedId: id });
    },
  );
}
