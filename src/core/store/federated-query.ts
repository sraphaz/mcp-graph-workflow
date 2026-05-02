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
 * Federated Query Facade — unified query surface over all substrate stores.
 *
 * Routes queries to the correct store adapters, attaches per-item provenance
 * (source_store), and handles offline stores gracefully via documented warnings.
 *
 * Contract:
 *   - Every result item carries `source_store` identifying its origin.
 *   - Offline stores produce a warning entry; they never propagate throws.
 *   - Only requested stores are queried (no implicit fan-out).
 */

import { logger } from "../utils/logger.js";

export type StoreId = "graph" | "memory" | "provenance" | "knowledge" | "rag";

export interface StoreAdapter {
  readonly storeId: StoreId;
  query(q: string): Promise<unknown[]>;
}

export interface FederatedResultItem {
  readonly data: unknown;
  readonly source_store: StoreId;
}

export interface FederatedQueryResult {
  readonly items: FederatedResultItem[];
  readonly warnings: string[];
}

export interface FederatedQueryInput {
  readonly query: string;
  readonly stores?: StoreId[];
}

/**
 * Execute a federated query across the requested stores.
 * Results are merged with per-item source_store provenance.
 * Offline stores contribute a warning instead of throwing.
 */
export async function federatedQuery(
  input: FederatedQueryInput,
  adapters: StoreAdapter[],
): Promise<FederatedQueryResult> {
  const requested = new Set(input.stores ?? adapters.map(a => a.storeId));
  const active = adapters.filter(a => requested.has(a.storeId));

  const items: FederatedResultItem[] = [];
  const warnings: string[] = [];

  await Promise.all(
    active.map(async (adapter) => {
      try {
        const results = await adapter.query(input.query);
        for (const dataValue of results) {
          items.push({ data: dataValue, source_store: adapter.storeId });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const warning = `Store "${adapter.storeId}" unavailable: ${msg}`;
        warnings.push(warning);
        logger.warn("federated-query:store_offline", {
          storeId: adapter.storeId,
          error: msg,
        });
      }
    }),
  );

  return { items, warnings };
}
