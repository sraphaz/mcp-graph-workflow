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
 * MCP Tool — davinci
 * Consolidated DaVinci converter tool with action-based routing.
 * Replaces 3 separate davinci_* tools: analyze, build, convert + new batch_convert.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { parseDaVinciCode } from "../../core/davinci/davinci-parser.js";
import { resolveVariables } from "../../core/davinci/variable-resolver.js";
import { detectPluginType } from "../../core/davinci/plugin-type-detector.js";
import { checkBuildEnvironment, runMavenBuild } from "../../core/davinci/build-runner.js";
import { validateBuildResult, validatePreConversion, validatePostGeneration } from "../../core/davinci/davinci-validators.js";
import { DaVinciStore } from "../../core/davinci/davinci-store.js";
import type { TargetSdk } from "../../core/davinci/pom-generator.js";
import { generateGuiDescriptor, generatePfInfDescriptor } from "../../core/davinci/descriptor-generator.js";
import { generatePlugin } from "../../core/davinci/plugin-generator.js";
import { mcpText, mcpError } from "../response-helpers.js";
import { logger } from "../../core/utils/logger.js";

/* ------------------------------------------------------------------ */
/*  Action handlers                                                    */
/* ------------------------------------------------------------------ */

interface DavinciParams {
  action: "analyze" | "build" | "convert" | "batch_convert";
  code?: string | undefined;
  codeLocation?: "custom_function" | "code_snippet" | "html_template" | undefined;
  targetSdk?: "pingfederate" | "pingaccess" | undefined;
  projectDir?: string | undefined;
  checkOnly?: boolean | undefined;
  jobId?: string | undefined;
  pluginName?: string | undefined;
  packageName?: string | undefined;
  className?: string | undefined;
  pluginType?: string | undefined;
  files?: Array<{
    code: string;
    pluginName: string;
    packageName: string;
    className: string;
    targetSdk?: "pingfederate" | "pingaccess" | undefined;
    pluginType?: string | undefined;
  }> | undefined;
}

function handleAnalyze(params: DavinciParams): ReturnType<typeof mcpText> {
  const { code, codeLocation, targetSdk } = params;
  if (!code) {
    return mcpError("Missing required param 'code' for action=analyze");
  }

  logger.info("davinci: analyzing code", { codeLength: code.length, codeLocation });

  const analysis = parseDaVinciCode(code, {
    codeLocation: codeLocation ?? undefined,
  });

  const resolvedVariables = resolveVariables(analysis.variables);

  const detection = detectPluginType(analysis, targetSdk ?? "pingfederate", {
    sourceCode: code,
  });

  return mcpText(JSON.stringify({
    ok: true,
    analysis,
    resolvedVariables,
    detection,
  }));
}

async function handleBuild(params: DavinciParams, store: SqliteStore): Promise<ReturnType<typeof mcpText>> {
  const { projectDir, checkOnly, jobId } = params;
  if (!projectDir) {
    return mcpError("Missing required param 'projectDir' for action=build");
  }

  logger.info("davinci: build requested", { projectDir, checkOnly, jobId });

  const env = checkBuildEnvironment();

  if (checkOnly) {
    return mcpText(JSON.stringify({
      ok: true,
      action: "environment_check",
      environment: env,
    }));
  }

  if (!env.readyToBuild) {
    return mcpText(JSON.stringify({
      ok: false,
      action: "build_blocked",
      reason: "Build environment not ready",
      environment: env,
      hint: env.instructions.join(" | "),
    }));
  }

  // Update job status to building
  if (jobId) {
    try {
      const davinciStore = new DaVinciStore(store.getDb());
      davinciStore.updateJob(jobId, { status: "building" });
    } catch (err) {
      logger.warn("davinci: failed to update job to building", { jobId, error: String(err) });
    }
  }

  const result = await runMavenBuild(projectDir);

  // Validate build result
  const buildValidation = validateBuildResult(result);

  // Update job with build outcome
  if (jobId) {
    try {
      const davinciStore = new DaVinciStore(store.getDb());
      davinciStore.updateJob(jobId, {
        status: result.success ? "done" : "failed",
        jarPath: result.jarPath,
        buildOutput: result.stdout.slice(0, 5000),
      });
      logger.info("davinci: job build updated", { jobId, success: result.success });
    } catch (err) {
      logger.warn("davinci: failed to update job after build", { jobId, error: String(err) });
    }
  }

  return mcpText(JSON.stringify({
    ok: result.success,
    action: "build_complete",
    jobId,
    buildResult: {
      success: result.success,
      jarPath: result.jarPath,
      durationMs: result.durationMs,
      stdout: result.stdout.slice(0, 2000),
      stderr: result.stderr.slice(0, 2000),
    },
    validation: buildValidation.issues,
    environment: env,
  }));
}

function convertSingle(
  code: string,
  pluginName: string,
  packageName: string,
  className: string,
  targetSdk: TargetSdk,
  pluginType: string | undefined,
  store: SqliteStore,
): Record<string, unknown> {
  // 1. Parse and analyze
  const analysis = parseDaVinciCode(code);

  // 2. Pre-conversion validation
  const preValidation = validatePreConversion(code, analysis);
  if (!preValidation.valid) {
    return {
      ok: false,
      action: "validation_failed",
      phase: "pre_conversion",
      issues: preValidation.issues,
      hint: "Fix the errors above before conversion.",
    };
  }

  // 3. Generate plugin via full pipeline
  const pluginResult = generatePlugin({
    code,
    pluginName,
    packageName,
    className,
    targetSdk,
    pluginType,
  });

  // 4. Post-generation validation
  const postValidation = validatePostGeneration(pluginResult);

  // 5. Generate rich GUI descriptor
  const guiDescriptor = generateGuiDescriptor(analysis.variables);

  // 6. Generate PF-INF descriptor
  const pfInfDescriptor = generatePfInfDescriptor(
    pluginResult.pluginType,
    packageName,
    className,
  );

  // 7. Persist job to store
  let jobId: string | undefined;
  try {
    const davinciStore = new DaVinciStore(store.getDb());
    const job = davinciStore.createJob({
      sourceCode: code,
      pluginType: pluginResult.pluginType,
      pluginName,
      packageName,
      className,
      targetSdk,
    });
    davinciStore.updateJob(job.id, {
      status: "done",
      analysis: JSON.stringify(pluginResult.analysis),
      generatedJava: pluginResult.javaCode,
      generatedPom: pluginResult.pomXml,
      confidence: pluginResult.confidence,
      warnings: [...pluginResult.warnings, ...preValidation.issues.map((i) => `[${i.severity}] ${i.message}`)],
    });
    jobId = job.id;
    logger.info("davinci: job persisted", { jobId, pluginName });
  } catch (err) {
    logger.warn("davinci: failed to persist job", { error: String(err) });
  }

  return {
    ok: postValidation.valid,
    jobId,
    pluginName,
    className,
    packageName,
    pluginType: pluginResult.pluginType,
    confidence: pluginResult.confidence,
    javaCode: pluginResult.javaCode,
    pomXml: pluginResult.pomXml,
    pfInfDescriptor: {
      directoryName: pfInfDescriptor.directoryName,
      content: pfInfDescriptor.content,
      fullPath: pfInfDescriptor.fullPath,
    },
    guiDescriptor: {
      fieldDeclarations: guiDescriptor.fieldDeclarations,
      fieldRegistrations: guiDescriptor.fieldRegistrations,
      instanceFields: guiDescriptor.instanceFields,
    },
    validation: {
      preConversion: preValidation.issues,
      postGeneration: postValidation.issues,
    },
    analysis: pluginResult.analysis,
    hint: "Use the generated POM and Java structure to build the plugin. Run davinci(action=build) to compile.",
  };
}

function handleConvert(params: DavinciParams, store: SqliteStore): ReturnType<typeof mcpText> {
  const { code, pluginName, packageName, className, targetSdk, pluginType } = params;
  if (!code || !pluginName || !packageName || !className) {
    return mcpError("Missing required params for action=convert: code, pluginName, packageName, className");
  }

  logger.info("davinci: converting code", { pluginName, targetSdk });

  const sdk: TargetSdk = targetSdk ?? "pingfederate";
  const result = convertSingle(code, pluginName, packageName, className, sdk, pluginType, store);
  return mcpText(JSON.stringify(result));
}

function handleBatchConvert(params: DavinciParams, store: SqliteStore): ReturnType<typeof mcpText> {
  const { files } = params;
  if (!files || files.length === 0) {
    return mcpError("Missing required param 'files' for action=batch_convert (array of objects, max 50)");
  }

  logger.info("davinci: batch converting", { count: files.length });

  const results: Array<Record<string, unknown>> = [];
  let successCount = 0;
  let failCount = 0;

  for (const file of files) {
    const sdk: TargetSdk = file.targetSdk ?? "pingfederate";
    const result = convertSingle(
      file.code,
      file.pluginName,
      file.packageName,
      file.className,
      sdk,
      file.pluginType,
      store,
    );
    if (result.ok) {
      successCount++;
    } else {
      failCount++;
    }
    results.push(result);
  }

  return mcpText(JSON.stringify({
    ok: failCount === 0,
    action: "batch_convert",
    total: files.length,
    success: successCount,
    failed: failCount,
    results,
  }));
}

/* ------------------------------------------------------------------ */
/*  Registration                                                       */
/* ------------------------------------------------------------------ */

export function registerDavinci(server: McpServer, store: SqliteStore): void {
  server.tool(
    "davinci",
    "DaVinci converter: analyze JS code, convert to PingAccess/PingFederate Java plugin, build with Maven, or batch convert multiple files",
    {
      action: z.enum(["analyze", "build", "convert", "batch_convert"])
        .describe("DaVinci action to perform"),

      // --- analyze params ---
      code: z.string().optional()
        .describe("DaVinci JavaScript code (required for analyze/convert, and per-file for batch_convert)"),
      codeLocation: z.enum(["custom_function", "code_snippet", "html_template"]).optional()
        .describe("Code location type (action=analyze, default: auto-detect)"),
      targetSdk: z.enum(["pingfederate", "pingaccess"]).optional()
        .describe("Target SDK (default: pingfederate)"),

      // --- build params ---
      projectDir: z.string().optional()
        .describe("Path to Maven project directory (action=build)"),
      checkOnly: z.boolean().optional()
        .describe("Only check environment, do not build (action=build, default: false)"),
      jobId: z.string().optional()
        .describe("DaVinci job ID to update with build results (action=build)"),

      // --- convert params ---
      pluginName: z.string().optional()
        .describe("Plugin name, kebab-case (action=convert, e.g. 'my-auth-adapter')"),
      packageName: z.string().optional()
        .describe("Java package name (action=convert, e.g. 'com.example.adapter')"),
      className: z.string().optional()
        .describe("Java class name (action=convert, e.g. 'MyAuthAdapter')"),
      pluginType: z.string().optional()
        .describe("Override plugin type (action=convert, e.g. 'idp-adapter')"),

      // --- batch_convert params ---
      files: z.array(z.object({
        code: z.string().describe("DaVinci JavaScript code"),
        pluginName: z.string().describe("Plugin name (kebab-case)"),
        packageName: z.string().describe("Java package name"),
        className: z.string().describe("Java class name"),
        targetSdk: z.enum(["pingfederate", "pingaccess"]).optional()
          .describe("Target SDK (default: pingfederate)"),
        pluginType: z.string().optional()
          .describe("Override plugin type"),
      })).max(50).optional()
        .describe("Array of files for batch_convert (max 50)"),
    },
    async (params) => {
      const { action } = params;
      logger.info("tool:davinci", { action });

      try {
        switch (action) {
          case "analyze":
            return handleAnalyze(params as DavinciParams);
          case "build":
            return await handleBuild(params as DavinciParams, store);
          case "convert":
            return handleConvert(params as DavinciParams, store);
          case "batch_convert":
            return handleBatchConvert(params as DavinciParams, store);
          default:
            return mcpError(`Unknown davinci action: ${action}`);
        }
      } catch (err) {
        logger.error("tool:davinci failed", { action, error: err instanceof Error ? err.message : String(err) });
        return mcpError(err instanceof Error ? err : String(err));
      }
    },
  );
}
