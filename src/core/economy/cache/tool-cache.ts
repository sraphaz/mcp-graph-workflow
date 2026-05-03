/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 */

/**
 * Tool-level memoization for read-only MCP tool calls.
 *
 * Keyed by hash(toolName + canonical(args) + schemaVersion) — the same call
 * with the same arguments returns the cached result inside the TTL window.
 * Allowlist enforced via the existing CACHEABLE_TOOLS set; mutating tools
 * never enter the cache.
 *
 * Invalidation: subscribes to GraphEventBus mutation events and clears the
 * entire cache on any write. Wholesale-clear is intentional — tracking
 * per-key dependencies is more code and less safe than a 30s TTL plus
 * blanket-flush on writes.
 */

import { LRUCache } from "lru-cache";
import { buildCacheKey } from "./cache-key.js";
import { CACHEABLE_TOOLS, type CacheableToolName } from "../_cacheable-tools.js";
import type { GraphEventBus } from "../../events/event-bus.js";
import type { GraphEventType } from "../../events/event-types.js";
import { logger } from "../../utils/logger.js";

/** Bump when the cached result shape changes incompatibly. */
export const TOOL_CACHE_SCHEMA_VERSION = 1;

const DEFAULT_TTL_MS = 30_000;
const DEFAULT_MAX_ENTRIES = 500;

/** Mutation events that should invalidate the entire cache. */
const INVALIDATING_EVENTS: readonly GraphEventType[] = [
  "node:created",
  "node:updated",
  "node:deleted",
  "edge:created",
  "edge:deleted",
  "bulk:updated",
  "import:completed",
  "knowledge:indexed",
  "knowledge:deleted",
  "phase:transitioned",
];

/**
 * Minimal shape of an MCP tool result. Mirrors the public ToolResult contract
 * (see .claude/rules/mcp.md). We keep it loose because handlers may attach
 * structuredContent and extra fields we should preserve verbatim.
 */
export interface CachedToolResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
  structuredContent?: unknown;
}

export interface ToolCacheStats {
  size: number;
  hits: number;
  misses: number;
  invalidations: number;
}

interface ToolCacheOptions {
  ttlMs?: number;
  maxEntries?: number;
}

interface CacheEntry {
  value: CachedToolResult;
  ts: number;
}

export class ToolCache {
  private readonly lru: LRUCache<string, CacheEntry>;
  private readonly ttlMs: number;
  private hits = 0;
  private misses = 0;
  private invalidations = 0;
  private busAttached = false;

  constructor(options: ToolCacheOptions = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.lru = new LRUCache<string, CacheEntry>({ max: options.maxEntries ?? DEFAULT_MAX_ENTRIES });
  }

  /** True iff the tool is in the read-only allowlist. */
  isCacheable(toolName: string): toolName is CacheableToolName {
    return CACHEABLE_TOOLS.has(toolName as CacheableToolName);
  }

  /**
   * Look up a cached result. Returns undefined for misses, expired entries,
   * or non-cacheable tool names.
   */
  get(toolName: string, args: unknown): CachedToolResult | undefined {
    if (!this.isCacheable(toolName)) return undefined;
    const key = this.keyFor(toolName, args);
    const entry = this.lru.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (Date.now() - entry.ts > this.ttlMs) {
      this.lru.delete(key);
      this.misses++;
      return undefined;
    }
    this.hits++;
    return entry.value;
  }

  /**
   * Store a successful result. Errors are never cached — masking a transient
   * failure for 30s is worse than re-running the handler.
   */
  set(toolName: string, args: unknown, value: CachedToolResult): void {
    if (!this.isCacheable(toolName)) return;
    if (value.isError) return;
    const key = this.keyFor(toolName, args);
    this.lru.set(key, { value, ts: Date.now() });
  }

  /** Drop every entry. Called on graph/knowledge mutations. */
  invalidateAll(reason: string): void {
    if (this.lru.size === 0) return;
    this.invalidations++;
    logger.debug("tool-cache:invalidate", { reason, size: this.lru.size });
    this.lru.clear();
  }

  /**
   * Subscribe to mutation events on the given bus. Idempotent — subsequent
   * calls on the same bus are no-ops, since the wrapper is invoked once
   * per server boot but defensive code is cheap.
   */
  attachEventBus(bus: GraphEventBus): void {
    if (this.busAttached) return;
    this.busAttached = true;
    for (const ev of INVALIDATING_EVENTS) {
      bus.on(ev, (e) => this.invalidateAll(e.type));
    }
  }

  getStats(): ToolCacheStats {
    return {
      size: this.lru.size,
      hits: this.hits,
      misses: this.misses,
      invalidations: this.invalidations,
    };
  }

  /** Test seam: discard all entries and stats counters. */
  reset(): void {
    this.lru.clear();
    this.hits = 0;
    this.misses = 0;
    this.invalidations = 0;
  }

  private keyFor(toolName: string, args: unknown): string {
    return buildCacheKey({ toolName, args, schemaVersion: TOOL_CACHE_SCHEMA_VERSION });
  }
}

/** Process-wide singleton — one cache per daemon. */
export const toolCache = new ToolCache();
