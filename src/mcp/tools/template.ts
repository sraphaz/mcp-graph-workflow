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
import type { GraphNode } from "../../core/graph/graph-types.js";
import {
  instantiateTemplate,
  listTemplates,
  type TaskTemplate,
} from "../../core/templates/template-engine.js";
import { generateId } from "../../core/utils/id.js";
import { now } from "../../core/utils/time.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

const NodeDefinitionSchema = z.object({
  type: z.enum(["task", "subtask"]),
  titleTemplate: z.string(),
  description: z.string().optional(),
  xpSize: z.enum(["XS", "S", "M", "L", "XL"]).optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

const EdgeDefinitionSchema = z.object({
  fromIndex: z.number(),
  toIndex: z.number(),
  relationType: z.string(),
});

const DefinitionSchema = z.object({
  nodeDefinitions: z.array(NodeDefinitionSchema),
  edgeDefinitions: z.array(EdgeDefinitionSchema).optional(),
});

export function registerTemplate(server: McpServer, store: SqliteStore): void {
  server.tool(
    "template",
    "Manage task templates: create reusable task structures, list available templates, apply templates to generate nodes with variable substitution.",
    {
      action: z
        .enum(["create", "list", "apply"])
        .describe("Action: create a template, list templates, apply a template"),
      name: z
        .string()
        .optional()
        .describe("Template name (required for 'create')"),
      description: z
        .string()
        .optional()
        .describe("Template description (optional for 'create')"),
      definition: DefinitionSchema
        .optional()
        .describe("Template definition with node and edge definitions (required for 'create')"),
      templateId: z
        .string()
        .optional()
        .describe("Template node ID to apply (required for 'apply')"),
      variables: z
        .record(z.string(), z.string())
        .optional()
        .describe("Variable substitutions for {{var}} placeholders (used with 'apply')"),
      parentId: z
        .string()
        .optional()
        .describe("Parent node ID for created nodes (optional for 'apply')"),
    },
    async ({ action, name, description, definition, templateId, variables, parentId }) => {
      logger.debug("tool:template", { action, name, templateId });

      switch (action) {
        case "create": {
          if (!name) return mcpError("Missing required parameter: name");
          if (!definition) return mcpError("Missing required parameter: definition");

          const timestamp = now();
          const nodeId = generateId("node");

          const milestoneNode: GraphNode = {
            id: nodeId,
            type: "milestone",
            title: name,
            description,
            status: "backlog",
            priority: 3,
            metadata: {
              templateDefinition: {
                name,
                description,
                nodeDefinitions: definition.nodeDefinitions,
                edgeDefinitions: definition.edgeDefinitions,
              },
            },
            createdAt: timestamp,
            updatedAt: timestamp,
          };

          try {
            store.insertNode(milestoneNode);
            logger.info("tool:template:created", { nodeId, name });
            return mcpText({
              ok: true,
              templateId: nodeId,
              name,
              nodeDefinitions: definition.nodeDefinitions.length,
              edgeDefinitions: definition.edgeDefinitions?.length ?? 0,
            });
          } catch (err) {
            return mcpError(err instanceof Error ? err : new Error(String(err)));
          }
        }

        case "list": {
          const templates = listTemplates(store);
          logger.info("tool:template:list", { count: templates.length });
          return mcpText({ templates, count: templates.length });
        }

        case "apply": {
          if (!templateId) return mcpError("Missing required parameter: templateId");

          const templateNode = store.getNodeById(templateId);
          if (!templateNode) return mcpError(`Template node not found: ${templateId}`);

          const metadata = templateNode.metadata as Record<string, unknown> | undefined;
          const templateDef = metadata?.templateDefinition as TaskTemplate | undefined;
          if (!templateDef) {
            return mcpError(`Node ${templateId} is not a template (missing metadata.templateDefinition)`);
          }

          if (parentId) {
            const parentNode = store.getNodeById(parentId);
            if (!parentNode) return mcpError(`Parent node not found: ${parentId}`);
          }

          const result = store.getDb().transaction(() => {
            return instantiateTemplate(store, templateDef, variables ?? {}, parentId);
          })();

          logger.info("tool:template:applied", {
            templateId,
            nodes: result.nodesCreated.length,
            edges: result.edgesCreated.length,
            errors: result.errors.length,
          });

          return mcpText({
            ok: true,
            templateId,
            templateName: templateDef.name,
            ...result,
          });
        }

        default:
          return mcpError(`Unknown action: ${String(action)}`);
      }
    },
  );
}
