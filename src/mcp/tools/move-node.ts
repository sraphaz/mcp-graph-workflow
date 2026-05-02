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
import { NodeNotFoundError } from "../../core/utils/errors.js";
import { generateId } from "../../core/utils/id.js";
import { now } from "../../core/utils/time.js";
import type { RelationType } from "../../core/graph/graph-types.js";
import { logger } from "../../core/utils/logger.js";
import { checkCircularity } from "../../core/utils/circularity.js";
import { mcpText, mcpError } from "../response-helpers.js";

/** registerMoveNode — auto-generated description placeholder. */
export function registerMoveNode(server: McpServer, store: SqliteStore): void {
  server.tool(
    "move_node",
    "Move a node to a new parent in the hierarchy",
    {
      id: z.string().min(1).describe("The node ID to move"),
      newParentId: z.string().nullable().describe("New parent node ID (null to make root)"),
    },
    async ({ id, newParentId }) => {
      logger.debug("tool:move_node", { nodeId: id, newParentId });
      const node = store.getNodeById(id);
      if (!node) {
        const err = new NodeNotFoundError(id);
        return mcpError(err);
      }

      if (newParentId !== null) {
        const circError = checkCircularity(store, id, newParentId);
        if (circError) return mcpError(circError);

        const newParent = store.getNodeById(newParentId);
        if (!newParent) {
          const err = new NodeNotFoundError(newParentId);
          return mcpError(`New parent not found: ${err.message}`);
        }
      }

      const oldParentId = node.parentId;

      // Remove old parent/child edges
      if (oldParentId) {
        const edgesFrom = store.getEdgesFrom(oldParentId);
        for (const edge of edgesFrom) {
          if (edge.to === id && edge.relationType === "parent_of") {
            store.deleteEdge(edge.id);
          }
        }
        const edgesFrom2 = store.getEdgesFrom(id);
        for (const edge of edgesFrom2) {
          if (edge.to === oldParentId && edge.relationType === "child_of") {
            store.deleteEdge(edge.id);
          }
        }
      }

      // Update parentId
      store.updateNode(id, { parentId: newParentId });

      // Create new parent/child edges
      if (newParentId !== null) {
        const timestamp = now();
        store.insertEdge({
          id: generateId("edge"),
          from: newParentId,
          to: id,
          relationType: "parent_of" as RelationType,
          createdAt: timestamp,
        });
        store.insertEdge({
          id: generateId("edge"),
          from: id,
          to: newParentId,
          relationType: "child_of" as RelationType,
          createdAt: timestamp,
        });
      }

      const updated = store.getNodeById(id);
      if (!updated) {
        return mcpError(`Node ${id} not found after move operation`);
      }

      logger.info("tool:move_node:ok", { nodeId: id, from: oldParentId ?? null, to: newParentId });
      return mcpText({
        ok: true,
        moved: { id, from: oldParentId ?? null, to: newParentId },
        node: updated,
      });
    },
  );
}
