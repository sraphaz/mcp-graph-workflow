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
import path from "node:path";
import { runInit } from "../../mcp/init-project.js";
import { getErrorMessage } from "../../core/utils/errors.js";
import { logger } from "../../core/utils/logger.js";

function output(msg: string): void {
  process.stdout.write(msg + "\n");
}

/** initCommand — auto-generated description placeholder. */
export function initCommand(): Command {
  return new Command("init")
    .description("Initialize mcp-graph in the current project")
    .option("-d, --dir <dir>", "Project directory", process.cwd())
    .option("-n, --name <name>", "Project name")
    .action(async (opts: { dir: string; name?: string }) => {
      const dir = path.resolve(opts.dir);

      try {
        await runInit(dir);

        output(`\nDashboard: mcp-graph serve --port 3000`);
        output(`Import PRD: mcp-graph import <file.md>`);
        output(`Stats: mcp-graph stats`);
      } catch (error) {
        logger.error("Init failed", { error: getErrorMessage(error) });
        process.exitCode = 1;
      }
    });
}
