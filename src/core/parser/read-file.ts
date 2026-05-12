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

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "../utils/fs.js";
import { FileNotFoundError, InvalidArgumentError } from "../utils/errors.js";
import { assertPathInside } from "../utils/safe-path.js";

export interface PrdFileResult {
  content: string;
  absolutePath: string;
  sizeBytes: number;
}

const ALLOWED_EXTENSIONS = new Set([".md", ".txt", ".html", ".pdf", ".prd"]);

/** Read a PRD file from disk with path-traversal protection and extension validation. */
export async function readPrdFile(filePath: string): Promise<PrdFileResult> {
  // Security: centralized path traversal protection (Bug #004)
  const projectRoot = process.cwd();
  const absolutePath = assertPathInside(filePath, projectRoot);

  // Security: reject unexpected file extensions
  const ext = path.extname(absolutePath).toLowerCase();
  if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
    throw new InvalidArgumentError(`Unsupported file extension: ${ext}. Allowed: ${[...ALLOWED_EXTENSIONS].join(", ")}`);
  }

  if (!(await fileExists(absolutePath))) {
    throw new FileNotFoundError(absolutePath);
  }

  const content = await readFile(absolutePath, "utf-8");

  return {
    content,
    absolutePath,
    sizeBytes: Buffer.byteLength(content, "utf-8"),
  };
}
