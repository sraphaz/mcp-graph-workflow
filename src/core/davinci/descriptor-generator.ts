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

import type { DaVinciVariable } from "./davinci-types.js";
import { PF_INF_DIRECTORY_MAP } from "./davinci-types.js";
import type { PfPluginType } from "./davinci-types.js";

// ── GUI Descriptor Generation ─────────────────────────────────────────

export interface GuiDescriptorResult {
  fieldDeclarations: string;
  fieldRegistrations: string;
  instanceFields: string;
}

/** Generate GUI descriptor declarations, registrations, and instance fields from DaVinci variables. */
export function generateGuiDescriptor(
  variables: DaVinciVariable[],
): GuiDescriptorResult {
  const configVars = variables.filter((v) => v.kind !== "local");
  const seen = new Set<string>();
  const declarations: string[] = [];
  const registrations: string[] = [];
  const instanceFields: string[] = [];

  for (const vVar of configVars) {
    if (seen.has(vVar.fieldName)) continue;
    seen.add(vVar.fieldName);

    declarations.push(
      `        TextFieldDescriptor ${vVar.fieldName}Field = new TextFieldDescriptor("${vVar.fieldName}", "DaVinci variable: ${vVar.fieldName}");`,
    );
    registrations.push(
      `        guiDescriptor.addField(${vVar.fieldName}Field);`,
    );
    instanceFields.push(
      `    private String ${vVar.fieldName};`,
    );
  }

  return {
    fieldDeclarations: declarations.join("\n"),
    fieldRegistrations: registrations.join("\n"),
    instanceFields: instanceFields.join("\n"),
  };
}

// ── Attribute Contract Generation ─────────────────────────────────────

/** Generate Java code for a PingFederate attribute contract from a list of attribute names. */
export function generateAttributeContract(attributes: string[]): string {
  if (attributes.length === 0) {
    return "        Set<String> contract = new HashSet<>();";
  }

  const lines = [
    "        Set<String> contract = new HashSet<>();",
    ...attributes.map((a) => `        contract.add("${a}");`),
  ];

  return lines.join("\n");
}

// ── PF-INF Descriptor ─────────────────────────────────────────────────

export interface PfInfDescriptor {
  directoryName: string;
  content: string;
  fullPath: string;
}

/** Generate the PF-INF descriptor file content and path for plugin registration. */
export function generatePfInfDescriptor(
  pluginType: string,
  packageName: string,
  className: string,
): PfInfDescriptor {
  const fqcn = `${packageName}.${className}`;

  // PingFederate uses PF_INF_DIRECTORY_MAP
  const pfDirectory = PF_INF_DIRECTORY_MAP[pluginType as PfPluginType];

  // PingAccess uses META-INF/services/{interface}
  const directoryName = pfDirectory ?? pluginType;

  return {
    directoryName,
    content: fqcn,
    fullPath: `PF-INF/${directoryName}`,
  };
}

// ── META-INF/services for PingAccess ──────────────────────────────────

/** Generate META-INF/services file content for PingAccess plugin service discovery. */
export function generateMetaInfServices(
  serviceInterface: string,
  packageName: string,
  className: string,
): { filePath: string; content: string } {
  return {
    filePath: `META-INF/services/${serviceInterface}`,
    content: `${packageName}.${className}`,
  };
}
