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

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDaemonStatus } from "../daemon/daemon-registry.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

/**
 * `daemon_status` — inspect the live daemon runtime (mode, connected clients,
 * uptime, socket path, idle-shutdown config). Returns `{ mode: "inactive" }`
 * when mcp-graph is running as a traditional stdio server instead of in
 * daemon mode — useful for agent hosts that want to detect at runtime whether
 * they are already sharing a daemon.
 */
export function registerDaemonStatus(server: McpServer): void {
  server.tool(
    "daemon_status",
    "Inspect daemon lifecycle: mode (daemon|inactive), connected clients, uptime, socket path, idle-shutdown config.",
    {},
    async () => {
      const status = getDaemonStatus();
      logger.debug("tool:daemon_status", { mode: status.mode, clients: status.clientCount });
      return mcpText(status);
    },
  );
}
