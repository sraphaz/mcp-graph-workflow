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

import { Router } from "express";
import { z } from "zod/v4";
import type { StoreRef } from "../../core/store/store-manager.js";
import type { NodeStatus, NodeType } from "../../core/graph/graph-types.js";
import { graphToMermaid } from "../../core/graph/mermaid-export.js";

const MAX_LIMIT = 1000;

const GraphQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

/** createGraphRouter — auto-generated description placeholder. */
export function createGraphRouter(storeRef: StoreRef): Router {
  const router = Router();

  router.get("/", (req, res, next) => {
    try {
      const store = storeRef.current;

      const queryResult = GraphQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({ error: queryResult.error.issues.map((i) => i.message).join("; "), details: queryResult.error.issues });
        return;
      }
      const limit = queryResult.data.limit ?? 100;
      const offset = queryResult.data.offset ?? 0;
      const status = req.query.status
        ? (req.query.status as string).split(",") as NodeStatus[]
        : undefined;
      const type = req.query.type
        ? (req.query.type as string).split(",") as NodeType[]
        : undefined;
      const search = req.query.search as string | undefined;

      const { nodes, totalCount } = store.queryNodes({
        limit,
        offset,
        status,
        type,
        search,
      });

      const nodeIds = new Set(nodes.map((n) => n.id));
      const allEdges = store.getAllEdges();
      const edges = allEdges.filter(
        (e) => nodeIds.has(e.from) || nodeIds.has(e.to),
      );

      const hasMore = offset + nodes.length < totalCount;
      const project = store.getProject();

      res.json({
        version: "1.0.0",
        project,
        nodes,
        edges,
        indexes: {},
        meta: { sourceFiles: [], lastImport: null },
        pagination: {
          totalCount,
          limit,
          offset,
          hasMore,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  router.get("/summary", (_req, res, next) => {
    try {
      const store = storeRef.current;
      const allNodes = store.getAllNodes();

      // Build child count map
      const childCountMap = new Map<string, number>();
      for (const node of allNodes) {
        if (node.parentId) {
          childCountMap.set(node.parentId, (childCountMap.get(node.parentId) ?? 0) + 1);
        }
      }

      // Project to lightweight summary
      const nodes = allNodes.map((n) => ({
        id: n.id,
        title: n.title,
        type: n.type,
        status: n.status,
        priority: n.priority,
        parentId: n.parentId ?? null,
        childCount: childCountMap.get(n.id) ?? 0,
      }));

      res.json({
        nodes,
        totalCount: nodes.length,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get("/nodes/:id", (req, res, next) => {
    try {
      const store = storeRef.current;
      const node = store.getNodeById(req.params.id);
      if (!node) {
        res.status(404).json({ error: "Node not found" });
        return;
      }

      const allEdges = store.getAllEdges();
      const edges = allEdges.filter(
        (e) => e.from === node.id || e.to === node.id,
      );

      const relatedIds = new Set(edges.flatMap((e) => [e.from, e.to]));
      relatedIds.delete(node.id);
      const relatedNodes = Array.from(relatedIds)
        .map((id) => store.getNodeById(id))
        .filter((n): n is NonNullable<typeof n> => n !== null)
        .map((n) => ({ id: n.id, title: n.title, type: n.type, status: n.status }));

      const children = store.getChildNodes(node.id);

      res.json({
        node,
        edges,
        relatedNodes,
        children: children.map((c) => ({ id: c.id, title: c.title, type: c.type, status: c.status })),
      });
    } catch (err) {
      next(err);
    }
  });

  router.get("/mermaid", (req, res, next) => {
    try {
      const doc = storeRef.current.toGraphDocument();

      const format = (req.query.format as string) ?? "flowchart";
      const direction = (req.query.direction as string) ?? "TD";
      const filterStatus = req.query.status
        ? (req.query.status as string).split(",") as NodeStatus[]
        : undefined;
      const filterType = req.query.type
        ? (req.query.type as string).split(",") as NodeType[]
        : undefined;

      const mermaid = graphToMermaid(doc.nodes, doc.edges, {
        format: format as "flowchart" | "mindmap",
        direction: direction as "TD" | "LR",
        filterStatus,
        filterType,
      });

      res.type("text/plain").send(mermaid);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
