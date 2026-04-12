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
import { generateId } from "../../core/utils/id.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";
import type { GraphNode } from "../../core/graph/graph-types.js";

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

export function handleConstitutionCreate(
  store: SqliteStore,
  params: CreateParams,
): { ok: boolean; nodeId: string; principlesIndexed: number; constitutionVersion: string } {
  const now = new Date().toISOString();
  const nodeId = generateId();
  const version = "1.0.0";
  const project = store.getActiveProject();
  if (!project) throw new Error("No active project");

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

  logger.info("Constitution created", { nodeId, principles: params.principles.length });

  return {
    ok: true,
    nodeId,
    principlesIndexed: indexResult.documentsIndexed,
    constitutionVersion: version,
  };
}

export function handleConstitutionUpdate(
  store: SqliteStore,
  params: UpdateParams,
): { ok: boolean; constitutionVersion: string; principlesIndexed: number } {
  const node = store.getNodeById(params.nodeId);
  if (!node) throw new Error(`Node not found: ${params.nodeId}`);
  if (node.type !== "constitution") throw new Error(`Node is not a constitution: ${params.nodeId}`);

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

  logger.info("Constitution updated", { nodeId: params.nodeId, version: newVersion });

  return {
    ok: true,
    constitutionVersion: newVersion,
    principlesIndexed: indexResult.documentsIndexed,
  };
}

export function handleConstitutionList(
  store: SqliteStore,
): { ok: boolean; totalPrinciples: number; byCategory: Record<string, PrincipleInput[]> } {
  const project = store.getActiveProject();
  if (!project) return { ok: true, totalPrinciples: 0, byCategory: {} };

  const rows = store.getDb().prepare(
    "SELECT * FROM nodes WHERE project_id = ? AND type = 'constitution' ORDER BY created_at DESC LIMIT 1",
  ).get(project.id) as { metadata: string } | undefined;

  if (!rows) return { ok: true, totalPrinciples: 0, byCategory: {} };

  const metadata = JSON.parse(rows.metadata) as { principles?: PrincipleInput[] };
  const principles = metadata.principles ?? [];

  const byCategory: Record<string, PrincipleInput[]> = {};
  for (const p of principles) {
    if (!byCategory[p.category]) byCategory[p.category] = [];
    byCategory[p.category].push(p);
  }

  return {
    ok: true,
    totalPrinciples: principles.length,
    byCategory,
  };
}

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

  const constitutionMeta = JSON.parse(constitutionRow.metadata) as { principles?: PrincipleInput[] };

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

export function registerConstitution(server: McpServer, store: SqliteStore): void {
  server.tool(
    "constitution",
    "Manage project governing principles. Actions: create, update, list, check.",
    {
      action: z.enum(["create", "update", "list", "check"]).describe("Action to perform"),
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

          default:
            return mcpError(`Unknown action: ${params.action}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error("Constitution tool error", { action: params.action, error: msg });
        return mcpError(msg);
      }
    },
  );
}
