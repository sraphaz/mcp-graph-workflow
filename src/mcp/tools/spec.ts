/**
 * MCP Tool — spec
 * Manage structured spec documents. Actions: generate, validate, list_templates.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { getSpecTemplate, listSpecTemplates } from "../../core/spec-templates/built-in-spec-templates.js";
import { generateSpecDocument, validateSpecDocument } from "../../core/spec-templates/spec-template-engine.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

/* ------------------------------------------------------------------ */
/*  Handlers (exported for testing)                                    */
/* ------------------------------------------------------------------ */

export function handleSpecListTemplates(): {
  ok: boolean;
  templates: Array<{ name: string; phase: string; description: string; sectionCount: number }>;
} {
  return { ok: true, templates: listSpecTemplates() };
}

export function handleSpecGenerate(
  store: SqliteStore,
  params: { templateName: string; variables: Record<string, unknown>; constitutionPrinciples?: Array<{ id: string; title: string; description: string }> },
): { ok: boolean; markdown?: string; knowledgeIndexed?: boolean; error?: string } {
  const template = getSpecTemplate(params.templateName);
  if (!template) {
    return { ok: false, error: `Template not found: "${params.templateName}"` };
  }

  const markdown = generateSpecDocument(template, params.variables, params.constitutionPrinciples);

  // Index in knowledge store
  let knowledgeIndexed = false;
  try {
    const ks = new KnowledgeStore(store.getDb());
    const projectName = String(params.variables.projectName ?? template.name);
    const sourceId = `spec_template:${template.name}:${projectName}`;

    ks.deleteBySource("spec_template", sourceId);
    ks.insert({
      sourceType: "spec_template",
      sourceId,
      title: `Spec: ${projectName} (${template.phase})`,
      content: markdown,
      metadata: {
        templateName: template.name,
        phase: template.phase,
        variables: params.variables,
        indexedAt: new Date().toISOString(),
      },
    });
    knowledgeIndexed = true;
  } catch (err) {
    logger.error("Failed to index spec document", { error: err instanceof Error ? err.message : String(err) });
  }

  logger.info("Spec generated", { template: params.templateName, phase: template.phase });

  return { ok: true, markdown, knowledgeIndexed };
}

export function handleSpecValidate(
  params: { content: string; templateName: string },
): { ok: boolean; valid: boolean; missing: string[]; warnings: string[]; error?: string } {
  const template = getSpecTemplate(params.templateName);
  if (!template) {
    return { ok: false, valid: false, missing: [], warnings: [], error: `Template not found: "${params.templateName}"` };
  }

  const result = validateSpecDocument(params.content, template);

  return {
    ok: true,
    valid: result.valid,
    missing: result.missing,
    warnings: result.warnings,
  };
}

/* ------------------------------------------------------------------ */
/*  MCP Registration                                                   */
/* ------------------------------------------------------------------ */

export function registerSpec(server: McpServer, store: SqliteStore): void {
  server.tool(
    "spec",
    "Manage structured spec documents. Actions: generate, validate, list_templates.",
    {
      action: z.enum(["generate", "validate", "list_templates"]).describe("Action to perform"),
      templateName: z.string().optional().describe("Template name (generate/validate)"),
      variables: z.record(z.string(), z.unknown()).optional().describe("Variables for template (generate)"),
      content: z.string().optional().describe("Document content to validate (validate)"),
    },
    async (params) => {
      try {
        switch (params.action) {
          case "list_templates":
            return mcpText(handleSpecListTemplates());

          case "generate":
            if (!params.templateName) return mcpError("templateName required for generate");
            return mcpText(handleSpecGenerate(store, {
              templateName: params.templateName,
              variables: params.variables ?? {},
            }));

          case "validate":
            if (!params.templateName || !params.content) return mcpError("templateName and content required for validate");
            return mcpText(handleSpecValidate({
              content: params.content,
              templateName: params.templateName,
            }));

          default:
            return mcpError(`Unknown action: ${params.action}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error("Spec tool error", { action: params.action, error: msg });
        return mcpError(msg);
      }
    },
  );
}
