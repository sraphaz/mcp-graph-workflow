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
import { initWithHarnessBaseline } from "../../core/pipeline/init-harness.js";
import { createLogger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

const log = createLogger({ layer: "mcp", source: "init.ts" });

/** registerInit — auto-generated description placeholder. */
export function registerInit(server: McpServer, store: SqliteStore): void {
  server.tool(
    "init",
    "Initialize a new project graph",
    { projectName: z.string().optional().describe("Name for the project") },
    async ({ projectName }) => {
      log.debug("tool:init", { projectName });

      // Bug #021: sanitize projectName — reject path traversal and special chars
      if (projectName && (/[/\\]/.test(projectName) || projectName.includes("\0") || projectName.includes(".."))) {
        return mcpError("Invalid project name: must not contain path separators, '..' or null bytes");
      }

      const project = store.initProject(projectName || undefined);
      log.info("tool:init:ok", { projectId: project.id });

      const { harnessBaseline, harnessHint } = initWithHarnessBaseline(store);

      return mcpText({
        ok: true,
        project,
        ...(harnessBaseline ? { harnessBaseline } : {}),
        harnessHint,
      });
    },
  );
}
