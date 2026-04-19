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

import { access, constants } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { assertPathInside } from "./safe-path.js";
import { McpGraphError } from "./errors.js";

/** Check whether a file exists and is readable at the given path. */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read a file safely — rejects paths outside the project directory.
 * Prevents path traversal attacks (similar to readPrdFile in read-file.ts).
 */
export function safeReadFileSync(
  filePath: string,
  allowedExtensions?: Set<string>,
): string {
  const projectRoot = process.cwd();
  const absolutePath = assertPathInside(filePath, projectRoot);

  if (allowedExtensions) {
    const ext = path.extname(absolutePath).toLowerCase();
    if (ext && !allowedExtensions.has(ext)) {
      throw new McpGraphError(`Unsupported file extension: ${ext}. Allowed: ${[...allowedExtensions].join(", ")}`);
    }
  }

  return readFileSync(absolutePath, "utf-8");
}

/**
 * Validate that a path is within the project directory.
 * Uses centralized assertPathInside for comprehensive traversal protection.
 */
export function assertPathInsideProject(targetPath: string): string {
  return assertPathInside(targetPath, process.cwd());
}
