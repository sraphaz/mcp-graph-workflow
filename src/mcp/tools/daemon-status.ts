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
