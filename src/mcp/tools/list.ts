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
import type { NodeType, NodeStatus } from "../../core/graph/graph-types.js";
import { NodeTypeSchema, NodeStatusSchema } from "../../schemas/node.schema.js";
import { LockManager } from "../../core/store/lock-manager.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

export function registerList(server: McpServer, store: SqliteStore): void {
  server.tool(
    "list",
    "List graph nodes with optional type/status/sprint filters",
    {
      type: NodeTypeSchema.optional().describe("Filter by node type"),
      status: NodeStatusSchema.optional().describe("Filter by node status"),
      sprint: z.string().optional().describe("Filter by sprint name"),
      limit: z.number().min(1).max(500).optional().default(50).describe("Max nodes to return (1-500, default 50)"),
      offset: z.number().min(0).optional().default(0).describe("Number of nodes to skip (default 0)"),
    },
    async ({ type, status, sprint, limit: rawLimit, offset: rawOffset }) => {
      const limit = rawLimit ?? 50;
      const offset = rawOffset ?? 0;
      logger.debug("tool:list", { type, status, sprint, limit, offset });
      let nodes;

      if (type && status) {
        nodes = store
          .getNodesByType(type as NodeType)
          .filter((n) => n.status === status);
      } else if (type) {
        nodes = store.getNodesByType(type as NodeType);
      } else if (status) {
        nodes = store.getNodesByStatus(status as NodeStatus);
      } else {
        nodes = store.getAllNodes();
      }

      // Apply sprint filter
      if (sprint) {
        nodes = nodes.filter((n) => n.sprint === sprint);
      }

      // Sort: priority ASC, then createdAt ASC
      nodes.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.createdAt.localeCompare(b.createdAt);
      });

      const total = nodes.length;
      const paginatedNodes = nodes.slice(offset, offset + limit);

      // Build lock info map when teamTask mode is on
      const teamTaskMode = store.getProjectSetting("team_task_mode") === "on";
      let lockMap: Map<string, { agentId: string; expiresAt: string }> | undefined;
      if (teamTaskMode) {
        try {
          const lm = new LockManager(store.getDb());
          lockMap = new Map();
          for (const lock of lm.listActive()) {
            if (lock.resourceType === "task") {
              const nodeId = lock.resourceId.replace("task:", "");
              lockMap.set(nodeId, { agentId: lock.agentId, expiresAt: lock.expiresAt });
            }
          }
        } catch { /* non-blocking */ }
      }

      const summary = paginatedNodes.map((n) => {
        const base: Record<string, unknown> = {
          id: n.id,
          type: n.type,
          title: n.title,
          status: n.status,
          priority: n.priority,
          sprint: n.sprint ?? null,
          parentId: n.parentId ?? null,
        };
        if (lockMap) {
          const lockInfo = lockMap.get(n.id);
          if (lockInfo) {
            base.lockedBy = lockInfo.agentId;
            base.lockExpiresAt = lockInfo.expiresAt;
          }
        }
        return base;
      });

      logger.info("tool:list:ok", { total, limit, offset, returned: paginatedNodes.length });
      // Bug #065: warn when offset exceeds total
      const result: Record<string, unknown> = { total, limit, offset, hasMore: offset + limit < total, nodes: summary };
      if (offset >= total && total > 0) {
        result.warning = `offset (${offset}) exceeds total results (${total})`;
      }
      return mcpText(result);
    },
  );
}
