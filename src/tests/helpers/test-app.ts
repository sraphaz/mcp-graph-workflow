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

import express from "express";
import type { Express } from "express";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { createApiRouter } from "../../api/router.js";

export interface TestContext {
  app: Express;
  store: SqliteStore;
}

export interface CreateTestAppOptions {
  /** Override basePath for routes that depend on it (code-graph reindex, lsp, etc.). Defaults to process.cwd(). */
  basePath?: string;
}

export function createTestApp(options: CreateTestAppOptions = {}): TestContext {
  const store = SqliteStore.open(":memory:");
  store.initProject("Test Project");

  const app = express();
  app.use(
    "/api/v1",
    createApiRouter(
      options.basePath !== undefined ? { store, basePath: options.basePath } : store,
    ),
  );

  return { app, store };
}
