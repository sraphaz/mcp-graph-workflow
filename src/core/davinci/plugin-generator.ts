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

import { parseDaVinciCode } from "./davinci-parser.js";
import type { ParseOptions } from "./davinci-parser.js";
import { resolveVariables } from "./variable-resolver.js";
import { detectPluginType } from "./plugin-type-detector.js";
import type { TargetSdkMode } from "./plugin-type-detector.js";
import { getTemplate, renderTemplate } from "./template-registry.js";
import { generatePom } from "./pom-generator.js";
import type { TargetSdk } from "./pom-generator.js";
import { ValidationError } from "../utils/errors.js";

// ── Identifier validation ──────────────────────────────────────────────

/** Validates that Java identifier inputs contain only safe characters to prevent template injection. */
export function validateJavaIdentifiers(opts: { className: string; packageName: string; pluginName: string }): void {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(opts.className)) {
    throw new ValidationError(
      "Invalid className: must be a valid Java identifier (letters, digits, underscores; start with a letter)",
      [`className "${opts.className}" contains invalid characters`],
    );
  }
  if (!opts.packageName.split(".").every((seg) => /^[a-z][a-z0-9_]*$/.test(seg))) {
    throw new ValidationError(
      "Invalid packageName: must be a valid Java package name (lowercase dot-separated identifiers)",
      [`packageName "${opts.packageName}" contains invalid characters`],
    );
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(opts.pluginName)) {
    throw new ValidationError(
      "Invalid pluginName: must contain only alphanumeric characters, hyphens, and underscores",
      [`pluginName "${opts.pluginName}" contains invalid characters`],
    );
  }
}

export function validateAttributeContract(attributes: readonly string[]): void {
  for (const attribute of attributes) {
    if (!/^[A-Za-z][A-Za-z0-9_.-]*$/.test(attribute)) {
      throw new ValidationError(
        "Invalid attributeContract: entries must be safe identifiers (letters, digits, underscore, dot, hyphen)",
        [`attributeContract entry "${attribute}" contains invalid characters`],
      );
    }
  }
}

// ── Types ─────────────────────────────────────────────────────────────

export interface GeneratePluginOptions {
  code: string;
  pluginName: string;
  packageName: string;
  className: string;
  targetSdk: TargetSdk;
  pluginType?: string;
  codeLocation?: "custom_function" | "code_snippet" | "html_template";
  attributeContract?: string[];
  javaVersion?: string;
  sdkPath?: string;
}

export interface GeneratePluginResult {
  javaCode: string;
  pomXml: string;
  pfInfContent: string;
  pfInfType: string;
  pluginType: string;
  confidence: number;
  warnings: string[];
  analysis: {
    variableCount: number;
    apiCallCount: number;
    flowLogic: Record<string, boolean>;
  };
}

// ── Main Entry Point ──────────────────────────────────────────────────

export function generatePlugin(options: GeneratePluginOptions): GeneratePluginResult {
  const {
    code,
    pluginName,
    packageName,
    className,
    targetSdk,
    codeLocation,
    attributeContract = [],
    javaVersion,
    sdkPath,
  } = options;

  // Validate identifiers to prevent Java code injection via template variables
  validateJavaIdentifiers({ className, packageName, pluginName });
  validateAttributeContract(attributeContract);

  // 1. Parse DaVinci code
  const analysis = parseDaVinciCode(code, {
    codeLocation: codeLocation ?? undefined,
  } as ParseOptions);

  // 2. Resolve variables
  const resolved = resolveVariables(analysis.variables);

  // 3. Detect plugin type
  const detection = detectPluginType(analysis, targetSdk as TargetSdkMode, {
    sourceCode: code,
    override: options.pluginType,
  });

  // 4. Get template
  const template = getTemplate(detection.pluginType, targetSdk);
  if (!template) {
    return {
      javaCode: `// No template available for plugin type: ${detection.pluginType} (${targetSdk})`,
      pomXml: "",
      pfInfContent: "",
      pfInfType: "",
      pluginType: detection.pluginType,
      confidence: detection.confidence,
      warnings: [...analysis.warnings, ...detection.warnings, `No template for ${detection.pluginType}`],
      analysis: {
        variableCount: analysis.variables.length,
        apiCallCount: analysis.apiCalls.length,
        flowLogic: analysis.flowLogic as unknown as Record<string, boolean>,
      },
    };
  }

  // 5. Build GUI fields code
  const guiFieldLines = resolved
    .filter((v) => v.guiFieldCode)
    .map((v) => `        ${v.guiFieldCode}`)
    .join("\n");

  // 6. Build configure() body
  const configureLines = resolved
    .filter((v) => v.configureCode)
    .map((v) => `        ${v.configureCode}`)
    .join("\n");

  // 7. Render Java class
  const javaCode = renderTemplate(template, {
    className,
    packageName,
    pluginName,
    guiFields: guiFieldLines,
    configureBody: configureLines,
    mainMethodBody: `        // TODO: Translate DaVinci logic to Java\n        // Source had ${analysis.apiCalls.length} API calls, ${analysis.variables.length} variables`,
    attributeContract,
  });

  // 8. Generate POM
  const pomXml = generatePom({
    pluginName,
    packageName,
    className,
    pluginType: detection.pluginType as "idp-adapter",
    attributeContract,
    javaVersion: javaVersion ?? (targetSdk === "pingaccess" ? "17" : "11"),
    sdkPath,
  }, targetSdk);

  // 9. PF-INF descriptor
  const pfInfContent = `${packageName}.${className}`;
  const pfInfType = template.pfInfType;

  return {
    javaCode,
    pomXml,
    pfInfContent,
    pfInfType,
    pluginType: detection.pluginType,
    confidence: detection.confidence,
    warnings: [...analysis.warnings, ...detection.warnings],
    analysis: {
      variableCount: analysis.variables.length,
      apiCallCount: analysis.apiCalls.length,
      flowLogic: analysis.flowLogic as unknown as Record<string, boolean>,
    },
  };
}
