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
 * Batch SIF Importer — imports multiple SIF files from a directory with concurrency control.
 */

import { readdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { parseSifFile } from "./sif-parser.js";
import { logger } from "../utils/logger.js";
import type { SiebelSifParseResult } from "../../schemas/siebel.schema.js";

export interface BatchImportOptions {
  concurrency?: number;
}

export interface BatchImportError {
  file: string;
  error: string;
}

export interface BatchImportResult {
  totalFiles: number;
  successCount: number;
  errorCount: number;
  totalObjects: number;
  totalDependencies: number;
  objectsByType: Record<string, number>;
  errors: BatchImportError[];
  results: SiebelSifParseResult[];
}

/**
 * Import all .sif files from a directory with concurrency control.
 * Non-SIF files are skipped. Errors are collected per-file without failing the batch.
 */
export async function batchImportSifs(
  dirPath: string,
  options?: BatchImportOptions,
): Promise<BatchImportResult> {
  const concurrency = options?.concurrency ?? 5;

  const entries = await readdir(dirPath, { withFileTypes: true });
  const sifFiles = entries
    .filter((e) => e.isFile() && extname(e.name).toLowerCase() === ".sif")
    .map((e) => e.name);

  const results: SiebelSifParseResult[] = [];
  const errors: BatchImportError[] = [];
  const objectsByType: Record<string, number> = {};
  let totalObjects = 0;
  let totalDependencies = 0;

  // Process in batches respecting concurrency limit
  for (let i = 0; i < sifFiles.length; i += concurrency) {
    const batch = sifFiles.slice(i, i + concurrency);
    const batchPromises = batch.map(async (fileName) => {
      const filePath = join(dirPath, fileName);
      try {
        const parseResult = await parseSifFile(filePath);
        return { fileName, parseResult, error: null };
      } catch (err) {
        return { fileName, parseResult: null, error: err instanceof Error ? err.message : String(err) };
      }
    });

    const batchResults = await Promise.all(batchPromises);

    for (const itemValue of batchResults) {
      if (itemValue.parseResult) {
        results.push(itemValue.parseResult);
        totalObjects += itemValue.parseResult.objects.length;
        totalDependencies += itemValue.parseResult.dependencies.length;

        for (const objValue of itemValue.parseResult.objects) {
          objectsByType[objValue.type] = (objectsByType[objValue.type] ?? 0) + 1;
        }
      } else {
        errors.push({ file: itemValue.fileName, error: itemValue.error ?? "Unknown error" });
      }
    }
  }

  logger.info("Batch SIF import complete", {
    totalFiles: String(sifFiles.length),
    success: String(results.length),
    errors: String(errors.length),
    totalObjects: String(totalObjects),
  });

  return {
    totalFiles: sifFiles.length,
    successCount: results.length,
    errorCount: errors.length,
    totalObjects,
    totalDependencies,
    objectsByType,
    errors,
    results,
  };
}
