import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { learnFromProject } from "../../core/knowledge/cross-project-learner.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

export function registerLearnFromProject(server: McpServer, store: SqliteStore): void {
  server.tool(
    "learn_from_project",
    "Import knowledge from another project's database. Transfers error patterns, estimates, ADRs, templates, and learnings. Deduplicates by content hash.",
    {
      sourcePath: z.string().min(1).describe("Path to source project's graph.db file"),
      categories: z.array(z.enum(["errors", "estimates", "adrs", "templates", "patterns"])).optional()
        .describe("Knowledge categories to import (default: all)"),
      minQuality: z.number().min(0).max(1).optional().describe("Minimum quality score (default: 0.4)"),
      maxDocs: z.number().min(1).max(1000).optional().describe("Maximum documents to import (default: 100)"),
    },
    async ({ sourcePath, categories, minQuality, maxDocs }) => {
      logger.debug("tool:learn_from_project", { sourcePath, categories, minQuality, maxDocs });

      const project = store.getProject();
      if (!project) return mcpError("No active project");

      const result = await learnFromProject(
        store.getDb(),
        project.fsPath ?? ".",
        sourcePath,
        { categories, minQuality, maxDocs },
      );

      logger.info("tool:learn_from_project:ok", {
        imported: result.imported,
        skipped: result.skipped,
      });

      return mcpText({
        ok: true,
        imported: result.imported,
        skipped: result.skipped,
        categories: result.categories,
        sourceProject: result.sourceProject,
        hint: result.imported > 0
          ? `${result.imported} documents imported. Use context(action:rag) to access the new knowledge.`
          : "No new documents to import (all duplicates or below quality threshold).",
      });
    },
  );
}
