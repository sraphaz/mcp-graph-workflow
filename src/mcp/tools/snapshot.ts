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

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { createLogger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

const log = createLogger({ layer: "mcp", source: "snapshot.ts" });

/** registerSnapshot — auto-generated description placeholder. */
export function registerSnapshot(server: McpServer, store: SqliteStore): void {
  server.tool(
    "snapshot",
    "Manage graph snapshots: create, list, or restore",
    {
      action: z.enum(["create", "list", "restore"]).describe("Action to perform"),
      snapshotId: z.number().int().min(1).optional().describe("Snapshot ID (positive integer, required for restore)"),
    },
    async ({ action, snapshotId }) => {
      log.debug("tool:snapshot", { action });
      if (action === "create") {
        const id = store.createSnapshot();
        log.info("tool:snapshot:ok", { action: "create", snapshotId: id });
        return mcpText({ ok: true, snapshotId: id });
      }

      if (action === "list") {
        const snapshots = store.listSnapshots();
        log.info("tool:snapshot:ok", { action: "list", total: snapshots.length });
        return mcpText({ total: snapshots.length, snapshots });
      }

      // action === "restore"
      if (snapshotId === undefined) {
        return mcpError("snapshotId is required for restore action");
      }

      store.restoreSnapshot(snapshotId);
      log.info("tool:snapshot:ok", { action: "restore", restoredFrom: snapshotId });
      return mcpText({ ok: true, restoredFrom: snapshotId });
    },
  );
}
