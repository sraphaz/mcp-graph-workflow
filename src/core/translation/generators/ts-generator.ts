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
 * TypeScript Generator — emits TypeScript code from canonical constructs
 * using UCR syntax patterns with {{placeholder}} substitution.
 */

import { ConstructRegistry } from "../ucr/construct-registry.js";
import type { GeneratorAdapter, GeneratedCode } from "./generator-adapter.js";
import type { ParsedConstruct } from "../parsers/parser-adapter.js";

export class TsGenerator implements GeneratorAdapter {
  readonly languageId = "typescript";

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

/** Substitute {{placeholders}} in a syntax pattern with construct data. */
function substitutePattern(pattern: string, construct: ParsedConstruct): string {
  let resultValue = pattern;
  if (construct.name) {
    resultValue = resultValue.replace(/\{\{name\}\}/g, construct.name);
  }
  // Default placeholders for unresolved template vars
  resultValue = resultValue.replace(/\{\{members\}\}/g, "// TODO: members");
  resultValue = resultValue.replace(/\{\{params\}\}/g, "");
  resultValue = resultValue.replace(/\{\{body\}\}/g, "// TODO: implement");
  resultValue = resultValue.replace(/\{\{value\}\}/g, "undefined");
  resultValue = resultValue.replace(/\{\{condition\}\}/g, "/* condition */");
  resultValue = resultValue.replace(/\{\{type\}\}/g, "unknown");
  resultValue = resultValue.replace(/\{\{module\}\}/g, "'./module'");
  resultValue = resultValue.replace(/\{\{items\}\}/g, "items");
  resultValue = resultValue.replace(/\{\{item\}\}/g, "item");
  resultValue = resultValue.replace(/\{\{expression\}\}/g, "/* expression */");
  resultValue = resultValue.replace(/\{\{error\}\}/g, "e");
  resultValue = resultValue.replace(/\{\{message\}\}/g, "'Error'");
  return resultValue;
}
