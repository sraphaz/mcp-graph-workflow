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

import type { DaVinciVariable, ResolvedVariable } from "./davinci-types.js";

// ── Options ───────────────────────────────────────────────────────────

export interface ResolveOptions {
  jsonParseContext?: boolean;
}

// ── Core Resolution ───────────────────────────────────────────────────

/** Resolve a single DaVinci variable into its Java expression and GUI/configure code. */
export function resolveVariable(
  variable: DaVinciVariable,
  options: ResolveOptions = {},
): ResolvedVariable {
  const javaExpression = buildJavaExpression(variable, options);
  const guiFieldCode = generateGuiFieldCode(variable);
  const configureCode = generateConfigureCode(variable);

  return {
    original: variable,
    javaExpression,
    guiFieldCode: guiFieldCode || undefined,
    configureCode: configureCode || undefined,
  };
}

/** Resolve a list of DaVinci variables, deduplicating by kind and field name. */
export function resolveVariables(variables: DaVinciVariable[]): ResolvedVariable[] {
  const seen = new Set<string>();
  const results: ResolvedVariable[] = [];

  for (const variable of variables) {
    const key = `${variable.kind}:${variable.fieldName}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    results.push(resolveVariable(variable));
  }

  return results;
}

// ── Java Expression Builder ───────────────────────────────────────────

function buildJavaExpression(
  variable: DaVinciVariable,
  options: ResolveOptions,
): string {
  if (options.jsonParseContext) {
    return `new ObjectMapper().readTree(configuration.getFieldValue("${variable.fieldName}"))`;
  }

  switch (variable.kind) {
    case "local":
      return `inMap.get("${variable.fieldName}").getValue() /* from node: ${variable.nodeId ?? "unknown"} */`;

    case "global":
    case "flow":
    case "parameter":
      return `configuration.getFieldValue("${variable.fieldName}")`;

    default:
      return `configuration.getFieldValue("${variable.fieldName}")`;
  }
}

// ── GUI Field Code Generator ──────────────────────────────────────────

/** Generate Java GUI field declaration and registration code for a DaVinci variable. */
export function generateGuiFieldCode(variable: DaVinciVariable): string {
  if (variable.kind === "local") {
    return "";
  }

  const fieldName = variable.fieldName;
  const lines = [
    `TextFieldDescriptor ${fieldName}Field = new TextFieldDescriptor("${fieldName}", "DaVinci variable: ${fieldName}");`,
    `guiDescriptor.addField(${fieldName}Field);`,
  ];

  return lines.join("\n");
}

// ── Configure Code Generator ──────────────────────────────────────────

/** Generate the Java configure() method assignment for a DaVinci variable. */
export function generateConfigureCode(variable: DaVinciVariable): string {
  if (variable.kind === "local") {
    return "";
  }

  const fieldName = variable.fieldName;
  return `this.${fieldName} = configuration.getFieldValue("${fieldName}");`;
}
