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
 * MCP Tool — siebel
 * Consolidated Siebel CRM tool with action-based routing.
 * Replaces 8 separate siebel_* tools: analyze, compose, env, generate,
 * import_docs, import_sif, search, validate + new batch_import_sif.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { SiebelObjectTypeSchema, SiebelEnvironmentTypeSchema } from "../../schemas/siebel.schema.js";
import { logger } from "../../core/utils/logger.js";
import { mcpError } from "../response-helpers.js";
import {
  handleSiebelAnalyze,
  handleSiebelCompose,
  handleSiebelEnv,
  handleSiebelGenerate,
  handleSiebelImportDocs,
  handleSiebelImportSif,
  handleSiebelSearch,
  handleSiebelValidate,
  handleSiebelBatchImportSif,
} from "./siebel-handlers.js";

/** registerSiebel — auto-generated description placeholder. */
export function registerSiebel(server: McpServer, store: SqliteStore): void {
  server.tool(
    "siebel",
    "Siebel CRM integration: analyze, compose, env, generate, import_docs, import_sif, search, validate, batch_import_sif",
    {
      action: z.enum([
        "analyze", "compose", "env", "generate",
        "import_docs", "import_sif", "search", "validate",
        "batch_import_sif",
      ]).describe("Siebel action to perform"),

      // --- analyze params ---
      analyzeMode: z.enum(["impact", "dependencies", "circular", "summary", "diff", "refactor_script", "troubleshoot", "generate_integration_tests"]).optional().describe("Analysis sub-mode (action=analyze)"),
      objectName: z.string().optional().describe("Siebel object name"),
      objectType: SiebelObjectTypeSchema.optional().describe("Siebel object type"),
      targetName: z.string().optional().describe("Target object for dependency chain"),
      targetType: SiebelObjectTypeSchema.optional().describe("Target object type"),
      sifContent: z.string().optional().describe("Raw SIF XML content"),
      targetSifContent: z.string().optional().describe("Target SIF content (for diff)"),
      outputFormat: z.enum(["json", "markdown"]).optional().default("json").describe("Output format for diff"),
      scriptContent: z.string().optional().describe("eScript source code (for refactor_script)"),
      errorMessage: z.string().optional().describe("Error message (for troubleshoot)"),
      wsdlContent: z.string().optional().describe("WSDL XML content"),

      // --- compose params ---
      composerAction: z.enum(["navigate", "import_sif", "edit", "publish", "capture", "build_package"]).optional().describe("Composer sub-action (action=compose)"),
      envName: z.string().optional().describe("Siebel environment name"),
      sifPath: z.string().optional().describe("SIF file path"),
      property: z.string().optional().describe("Property name to edit"),
      value: z.string().optional().describe("New value for property"),
      selector: z.string().optional().describe("CSS selector for waiting/capturing"),
      timeout: z.number().int().min(1000).optional().describe("Timeout in milliseconds"),
      currentUser: z.string().optional().describe("Current user name (build_package)"),

      // --- env params ---
      envAction: z.enum(["list", "add", "remove"]).optional().describe("Environment sub-action (action=env)"),
      name: z.string().optional().describe("Environment name"),
      url: z.string().optional().describe("Siebel application URL"),
      version: z.string().optional().default("15.0").describe("Siebel version"),
      envType: SiebelEnvironmentTypeSchema.optional().default("dev").describe("Environment type"),
      composerUrl: z.string().optional().describe("Siebel Composer URL"),
      restApiUrl: z.string().optional().describe("Siebel REST API base URL"),

      // --- generate params ---
      generateAction: z.enum(["prepare", "finalize", "templates", "scaffold", "clone_adapt", "generate_script", "auto_wire", "wsdl_to_sif"]).optional().describe("Generate sub-action (action=generate)"),
      description: z.string().optional().describe("What to generate"),
      objectTypes: z.array(SiebelObjectTypeSchema).optional().describe("Siebel object types to generate"),
      basedOnProject: z.string().optional().describe("Base project name for context"),
      properties: z.record(z.string(), z.string()).optional().describe("Default properties for generated objects"),
      generatedXml: z.string().optional().describe("LLM-generated SIF XML content (for finalize)"),
      prefix: z.string().optional().describe("Naming prefix (e.g., 'CX_')"),
      includeScriptBoilerplate: z.boolean().optional().default(false).describe("Include eScript boilerplate (scaffold)"),
      sourceSifContent: z.string().optional().describe("SIF XML of source object to clone"),
      sourceObjectName: z.string().optional().describe("Name of object to clone"),
      newName: z.string().optional().describe("New name for cloned object"),
      renames: z.record(z.string(), z.string()).optional().describe("Map of old→new names for reference replacement"),
      addFields: z.array(z.string()).optional().describe("Field names to add to clone"),
      removeFields: z.array(z.string()).optional().describe("Field names to remove from clone"),
      parentObjectName: z.string().optional().describe("Parent object name (generate_script)"),
      parentObjectType: z.enum(["applet", "business_component", "business_service"]).optional().describe("Parent object type (generate_script)"),
      eventName: z.string().optional().describe("Event handler name (generate_script)"),
      existingBcName: z.string().optional().describe("Existing BC name (wsdl_to_sif)"),

      // --- import_docs params ---
      filePath: z.string().optional().describe("Path to file on disk"),
      content: z.string().optional().describe("Raw content (alternative to filePath)"),
      fileName: z.string().optional().default("inline.sif").describe("File name for source tracking"),
      docType: z.enum(["swagger", "wsdl", "pdf", "html", "doc", "docx", "markdown"]).optional().describe("Document type (action=import_docs)"),

      // --- import_sif params ---
      directory: z.string().optional().describe("Directory path for batch SIF import"),
      concurrency: z.number().optional().default(5).describe("Max parallel imports (batch mode)"),
      mapToGraph: z.boolean().optional().default(true).describe("Convert Siebel objects to graph nodes"),

      // --- search params ---
      query: z.string().optional().describe("Search query"),
      limit: z.number().int().min(1).max(50).optional().default(10).describe("Maximum results"),

      // --- validate params ---
      validateMode: z.enum(["full", "naming", "security", "performance", "migration_ready", "code_review"]).optional().default("full").describe("Validation mode (action=validate)"),
      ruleSetName: z.string().optional().describe("Naming rule set (validate mode=naming)"),
      checkDeps: z.boolean().optional().default(true).describe("Check missing dependencies (validate mode=full)"),
      checkCircular: z.boolean().optional().default(true).describe("Check circular dependencies (validate mode=full)"),

      // --- batch_import_sif params ---
      files: z.array(z.object({
        filePath: z.string().optional(),
        content: z.string().optional(),
        fileName: z.string().optional(),
      })).max(50).optional().describe("Array of SIF files for batch_import_sif (max 50)"),
    },
    async (params) => {
      const { action } = params;
      logger.info("tool:siebel", { action });

      try {
        switch (action) {
          case "analyze":
            return await handleSiebelAnalyze(store, params);
          case "compose":
            return await handleSiebelCompose(store, params);
          case "env":
            return await handleSiebelEnv(store, params);
          case "generate":
            return await handleSiebelGenerate(store, params);
          case "import_docs":
            return await handleSiebelImportDocs(store, params);
          case "import_sif":
            return await handleSiebelImportSif(store, params);
          case "search":
            return await handleSiebelSearch(store, params);
          case "validate":
            return await handleSiebelValidate(store, params);
          case "batch_import_sif":
            return await handleSiebelBatchImportSif(store, params);
          default:
            return mcpError(`Unknown siebel action: ${action}`);
        }
      } catch (err) {
        logger.error("tool:siebel failed", { action, error: err instanceof Error ? err.message : String(err) });
        return mcpError(err instanceof Error ? err : String(err));
      }
    },
  );
}
