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

import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "core", source: "implicit-deps.ts" });

// Matches: import ... from "..." or import ... from '...'
const IMPORT_RE = /from\s+['"]([^'"]+)['"]/g;

/**
 * Scans touched files for shared relative imports across agents.
 * Returns advisory warnings — never throws.
 * Only flags relative imports (starting with . or /) to avoid noise from shared node_modules.
 */
export function detectImplicitDeps(
  touchedFiles: string[],
  fileContents?: Record<string, string>,
): string[] {
  if (touchedFiles.length < 2) return [];

  try {
    // Build map: importPath → files that import it
    const importToFiles = new Map<string, string[]>();

    for (const filePath of touchedFiles) {
      const content = fileContents?.[filePath];
      if (!content) continue;

      const matches = content.matchAll(IMPORT_RE);
      for (const match of matches) {
        const importPath = match[1];
        // Only relative imports — skip node_modules
        if (!importPath.startsWith(".") && !importPath.startsWith("/")) continue;

        const existing = importToFiles.get(importPath) ?? [];
        existing.push(filePath);
        importToFiles.set(importPath, existing);
      }
    }

    const warnings: string[] = [];
    for (const [importPath, files] of importToFiles) {
      if (files.length > 1) {
        warnings.push(
          `implicit-dep warning: "${importPath}" imported by ${files.length} touched files (${files.join(", ")}) — potential shared state conflict`,
        );
      }
    }

    return warnings;
  } catch (err) {
    log.warn("implicit_deps:scan_error", { error: String(err) });
    return [];
  }
}
