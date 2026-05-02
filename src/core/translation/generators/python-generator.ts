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
 * Python Generator — emits Python code from canonical constructs
 * using UCR syntax patterns. Handles indentation, snake_case naming,
 * and Python-specific imports.
 */

import { ConstructRegistry } from "../ucr/construct-registry.js";
import type { GeneratorAdapter, GeneratedCode } from "./generator-adapter.js";
import type { ParsedConstruct } from "../parsers/parser-adapter.js";

export class PythonGenerator implements GeneratorAdapter {
  readonly languageId = "python";

  constructor(private readonly registry: ConstructRegistry) {}

  generate(constructs: ParsedConstruct[]): GeneratedCode {
    if (constructs.length === 0) {
      return { code: "", mappedConstructs: [], unmappedConstructs: [] };
    }

    const lines: string[] = [];
    const mapped: string[] = [];
    const unmapped: string[] = [];

    for (const construct of constructs) {
      const mapping = this.registry.getPrimaryMapping(construct.constructId, this.languageId);

      if (!mapping || !mapping.syntaxPattern) {
        unmapped.push(construct.constructId);
        continue;
      }

      const code = substitutePattern(mapping.syntaxPattern, construct);
      lines.push(code);
      mapped.push(construct.constructId);
    }

    return {
      code: lines.join("\n\n"),
      mappedConstructs: mapped,
      unmappedConstructs: unmapped,
    };
  }
}

/** Convert camelCase to snake_case for Python naming conventions. */
function toSnakeCase(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}

/** Check if a name is PascalCase (class-like). */
function isPascalCase(name: string): boolean {
  return /^[A-Z][a-zA-Z0-9]*$/.test(name);
}

/** Substitute {{placeholders}} in a syntax pattern with construct data. */
function substitutePattern(pattern: string, construct: ParsedConstruct): string {
  let resultValue = pattern;

  if (construct.name) {
    // Keep PascalCase for classes, convert functions/variables to snake_case
    const isClass = construct.constructId === "uc_class_def" || construct.constructId === "uc_abstract_class";
    const name = isClass || isPascalCase(construct.name) && isClass
      ? construct.name
      : toSnakeCase(construct.name);
    resultValue = resultValue.replace(/\{\{name\}\}/g, name);
  }

  // Default placeholders for unresolved template vars
  resultValue = resultValue.replace(/\{\{members\}\}/g, "pass  # TODO: members");
  resultValue = resultValue.replace(/\{\{params\}\}/g, "");
  resultValue = resultValue.replace(/\{\{body\}\}/g, "pass  # TODO: implement");
  resultValue = resultValue.replace(/\{\{value\}\}/g, "None");
  resultValue = resultValue.replace(/\{\{condition\}\}/g, "True  # condition");
  resultValue = resultValue.replace(/\{\{type\}\}/g, "Any");
  resultValue = resultValue.replace(/\{\{module\}\}/g, "module");
  resultValue = resultValue.replace(/\{\{items\}\}/g, "items");
  resultValue = resultValue.replace(/\{\{item\}\}/g, "item");
  resultValue = resultValue.replace(/\{\{expression\}\}/g, "None  # expression");
  resultValue = resultValue.replace(/\{\{error\}\}/g, "e");
  resultValue = resultValue.replace(/\{\{message\}\}/g, "'Error'");
  resultValue = resultValue.replace(/\{\{parent\}\}/g, "object");
  return resultValue;
}
