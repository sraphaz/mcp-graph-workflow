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
 * Shared test store helper to reduce boilerplate.
 */
import { SqliteStore } from "../../core/store/sqlite-store.js";

export interface TestStoreContext {
  store: SqliteStore;
  cleanup: () => void;
}

export function createTestStore(projectName: string = "Test Project"): TestStoreContext {
  const store = SqliteStore.open(":memory:");
  store.initProject(projectName);
  return {
    store,
    cleanup: () => store.close(),
  };
}
