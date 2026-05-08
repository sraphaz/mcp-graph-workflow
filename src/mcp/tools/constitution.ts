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
 * MCP Tool — constitution
 * Manage project governing principles as first-class graph artifacts.
 * Actions: create, update, list, check.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { indexConstitution } from "../../core/rag/constitution-indexer.js";
import { ConstitutionChecker } from "../../core/constitution/constitution-checker.js";
import { getBuiltinConstitution, listBuiltinConstitutions } from "../../core/constitution/built-in-constitutions.js";
import { generateId } from "../../core/utils/id.js";
import { createLogger } from "../../core/utils/logger.js";
import { McpGraphError } from "../../core/utils/errors.js";
import { mcpText, mcpError } from "../response-helpers.js";
import type { GraphNode } from "../../core/graph/graph-types.js";

const log = createLogger({ layer: "mcp", source: "constitution.ts" });

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PrincipleInput {
  id: string;
  title: string;
  description: string;
  category: string;
  weight: number;
  enforceable: boolean;
}

interface CreateParams {
  principles: PrincipleInput[];
  scope?: string;
  rationale?: string;
}

interface UpdateParams {
  nodeId: string;
  principles: PrincipleInput[];
  rationale?: string;
}

interface CheckParams {
  nodeId?: string;
}

interface CheckNodeResult {
  nodeId: string;
  title: string;
  principlesChecked: number;
  passed: number;
  failed: number;
  violations: Array<{ principleId: string; principleTitle: string; reason: string }>;
}

/* ------------------------------------------------------------------ */
/*  Handlers (exported for testing)                                    */
/* ------------------------------------------------------------------ */

/** Create a project constitution node with governing principles and index into knowledge store. */
export function handleConstitutionCreate(
  store: SqliteStore,
  params: CreateParams,
): { ok: boolean; nodeId: string; principlesIndexed: number; constitutionVersion: string } {
  const now = new Date().toISOString();
  const nodeId = generateId();
  const version = "1.0.0";
  const project = store.getActiveProject();
  if (!project) throw new McpGraphError("No active project");

  const node: GraphNode = {
    id: nodeId,
    type: "constitution",
    title: "Project Constitution",
    description: params.rationale ?? "Project governing principles",
    status: "backlog",
    priority: 1,
    metadata: {
      constitutionVersion: version,
      scope: params.scope ?? "global",
      principles: params.principles,
    },
    createdAt: now,
    updatedAt: now,
  };

  store.insertNode(node);

  const ks = new KnowledgeStore(store.getDb());
  const indexResult = indexConstitution(ks, {
    nodeId,
    constitutionVersion: version,
    principles: params.principles,
  });

  log.info("Constitution created", { nodeId, principles: params.principles.length });

  return {
    ok: true,
    nodeId,
    principlesIndexed: indexResult.documentsIndexed,
    constitutionVersion: version,
  };
}

/**
 * Install a built-in constitution bundle (e.g. karpathy-baseline).
 * Idempotent: if a constitution with the same builtinName already exists,
 * returns the existing nodeId without re-creating.
 */
export function handleConstitutionInstallBuiltin(
  store: SqliteStore,
  params: { name: string },
): { ok: boolean; nodeId: string; builtinName: string; principlesIndexed: number; alreadyInstalled: boolean; constitutionVersion: string } {
  const bundle = getBuiltinConstitution(params.name);
  if (!bundle) {
    const available = listBuiltinConstitutions().map((b) => b.name).join(", ");
    throw new McpGraphError(`Unknown built-in constitution: "${params.name}". Available: ${available}`);
  }

  const project = store.getActiveProject();
  if (!project) throw new McpGraphError("No active project");

  const existing = store.getDb().prepare(
    "SELECT id, metadata FROM nodes WHERE project_id = ? AND type = 'constitution'",
  ).all(project.id) as Array<{ id: string; metadata: string }>;

  for (const row of existing) {
    let meta: { builtinName?: string; constitutionVersion?: string } = {};
    try { meta = JSON.parse(row.metadata) as { builtinName?: string; constitutionVersion?: string }; } catch { /* skip */ }
    if (meta.builtinName === bundle.name) {
      return {
        ok: true,
        nodeId: row.id,
        builtinName: bundle.name,
        principlesIndexed: bundle.principles.length,
        alreadyInstalled: true,
        constitutionVersion: meta.constitutionVersion ?? "1.0.0",
      };
    }
  }

  const created = handleConstitutionCreate(store, {
    principles: bundle.principles,
    scope: "global",
    rationale: `Built-in: ${bundle.description}` + (bundle.upstream ? ` (upstream: ${bundle.upstream})` : ""),
  });

  // Tag the created node with the builtinName for idempotency on future installs.
  const now = new Date().toISOString();
  const node = store.getNodeById(created.nodeId);
  const existingMeta = (node?.metadata ?? {}) as Record<string, unknown>;
  store.getDb().prepare(
    "UPDATE nodes SET metadata = ?, updated_at = ? WHERE id = ?",
  ).run(
    JSON.stringify({ ...existingMeta, builtinName: bundle.name }),
    now,
    created.nodeId,
  );

  log.info("Built-in constitution installed", { name: bundle.name, nodeId: created.nodeId });

  return {
    ok: true,
    nodeId: created.nodeId,
    builtinName: bundle.name,
    principlesIndexed: created.principlesIndexed,
    alreadyInstalled: false,
    constitutionVersion: created.constitutionVersion,
  };
}

/** Update an existing constitution's principles and bump its version. */
export function handleConstitutionUpdate(
  store: SqliteStore,
  params: UpdateParams,
): { ok: boolean; constitutionVersion: string; principlesIndexed: number } {
  const node = store.getNodeById(params.nodeId);
  if (!node) throw new McpGraphError(`Node not found: ${params.nodeId}`);
  if (node.type !== "constitution") throw new McpGraphError(`Node is not a constitution: ${params.nodeId}`);

  const currentVersion = (node.metadata?.constitutionVersion as string) ?? "1.0.0";
  const parts = currentVersion.split(".").map(Number);
  const newVersion = `${parts[0]}.${parts[1] + 1}.0`;

  const now = new Date().toISOString();
  store.getDb().prepare(
    "UPDATE nodes SET metadata = ?, updated_at = ? WHERE id = ?",
  ).run(
    JSON.stringify({
      ...node.metadata,
      constitutionVersion: newVersion,
      principles: params.principles,
    }),
    now,
    params.nodeId,
  );

  const ks = new KnowledgeStore(store.getDb());
  const indexResult = indexConstitution(ks, {
    nodeId: params.nodeId,
    constitutionVersion: newVersion,
    principles: params.principles,
  });

  log.info("Constitution updated", { nodeId: params.nodeId, version: newVersion });

  return {
    ok: true,
    constitutionVersion: newVersion,
    principlesIndexed: indexResult.documentsIndexed,
  };
}

/** List all constitution principles grouped by category. */
export function handleConstitutionList(
  store: SqliteStore,
): { ok: boolean; totalPrinciples: number; byCategory: Record<string, PrincipleInput[]> } {
  const project = store.getActiveProject();
  if (!project) return { ok: true, totalPrinciples: 0, byCategory: {} };

  const rows = store.getDb().prepare(
    "SELECT * FROM nodes WHERE project_id = ? AND type = 'constitution' ORDER BY created_at DESC LIMIT 1",
  ).get(project.id) as { metadata: string } | undefined;

  if (!rows) return { ok: true, totalPrinciples: 0, byCategory: {} };

  let metadata: { principles?: PrincipleInput[] } = {};
  try { metadata = JSON.parse(rows.metadata) as { principles?: PrincipleInput[] }; } catch { /* corrupted constitution metadata */ }
  const principles = metadata.principles ?? [];

  const byCategory: Record<string, PrincipleInput[]> = {};
  for (const pVar of principles) {
    if (!byCategory[pVar.category]) byCategory[pVar.category] = [];
    byCategory[pVar.category].push(pVar);
  }

  return {
    ok: true,
    totalPrinciples: principles.length,
    byCategory,
  };
}

/** Check graph nodes against constitution principles and report violations. */
export function handleConstitutionCheck(
  store: SqliteStore,
  params: CheckParams,
): { ok: boolean; nodesChecked: number; results: CheckNodeResult[] } {
  const project = store.getActiveProject();
  if (!project) return { ok: true, nodesChecked: 0, results: [] };

  // Get constitution principles
  const constitutionRow = store.getDb().prepare(
    "SELECT metadata FROM nodes WHERE project_id = ? AND type = 'constitution' ORDER BY created_at DESC LIMIT 1",
  ).get(project.id) as { metadata: string } | undefined;

  if (!constitutionRow) return { ok: true, nodesChecked: 0, results: [] };

  let constitutionMeta: { principles?: PrincipleInput[] } = {};
  try { constitutionMeta = JSON.parse(constitutionRow.metadata) as { principles?: PrincipleInput[] }; } catch { /* corrupted */ }

  // Get nodes to check
  let nodes: Array<{ id: string; title: string; description: string | null }>;
  if (params.nodeId) {
    const row = store.getDb().prepare(
      "SELECT id, title, description FROM nodes WHERE id = ? AND project_id = ?",
    ).get(params.nodeId, project.id) as { id: string; title: string; description: string | null } | undefined;
    nodes = row ? [row] : [];
  } else {
    nodes = store.getDb().prepare(
      "SELECT id, title, description FROM nodes WHERE project_id = ? AND status IN ('in_progress', 'done') AND type NOT IN ('constitution', 'acceptance_criteria')",
    ).all(project.id) as Array<{ id: string; title: string; description: string | null }>;
  }

  const checker = new ConstitutionChecker(constitutionMeta.principles ?? []);
  const results: CheckNodeResult[] = nodes.map((node) => {
    const checkResult = checker.checkNode({ id: node.id, title: node.title, description: node.description });
    return {
      nodeId: node.id,
      title: node.title,
      principlesChecked: checkResult.principlesChecked,
      passed: checkResult.passed,
      failed: checkResult.failed,
      violations: checkResult.violations,
    };
  });

  return { ok: true, nodesChecked: nodes.length, results };
}

/* ------------------------------------------------------------------ */
/*  MCP Registration                                                   */
/* ------------------------------------------------------------------ */

/** Register the constitution MCP tool with create, update, list, and check actions. */
export function registerConstitution(server: McpServer, store: SqliteStore): void {
  server.tool(
    "constitution",
    "Manage project governing principles. Actions: create, update, list, check, install_builtin.",
    {
      action: z.enum(["create", "update", "list", "check", "install_builtin"]).describe("Action to perform"),
      name: z.string().optional().describe("Built-in bundle name (install_builtin)"),
      principles: z.array(z.object({
        id: z.string(),
        title: z.string(),
        description: z.string(),
        category: z.string(),
        weight: z.number().min(0).max(1),
        enforceable: z.boolean(),
      })).optional().describe("Principles array (create/update)"),
      scope: z.enum(["global", "module"]).optional().describe("Scope (create)"),
      rationale: z.string().optional().describe("Rationale (create/update)"),
      nodeId: z.string().optional().describe("Constitution node ID (update) or target node ID (check)"),
    },
    async (params) => {
      try {
        switch (params.action) {
          case "create":
            if (!params.principles?.length) return mcpError("principles array required for create");
            return mcpText(handleConstitutionCreate(store, {
              principles: params.principles,
              scope: params.scope,
              rationale: params.rationale,
            }));

          case "update":
            if (!params.nodeId) return mcpError("nodeId required for update");
            if (!params.principles?.length) return mcpError("principles array required for update");
            return mcpText(handleConstitutionUpdate(store, {
              nodeId: params.nodeId,
              principles: params.principles,
            }));

          case "list":
            return mcpText(handleConstitutionList(store));

          case "check":
            return mcpText(handleConstitutionCheck(store, { nodeId: params.nodeId }));

          case "install_builtin":
            if (!params.name) return mcpError("name required for install_builtin");
            return mcpText(handleConstitutionInstallBuiltin(store, { name: params.name }));

          default:
            return mcpError(`Unknown action: ${params.action}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error("Constitution tool error", { action: params.action, error: msg });
        return mcpError(msg);
      }
    },
  );
}
