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
 * ProfileAttr Flow Analyzer — maps Set/GetProfileAttr flows between scripts.
 */

import type { SiebelObject } from "../../schemas/siebel.schema.js";

export interface AttrRef {
  object: string;
  method: string;
  direction: "set" | "get";
}

export interface ProfileAttrInfo {
  name: string;
  producers: AttrRef[];
  consumers: AttrRef[];
  isOrphan: boolean;
  isUnused: boolean;
}

export interface ProfileAttrFlowResult {
  attrs: ProfileAttrInfo[];
  orphanCount: number;
  unusedCount: number;
}

const SET_PATTERN = /SetProfileAttr\s*\(\s*"([^"]+)"/g;
const GET_PATTERN = /GetProfileAttr\s*\(\s*"([^"]+)"/g;

/**
 * Analyze ProfileAttr flow across all scripts.
 */
export function analyzeProfileAttrFlow(objects: SiebelObject[]): ProfileAttrFlowResult {
  const attrMap = new Map<string, { producers: AttrRef[]; consumers: AttrRef[] }>();

  for (const obj of objects) {
    const scripts = obj.children.filter((c) => c.type === "escript");
    for (const script of scripts) {
      const sourceCode = script.properties.find((p) => p.name === "SOURCE_CODE")?.value ?? "";
      const method = script.properties.find((p) => p.name === "METHOD")?.value ?? script.name;
      if (!sourceCode) continue;

      // Extract SetProfileAttr
      SET_PATTERN.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = SET_PATTERN.exec(sourceCode)) !== null) {
        const name = match[1];
        const entry = attrMap.get(name) ?? { producers: [], consumers: [] };
        entry.producers.push({ object: obj.name, method, direction: "set" });
        attrMap.set(name, entry);
      }

      // Extract GetProfileAttr
      GET_PATTERN.lastIndex = 0;
      while ((match = GET_PATTERN.exec(sourceCode)) !== null) {
        const name = match[1];
        const entry = attrMap.get(name) ?? { producers: [], consumers: [] };
        entry.consumers.push({ object: obj.name, method, direction: "get" });
        attrMap.set(name, entry);
      }
    }
  }

  const attrs: ProfileAttrInfo[] = Array.from(attrMap.entries()).map(([name, data]) => ({
    name,
    producers: data.producers,
    consumers: data.consumers,
    isOrphan: data.producers.length === 0 && data.consumers.length > 0,
    isUnused: data.producers.length > 0 && data.consumers.length === 0,
  }));

  return {
    attrs,
    orphanCount: attrs.filter((a) => a.isOrphan).length,
    unusedCount: attrs.filter((a) => a.isUnused).length,
  };
}
