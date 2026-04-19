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
 * Stack Detector — auto-detects project stack by reading
 * package.json, requirements.txt, go.mod, etc.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { logger } from "../utils/logger.js";

export interface DetectedStack {
  /** Detected language/runtime */
  runtime: string;
  /** Detected libraries with their versions */
  libraries: Array<{ name: string; version: string }>;
  /** Source file that was parsed */
  sourceFile: string;
}

/**
 * Detect project stack from manifest files.
 * Checks package.json, requirements.txt, go.mod in order.
 */
export async function detectStack(basePath: string): Promise<DetectedStack | null> {
  // Try package.json first (Node.js)
  const packageJsonResult = await tryPackageJson(basePath);
  if (packageJsonResult) return packageJsonResult;

  // Try requirements.txt (Python)
  const requirementsResult = await tryRequirementsTxt(basePath);
  if (requirementsResult) return requirementsResult;

  // Try go.mod (Go)
  const goModResult = await tryGoMod(basePath);
  if (goModResult) return goModResult;

  logger.info("No stack manifest detected", { basePath });
  return null;
}

async function tryPackageJson(basePath: string): Promise<DetectedStack | null> {
  try {
    const filePath = path.join(basePath, "package.json");
    const content = await readFile(filePath, "utf-8");
    const pkg = JSON.parse(content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const deps = pkg.dependencies ?? {};
    const devDeps = pkg.devDependencies ?? {};
    const allDeps = { ...deps, ...devDeps };

    const libraries = Object.entries(allDeps).map(([name, version]) => ({
      name,
      version: String(version).replace(/^\^|~/, ""),
    }));

    logger.info("Stack detected: Node.js", { libraries: libraries.length });

    return {
      runtime: "node",
      libraries,
      sourceFile: "package.json",
    };
  } catch (err) {
    logger.debug("stackDetector:packageJsonReadFailure", { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

async function tryRequirementsTxt(basePath: string): Promise<DetectedStack | null> {
  try {
    const filePath = path.join(basePath, "requirements.txt");
    const content = await readFile(filePath, "utf-8");

    const libraries = content
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("#"))
      .map((line) => {
        const match = line.match(/^([a-zA-Z0-9_-]+)\s*(?:==|>=|<=|~=|!=)?\s*(.*)$/);
        return match
          ? { name: match[1], version: match[2] || "*" }
          : { name: line.trim(), version: "*" };
      });

    logger.info("Stack detected: Python", { libraries: libraries.length });

    return {
      runtime: "python",
      libraries,
      sourceFile: "requirements.txt",
    };
  } catch (err) {
    logger.debug("stackDetector:requirementsTxtReadFailure", { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

async function tryGoMod(basePath: string): Promise<DetectedStack | null> {
  try {
    const filePath = path.join(basePath, "go.mod");
    const content = await readFile(filePath, "utf-8");

    const libraries: Array<{ name: string; version: string }> = [];
    const requireBlock = content.match(/require\s*\(([\s\S]*?)\)/);

    if (requireBlock) {
      const lines = requireBlock[1].split("\n");
      for (const line of lines) {
        const match = line.trim().match(/^(\S+)\s+(\S+)/);
        if (match) {
          libraries.push({ name: match[1], version: match[2] });
        }
      }
    }

    logger.info("Stack detected: Go", { libraries: libraries.length });

    return {
      runtime: "go",
      libraries,
      sourceFile: "go.mod",
    };
  } catch (err) {
    logger.debug("stackDetector:goModReadFailure", { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}
