/**
 * Harness Scan Cache — TTL-based caching for lifecycle wrapper.
 *
 * Avoids re-scanning on every MCP tool call by caching the last
 * HarnessScanResult with a 60-second TTL. Cache invalidates on
 * TTL expiry or manual reset.
 */

import { runHarnessScan, type HarnessScanResult } from "./harness-scan-runner.js";
import { logger } from "../utils/logger.js";

const CACHE_TTL_MS = 60_000; // 60 seconds

interface CacheEntry {
  result: HarnessScanResult;
  cachedAt: number;
  rootDir: string;
}

let cache: CacheEntry | null = null;

/**
 * Run harness scan with TTL-based caching.
 * Returns cached result if within TTL and same rootDir.
 * Returns null on any scan error (non-blocking).
 */
export function runHarnessScanCached(
  rootDir: string,
  db?: import("better-sqlite3").Database,
): HarnessScanResult | null {
  const now = Date.now();

  // Cache hit: same dir + within TTL
  if (cache && cache.rootDir === rootDir && (now - cache.cachedAt) < CACHE_TTL_MS) {
    logger.debug("harness:cache:hit", { age: now - cache.cachedAt });
    return cache.result;
  }

  // Cache miss: run scan
  try {
    const result = runHarnessScan(rootDir, db);
    cache = { result, cachedAt: now, rootDir };
    logger.debug("harness:cache:miss", { score: result.score, grade: result.grade });
    return result;
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
