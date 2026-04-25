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
 * OpenTimestamps client — second leg of the three-layer provenance tier.
 *
 * Submits a canonical hash to an OTS-compatible endpoint, stores the
 * resulting receipt, and handles upgrade jobs that promote receipts from
 * `pending` (waiting for Bitcoin confirmation) to `confirmed` (with an
 * auditable blockTimestamp).
 *
 * When the OTS server is unreachable the hash is silently queued for retry
 * so no provenance record is lost. Callers may flush the queue later via
 * `flushRetryQueue()`.
 */

import type { GraphEventBus } from "../events/event-bus.js";
import { McpGraphError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export type OtsStatus = "pending" | "confirmed" | "retry_scheduled";

export interface OtsReceipt {
  hash: string;
  status: OtsStatus;
  /** Base64-encoded OTS calendar file bytes */
  receiptData: string;
  /** Unix timestamp (seconds) present once Bitcoin-confirmed */
  blockTimestamp?: number;
}

/** Minimal HTTP boundary — swap for a real fetch-based adapter in production */
export interface OtsHttpAdapter {
  submit(hash: string): Promise<OtsReceipt>;
  upgrade(hash: string, receiptData: string): Promise<OtsReceipt>;
}

export class OtsClient {
  private receipts = new Map<string, OtsReceipt>();
  private retryQueue = new Set<string>();

  constructor(
    private adapter: OtsHttpAdapter,
    private bus: GraphEventBus,
  ) {}

  /** Replace the HTTP adapter at runtime (e.g., swap offline stub for live adapter) */
  setAdapter(adapter: OtsHttpAdapter): void {
    this.adapter = adapter;
  }

  /**
   * Submit a hash to OTS.
   * - On success: stores receipt with status `pending` and emits `ots:submitted`.
   * - On network error: stores receipt with status `retry_scheduled`, adds to
   *   retry queue, and emits `ots:retry_scheduled`. Never throws.
   */
  async submitHash(hash: string): Promise<OtsReceipt> {
    try {
      const receipt = await this.adapter.submit(hash);
      this.receipts.set(hash, receipt);
      this.bus.emit({
        type: "ots:submitted",
        timestamp: new Date().toISOString(),
        payload: { hash, status: receipt.status },
      });
      logger.info("OTS hash submitted", { hash, status: receipt.status });
      return receipt;
    } catch (err) {
      const receipt: OtsReceipt = {
        hash,
        status: "retry_scheduled",
        receiptData: "",
      };
      this.receipts.set(hash, receipt);
      this.retryQueue.add(hash);
      this.bus.emit({
        type: "ots:retry_scheduled",
        timestamp: new Date().toISOString(),
        payload: { hash, reason: (err as Error).message },
      });
      logger.warn("OTS offline — retry scheduled", { hash });
      return receipt;
    }
  }

  /**
   * Attempt to upgrade a pending receipt to `confirmed` by checking the OTS calendar.
   * Throws `McpGraphError` if the hash was never submitted.
   */
  async upgradeReceipt(hash: string): Promise<OtsReceipt> {
    const existing = this.receipts.get(hash);
    if (!existing) {
      throw new McpGraphError(`No OTS receipt found for hash: ${hash}`);
    }
    const confirmed = await this.adapter.upgrade(hash, existing.receiptData);
    this.receipts.set(hash, confirmed);
    this.bus.emit({
      type: "ots:confirmed",
      timestamp: new Date().toISOString(),
      payload: { hash, blockTimestamp: confirmed.blockTimestamp },
    });
    logger.info("OTS receipt confirmed", { hash, blockTimestamp: confirmed.blockTimestamp });
    return confirmed;
  }

  /**
   * Flush the retry queue by resubmitting all queued hashes with the current adapter.
   * Returns the count of successfully flushed entries.
   */
  async flushRetryQueue(): Promise<number> {
    const queued = [...this.retryQueue];
    let flushed = 0;
    for (const hash of queued) {
      try {
        const receipt = await this.adapter.submit(hash);
        this.receipts.set(hash, receipt);
        this.retryQueue.delete(hash);
        this.bus.emit({
          type: "ots:submitted",
          timestamp: new Date().toISOString(),
          payload: { hash, status: receipt.status, flushedFromQueue: true },
        });
        flushed++;
      } catch {
        // Still offline — leave in queue
      }
    }
    return flushed;
  }

  /** Retrieve the stored receipt for a hash, or undefined if never submitted */
  getReceipt(hash: string): OtsReceipt | undefined {
    return this.receipts.get(hash);
  }

  /** Number of hashes currently waiting for retry */
  retryQueueSize(): number {
    return this.retryQueue.size;
  }
}
