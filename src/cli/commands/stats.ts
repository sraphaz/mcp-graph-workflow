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
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { getErrorMessage } from "../../core/utils/errors.js";
import { logger } from "../../core/utils/logger.js";

function output(msg: string): void {
  process.stdout.write(msg + "\n");
}

/** statsCommand — auto-generated description placeholder. */
export function statsCommand(): Command {
  return new Command("stats")
    .description("Show graph statistics")
    .option("-d, --dir <dir>", "Project directory", process.cwd())
    .option("--json", "Output as JSON")
    .action((opts: { dir: string; json: boolean }) => {
      const store = SqliteStore.open(opts.dir);

      try {
        const stats = store.getStats();
        const project = store.getProject();

        if (opts.json) {
          output(JSON.stringify({ project: project?.name, ...stats }, null, 2));
        } else {
          output(`Project: ${project?.name ?? "(not initialized)"}`);
          output(`Total nodes: ${stats.totalNodes}`);
          output(`By type:`);
          for (const [type, count] of Object.entries(stats.byType ?? {})) {
            output(`  ${type}: ${count}`);
          }
          output(`By status:`);
          for (const [status, count] of Object.entries(stats.byStatus ?? {})) {
            output(`  ${status}: ${count}`);
          }
          output(`Total edges: ${stats.totalEdges}`);
        }
      } catch (err) {
        logger.error(`Stats failed: ${getErrorMessage(err)}`);
        process.exit(1);
      } finally {
        store.close();
      }
    });
}
