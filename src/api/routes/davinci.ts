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
import { basename, join } from "node:path";
import { mkdirSync } from "node:fs";
import { ValidationError } from "../../core/utils/errors.js";

/**
 * Sanitize a DaVinci plugin name to prevent path traversal attacks.
 * Accepts only kebab-case names with alphanumeric characters, hyphens, and underscores.
 * @throws ValidationError if the name is unsafe or invalid
 */
export function sanitizePluginName(pluginName: string): string {
  if (pluginName.includes("..") || pluginName.includes("/") || pluginName.includes("\\")) {
    throw new ValidationError("Invalid pluginName: must not contain path separators or traversal sequences", [
      `pluginName "${pluginName}" contains unsafe characters`,
    ]);
  }
  const safe = basename(pluginName);
  if (safe !== pluginName || !/^[a-zA-Z0-9_-]+$/.test(safe)) {
    throw new ValidationError("Invalid pluginName: must contain only alphanumeric characters, hyphens, and underscores", [
      `pluginName "${pluginName}" is not a safe path component`,
    ]);
  }
  return safe;
}
import { checkBuildEnvironment, scaffoldMavenProject, runMavenBuild } from "../../core/davinci/build-runner.js";
import { parseDaVinciCode } from "../../core/davinci/davinci-parser.js";
import { detectPluginType } from "../../core/davinci/plugin-type-detector.js";
import { resolveVariables } from "../../core/davinci/variable-resolver.js";
import { generatePlugin } from "../../core/davinci/plugin-generator.js";
import { listTemplates, getTemplate } from "../../core/davinci/template-registry.js";
import type { TargetSdk } from "../../core/davinci/pom-generator.js";

export function createDavinciRouter(): Router {
  const router = Router();

  // ── GET /environment ────────────────────────────────────────────────

  router.get("/environment", (_req, res) => {
    try {
      const env = checkBuildEnvironment();
      res.json({ ok: true, environment: env });
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ── POST /analyze ───────────────────────────────────────────────────

  router.post("/analyze", (req, res) => {
    try {
      const { code, codeLocation } = req.body ?? {};
      if (!code || typeof code !== "string") {
        res.status(400).json({ ok: false, error: "Missing 'code' in request body" });
        return;
      }

      const analysis = parseDaVinciCode(code, { codeLocation: codeLocation ?? undefined });
      const variables = resolveVariables(analysis.variables);

      res.json({ ok: true, analysis, resolvedVariables: variables });
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ── POST /detect-type ───────────────────────────────────────────────

  router.post("/detect-type", (req, res) => {
    try {
      const { code, targetSdk, override } = req.body ?? {};
      if (!code || typeof code !== "string") {
        res.status(400).json({ ok: false, error: "Missing 'code' in request body" });
        return;
      }

      const analysis = parseDaVinciCode(code);
      const result = detectPluginType(analysis, targetSdk ?? "pingfederate", {
        sourceCode: code,
        override,
      });

      res.json({ ok: true, detection: result });
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ── POST /convert ───────────────────────────────────────────────────

  router.post("/convert", (req, res) => {
    try {
      const { code, pluginName, packageName, className, targetSdk, pluginType, attributeContract } = req.body ?? {};

      if (!code || typeof code !== "string") {
        res.status(400).json({ ok: false, error: "Missing 'code' in request body" });
        return;
      }
      if (!pluginName || !packageName || !className) {
        res.status(400).json({ ok: false, error: "Missing required fields: pluginName, packageName, className" });
        return;
      }

      const result = generatePlugin({
        code,
        pluginName,
        packageName,
        className,
        targetSdk: (targetSdk as TargetSdk) ?? "pingfederate",
        pluginType,
        attributeContract: attributeContract ?? [],
      });

      res.json({ ok: true, ...result });
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ── POST /convert-and-build ──────────────────────────────────────────

  router.post("/convert-and-build", async (req, res) => {
    try {
      const { code, pluginName, packageName, className, targetSdk, pluginType, attributeContract } = req.body ?? {};

      if (!code || !pluginName || !packageName || !className) {
        res.status(400).json({ ok: false, error: "Missing required fields: code, pluginName, packageName, className" });
        return;
      }

      // 1. Generate Java + POM
      const sdk: TargetSdk = (targetSdk as TargetSdk) ?? "pingfederate";
      const genResult = generatePlugin({
        code, pluginName, packageName, className,
        targetSdk: sdk,
        pluginType,
        attributeContract: attributeContract ?? [],
      });

      // 2. Check environment
      const env = checkBuildEnvironment();
      if (!env.readyToBuild) {
        res.json({
          ok: false,
          phase: "environment_check",
          reason: "Build environment not ready",
          environment: env,
          generated: { javaCode: genResult.javaCode, pomXml: genResult.pomXml, pfInfContent: genResult.pfInfContent, pfInfType: genResult.pfInfType },
        });
        return;
      }

      // 3. Scaffold project on disk
      const safePluginName = sanitizePluginName(pluginName as string);
      const outputDir = join(process.cwd(), "workflow-graph", "davinci-builds", `${safePluginName}-${Date.now()}`);
      mkdirSync(outputDir, { recursive: true });

      const template = getTemplate(genResult.pluginType, sdk);
      const scaffold = await scaffoldMavenProject({
        outputDir,
        javaCode: genResult.javaCode,
        pomXml: genResult.pomXml,
        packageName,
        className,
        pfInfContent: genResult.pfInfContent,
        pfInfType: template?.pfInfType,
      });

      // 4. Run Maven build
      const buildResult = await runMavenBuild(scaffold.projectDir);

      res.json({
        ok: buildResult.success,
        phase: "build_complete",
        pluginType: genResult.pluginType,
        confidence: genResult.confidence,
        projectDir: scaffold.projectDir,
        jarPath: buildResult.jarPath ?? null,
        buildDurationMs: buildResult.durationMs,
        buildOutput: (buildResult.stdout ?? "").slice(0, 2000),
        buildErrors: (buildResult.stderr ?? "").slice(0, 2000),
        environment: env,
        warnings: genResult.warnings,
      });
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ── POST /build ─────────────────────────────────────────────────────

  router.post("/build", async (req, res) => {
    try {
      const { projectDir } = req.body ?? {};
      if (!projectDir || typeof projectDir !== "string") {
        res.status(400).json({ ok: false, error: "Missing 'projectDir' in request body" });
        return;
      }

      const env = checkBuildEnvironment();
      if (!env.readyToBuild) {
        res.json({ ok: false, reason: "Environment not ready", environment: env });
        return;
      }

      const result = await runMavenBuild(projectDir);
      res.json({ ok: result.success, buildResult: result, environment: env });
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ── GET /templates ──────────────────────────────────────────────────

  router.get("/templates", (req, res) => {
    try {
      const sdk = (req.query.sdk as string) ?? "pingfederate";
      const templates = listTemplates(sdk as "pingfederate" | "pingaccess");

      res.json({
        ok: true,
        sdk,
        templates: templates.map((t) => ({
          pluginType: t.pluginType,
          interfaceName: t.interfaceName,
          mainMethodSignature: t.mainMethodSignature,
          pfInfType: t.pfInfType,
          importCount: t.imports.length,
        })),
      });
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}
