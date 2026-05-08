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

import { Command } from "commander";
import { createLogger } from "../../core/utils/logger.js";

const log = createLogger({ layer: "cli", source: "serve.ts" });

/** serveCommand — auto-generated description placeholder. */
export function serveCommand(): Command {
  return new Command("serve")
    .description("Start the mcp-graph dashboard + API server")
    .option("-p, --port <port>", "Port to listen on", "3000")
    .action(async (opts: { port: string }) => {
      const port = parseInt(opts.port, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        log.error("Invalid port number");
        process.exit(1);
      }

      // CLI flag overrides config — set env var so server picks it up
      process.env.MCP_PORT = String(port);

      // Dynamic import — server module starts Express on import
      await import("../../mcp/server.js");
    });
}
