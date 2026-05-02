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
 * LOV Mapper — maps List of Values dependencies from eScript references.
 */

import type { SiebelObject } from "../../schemas/siebel.schema.js";

export interface LovDependent {
  object: string;
  method: string;
  value: string;
}

export interface LovTypeInfo {
  name: string;
  values: string[];
  dependents: LovDependent[];
}

export interface LovMapResult {
  lovTypes: LovTypeInfo[];
  totalLovTypes: number;
}

const LOV_PATTERN = /InvokeMethod\s*\(\s*"LookupValue"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"/g;
const LOOKUP_VALUE_PATTERN = /LookupValue\s*\(\s*"([^"]+)"\s*,\s*"([^"]+)"/g;

/**
 * Map all LOV references from eScript source code.
 */
export function mapLovDependencies(objects: SiebelObject[]): LovMapResult {
  const lovMap = new Map<string, { values: Set<string>; dependents: LovDependent[] }>();

  for (const objValue of objects) {
    const scripts = objValue.children.filter((c) => c.type === "escript");
    for (const script of scripts) {
      const sourceCode = script.properties.find((p) => p.name === "SOURCE_CODE")?.value ?? "";
      const method = script.properties.find((p) => p.name === "METHOD")?.value ?? script.name;
      if (!sourceCode) continue;

      for (const pattern of [LOV_PATTERN, LOOKUP_VALUE_PATTERN]) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(sourceCode)) !== null) {
          const lovType = match[1];
          const lovValue = match[2];

          const entry = lovMap.get(lovType) ?? { values: new Set(), dependents: [] };
          entry.values.add(lovValue);

          // Avoid duplicate dependents for same object+method
          if (!entry.dependents.some((d) => d.object === objValue.name && d.method === method && d.value === lovValue)) {
            entry.dependents.push({ object: objValue.name, method, value: lovValue });
          }

          lovMap.set(lovType, entry);
        }
      }
    }
  }

  const lovTypes: LovTypeInfo[] = Array.from(lovMap.entries()).map(([name, data]) => ({
    name,
    values: Array.from(data.values),
    dependents: data.dependents,
  }));

  return { lovTypes, totalLovTypes: lovTypes.length };
}
