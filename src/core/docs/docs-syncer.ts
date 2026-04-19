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

import type { DocsCacheStore, CachedDoc } from "./docs-cache-store.js";
import { logger } from "../utils/logger.js";

export interface Context7Fetcher {
  resolveLibraryId(name: string): Promise<string>;
  queryDocs(libId: string): Promise<string>;
}

export class DocsSyncer {
  private cacheStore: DocsCacheStore;
  private fetcher: Context7Fetcher;

  constructor(cacheStore: DocsCacheStore, fetcher: Context7Fetcher) {
    this.cacheStore = cacheStore;
    this.fetcher = fetcher;
  }

  async syncLib(libName: string): Promise<CachedDoc> {
    logger.info(`Syncing docs for: ${libName}`);

    const libId = await this.fetcher.resolveLibraryId(libName);
    const content = await this.fetcher.queryDocs(libId);

    return this.cacheStore.upsertDoc({
      libId,
      libName,
      content,
    });
  }

  async syncAll(): Promise<CachedDoc[]> {
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const staleLibs = this.cacheStore.getStaleLibs(ONE_DAY_MS);

    logger.info(`Syncing ${staleLibs.length} stale libs`);

    const results: CachedDoc[] = [];

    for (const lib of staleLibs) {
      try {
        const doc = await this.syncLib(lib.libName);
        results.push(doc);
      } catch (err) {
        logger.error(`Failed to sync ${lib.libName}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return results;
  }
}
