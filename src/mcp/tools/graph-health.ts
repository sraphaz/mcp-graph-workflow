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
 * MCP tool: graph_health — unified graph health scan and healing.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { scanGraphHealth } from "../../core/graph/graph-health-scanner.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

export function registerGraphHealth(server: McpServer, store: SqliteStore): void {
  server.tool(
    "graph_health",
    "Unified graph health scan. Combines cycle detection, orphan detection, stuck task analysis, done integrity, and status flow validation into a single diagnostic report.",
    {
      action: z
        .enum(["scan"])
        .default("scan")
        .describe("Action: scan (full diagnostic)"),
    },
    async () => {
      logger.debug("tool:graph_health");

      const doc = store.toGraphDocument();
      const report = scanGraphHealth(doc);

      logger.info("tool:graph_health:ok", {
        issues: report.summary.total,
        critical: report.summary.critical,
        ms: report.scanDurationMs,
      });

      return mcpText({
        ok: true,
        ...report,
      });
    },
  );
}
