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
 * graph_materialize — V11 Maestro Phase 4.2.
 *
 * Devolve um plan-payload (executor=native-write) com step `Write`. O agente
 * cliente executa o Write nativo e fecha o loop chamando finish_task. Esta
 * tool NUNCA importa fs nem chama Write — só descreve a intenção.
 *
 * Reusa graphToMermaid (export.ts) para gerar o conteúdo. Para `adr` e
 * `snapshot`, gera markdown / JSON inline.
 */

import { z } from "zod/v4";
import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { graphToMermaid } from "../../core/graph/mermaid-export.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";
import {
  PlanPayloadSchema,
  type PlanPayload,
} from "../contracts/plan-payload.js";

const ARTIFACT_KINDS = ["mermaid", "adr", "snapshot"] as const;
export type Artifact = typeof ARTIFACT_KINDS[number];

export interface MaterializeInput {
  nodeId: string;
  artifact: Artifact;
  filePath: string;
}

export type MaterializeResult =
  | { ok: true; plan: PlanPayload }
  | { ok: false; error: string };

function buildAdrContent(nodeId: string, title: string): string {
  return [
    `# ADR — ${title}`,
    "",
    `- **Status:** Proposed`,
    `- **Node:** ${nodeId}`,
    "",
    "## Context",
    "",
    "(describe the forces that motivate this decision)",
    "",
    "## Decision",
    "",
    "(state the decision in one sentence)",
    "",
    "## Consequences",
    "",
    "- (positive)",
    "- (negative)",
    "- (rollback path)",
    "",
  ].join("\n");
}

function buildSnapshotContent(store: SqliteStore): string {
  const doc = store.toGraphDocument();
  return JSON.stringify(
    {
      project: store.getProject()?.name ?? null,
      nodes: doc.nodes,
      edges: doc.edges,
    },
    null,
    2,
  );
}

/**
 * Pure helper — builds the plan-payload from current store state.
 * No file I/O. Verified by an integrity test that the source has zero fs imports.
 */
export function buildMaterializePlan(store: SqliteStore, input: MaterializeInput): MaterializeResult {
  const node = store.toGraphDocument().nodes.find((n) => n.id === input.nodeId);
  if (!node) {
    return { ok: false, error: `Node not found: ${input.nodeId}` };
  }

  let content: string;
  if (input.artifact === "mermaid") {
    const doc = store.toGraphDocument();
    content = graphToMermaid(doc.nodes, doc.edges, { format: "flowchart", direction: "TD" });
  } else if (input.artifact === "adr") {
    content = buildAdrContent(input.nodeId, node.title);
  } else {
    content = buildSnapshotContent(store);
  }

  const plan: PlanPayload = {
    executor: "native-write",
    steps: [
      {
        tool: "Write",
        args: { file_path: input.filePath, content },
      },
    ],
    postCallback: {
      tool: "finish_task",
      args: { nodeId: input.nodeId },
    },
    auditId: randomUUID(),
    nodeId: input.nodeId,
  };

  // Defense-in-depth: every payload is validated before leaving the tool.
  const parsed = PlanPayloadSchema.safeParse(plan);
  if (!parsed.success) {
    return { ok: false, error: `Internal: built invalid PlanPayload: ${parsed.error.message}` };
  }
  return { ok: true, plan: parsed.data };
}

/** registerGraphMaterialize — auto-generated description placeholder. */
export function registerGraphMaterialize(server: McpServer, store: SqliteStore): void {
  server.tool(
    "graph_materialize",
    "Generate a plan-payload (executor=native-write) that materializes a graph artifact (mermaid, adr, snapshot) into a file via the agent's native Write. Maestro principle: graph rastreia, agente cliente executa.",
    {
      nodeId: z.string().min(1).describe("Node ID this artifact belongs to"),
      artifact: z.enum(ARTIFACT_KINDS).describe("Artifact kind: mermaid (flowchart), adr (markdown template), snapshot (JSON)"),
      filePath: z.string().min(1).describe("Absolute or repo-relative path where the agent should Write the artifact"),
    },
    async (args) => {
      const rVar = buildMaterializePlan(store, args);
      logger.debug("tool:graph_materialize", {
        ok: rVar.ok,
        artifact: args.artifact,
        nodeId: args.nodeId,
      });
      return mcpText(rVar);
    },
  );
}
