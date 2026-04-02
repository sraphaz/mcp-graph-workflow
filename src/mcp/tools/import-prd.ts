import path from "node:path";
import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { readPrdFile } from "../../core/parser/read-file.js";
import { extractEntities } from "../../core/parser/extract.js";
import { convertToGraph } from "../../core/importer/prd-to-graph.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { indexPrdContent } from "../../core/rag/prd-indexer.js";
import { indexEntitiesForSource } from "../../core/rag/entity-index-hook.js";
import { diffPrd } from "../../core/parser/prd-diff.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

export function registerImportPrd(server: McpServer, store: SqliteStore): void {
  server.tool(
    "import_prd",
    "Import a PRD file and convert it into graph nodes and edges. Use force=true to re-import a previously imported file (replaces old nodes).",
    {
      filePath: z.string().min(1).describe("Path to the PRD text file"),
      force: z
        .boolean()
        .optional()
        .default(false)
        .describe("Force re-import: delete nodes from previous import of this file before importing"),
      dryRun: z
        .boolean()
        .optional()
        .default(false)
        .describe("Preview import without persisting — returns nodes that would be created"),
      diff: z
        .boolean()
        .optional()
        .default(false)
        .describe("Compare with previous import and show changes (sections added/removed/modified)"),
    },
    async ({ filePath, force, dryRun, diff }) => {
      logger.info("tool:import_prd", { filePath, force, diff });
      // 1. Read and parse
      const { content, absolutePath, sizeBytes } = await readPrdFile(filePath);
      const sourceFileName = path.basename(absolutePath);

      // 1.5 Diff-only mode: compare with previous import without modifying anything
      if (diff) {
        const rawSourceId = `prd_raw:${sourceFileName}`;
        try {
          const knowledgeStore = new KnowledgeStore(store.getDb());
          const previousDocs = knowledgeStore.getBySourceId(rawSourceId);
          if (previousDocs.length === 0) {
            return mcpText({
              ok: true,
              diff: true,
              message: `No previous import found for "${sourceFileName}". Import the file first, then use diff=true to compare future changes.`,
            });
          }
          const oldContent = previousDocs.map((d) => d.content).join("");
          const diffResult = diffPrd(oldContent, content);

          // Find impacted graph nodes by matching modified/added/removed section titles
          const changedSections = diffResult.sections.filter((s) => s.status !== "unchanged");
          const allNodes = store.getAllNodes();
          const impactedNodes = changedSections.flatMap((section) => {
            const lowerTitle = section.title.toLowerCase();
            return allNodes.filter((n) => n.title.toLowerCase().includes(lowerTitle) || lowerTitle.includes(n.title.toLowerCase()));
          });
          const uniqueImpacted = [...new Map(impactedNodes.map((n) => [n.id, n])).values()];

          return mcpText({
            ok: true,
            diff: true,
            sourceFile: sourceFileName,
            summary: {
              added: diffResult.addedCount,
              removed: diffResult.removedCount,
              modified: diffResult.modifiedCount,
              unchanged: diffResult.unchangedCount,
            },
            sections: diffResult.sections.filter((s) => s.status !== "unchanged"),
            impactedNodes: uniqueImpacted.map((n) => ({
              id: n.id,
              title: n.title,
              type: n.type,
              status: n.status,
            })),
          });
        } catch (err) {
          logger.warn("tool:import_prd:diff_failed", { error: String(err) });
          return mcpError(`Diff failed: ${String(err)}`);
        }
      }

      // 2. Check for previous import
      const alreadyImported = store.hasImport(sourceFileName);
      if (alreadyImported && !force) {
        return mcpError(`File "${sourceFileName}" was already imported. Use force=true to re-import (this will replace all nodes from the previous import).`);
      }

      // 3. If force re-import, clear previous nodes
      let cleared: { nodesDeleted: number; edgesDeleted: number } | null = null;
      if (alreadyImported && force) {
        cleared = store.clearImportedNodes(sourceFileName);
      }

      // 4. Extract entities
      logger.debug("tool:import_prd:extract", { sourceFileName, sizeBytes });
      const extraction = extractEntities(content);

      // 5. Convert to graph
      const { nodes, edges, stats } = convertToGraph(extraction, sourceFileName);
      logger.debug("tool:import_prd:converted", { nodes: nodes.length, edges: edges.length });

      // 5.5 Dry-run: return preview without persisting
      if (dryRun) {
        const preview = nodes.slice(0, 30).map((n) => ({
          type: n.type,
          title: n.title,
          status: n.status,
          priority: n.priority,
          parentId: n.parentId ?? null,
        }));
        logger.info("tool:import_prd:dry_run", { nodesPreview: preview.length, totalNodes: nodes.length });
        return mcpText({
          ok: true,
          dryRun: true,
          sourceFile: sourceFileName,
          originalSizeChars: sizeBytes,
          ...stats,
          preview,
        });
      }

      // 6. Bulk insert into SQLite (atomic)
      store.bulkInsert(nodes, edges);

      // 7. Record import
      store.recordImport(sourceFileName, stats.nodesCreated, stats.edgesCreated);

      // 8. Index PRD text into knowledge store for cross-phase RAG
      let knowledgeDocsIndexed = 0;
      try {
        const knowledgeStore = new KnowledgeStore(store.getDb());
        const indexResult = indexPrdContent(knowledgeStore, content, sourceFileName, "ANALYZE");
        knowledgeDocsIndexed = indexResult.documentsIndexed;
        indexEntitiesForSource(store.getDb(), "prd");

        // 8.1 Store raw PRD text for future diff comparisons
        const rawSourceId = `prd_raw:${sourceFileName}`;
        knowledgeStore.deleteBySource("prd", rawSourceId);
        knowledgeStore.insert({
          sourceType: "prd",
          sourceId: rawSourceId,
          title: `PRD Raw: ${sourceFileName}`,
          content,
          metadata: { sourceFile: sourceFileName, purpose: "diff_tracking", storedAt: new Date().toISOString() },
        });
      } catch (err) {
        logger.warn("tool:import_prd:knowledge_index_failed", { error: String(err) });
      }

      // 9. Snapshot after import
      store.createSnapshot();

      logger.info("tool:import_prd:ok", {
        sourceFile: sourceFileName,
        nodesCreated: stats.nodesCreated,
        edgesCreated: stats.edgesCreated,
        knowledgeDocsIndexed,
      });

      return mcpText({
        ok: true,
        sourceFile: sourceFileName,
        originalSizeChars: sizeBytes,
        ...stats,
        knowledgeDocsIndexed,
        ...(cleared
          ? {
              reimported: true,
              previousNodesDeleted: cleared.nodesDeleted,
              previousEdgesDeleted: cleared.edgesDeleted,
            }
          : {}),
      });
    },
  );
}
