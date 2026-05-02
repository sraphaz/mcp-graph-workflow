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
 * Harness Scan Cache — TTL + git hash invalidation cache for lifecycle wrapper.
 *
 * Avoids re-scanning on every MCP tool call by caching the last
 * HarnessScanResult with a 60-second TTL. Cache invalidates on:
 * - TTL expiry (>60s)
 * - rootDir change
 * - git HEAD hash change (detects new commits)
 */

import { execSync } from "child_process";
import { runHarnessScan, type HarnessScanResult } from "./harness-scan-runner.js";
import { McpGraphError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

const CACHE_TTL_MS = 60_000; // 60 seconds

interface CacheEntry {
  result: HarnessScanResult;
  cachedAt: number;
  rootDir: string;
  gitHash: string | null;
}

let cache: CacheEntry | null = null;

/**
 * Get current git HEAD hash. Returns null if not a git repo or git unavailable.
 */
function getCurrentGitHash(rootDir: string): string | null {
  try {
    return execSync("git rev-parse HEAD", {
      cwd: rootDir,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Run harness scan with TTL-based + git-hash caching.
 * Returns cached result if within TTL, same rootDir, and same git hash.
 * Returns null on any scan error (non-blocking, preserves no cache state on failure).
 */
export function runHarnessScanCached(
  rootDir: string,
  db?: import("better-sqlite3").Database,
): HarnessScanResult | null {
  if (!rootDir) {
    throw new McpGraphError("Harness scan requires a valid rootDir");
  }
  const now = Date.now();
  const currentHash = getCurrentGitHash(rootDir);

  // Cache hit: same dir + within TTL + same git hash
  if (
    cache &&
    cache.rootDir === rootDir &&
    (now - cache.cachedAt) < CACHE_TTL_MS &&
    cache.gitHash === currentHash
  ) {
    logger.debug("harness:cache:hit", { age: now - cache.cachedAt });
    return cache.result;
  }

  // Cache miss: run scan
  try {
    const resultValue = runHarnessScan(rootDir, db);
    cache = { result: resultValue, cachedAt: now, rootDir, gitHash: currentHash };
    logger.debug("harness:cache:miss", {
      score: resultValue.score,
      grade: resultValue.grade,
      reason: !cache ? "empty" : "expired_or_invalidated",
    });
    return resultValue;
  } catch (err) {
    logger.warn("harness:cache:scan_failed", { error: String(err) });
    return null;
  }
}

/**
 * Reset the cache. Useful for testing or after known code changes.
 */
export function resetHarnessCache(): void {
  cache = null;
}
