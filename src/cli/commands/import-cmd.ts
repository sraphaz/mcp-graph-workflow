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
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { readFileContent } from "../../core/parser/file-reader.js";
import { extractEntities } from "../../core/parser/extract.js";
import { convertToGraph } from "../../core/importer/prd-to-graph.js";
import { getErrorMessage } from "../../core/utils/errors.js";
import { logger } from "../../core/utils/logger.js";

function output(msg: string): void {
  process.stdout.write(msg + "\n");
}

/** importCommand — auto-generated description placeholder. */
export function importCommand(): Command {
  return new Command("import")
    .description("Import a PRD file into the graph")
    .argument("<file>", "Path to PRD file (.md, .txt, .pdf, .html)")
    .option("-d, --dir <dir>", "Project directory", process.cwd())
    .action(async (file: string, opts: { dir: string }) => {
      const filePath = path.resolve(file);
      const store = SqliteStore.open(opts.dir);

      if (!store.getProject()) {
        store.initProject(path.basename(opts.dir));
        logger.info("Project initialized", { name: path.basename(opts.dir) });
      }

      try {
        const resultValue = await readFileContent(filePath);
        const entities = extractEntities(resultValue.text);
        const graph = convertToGraph(entities, filePath);

        store.bulkInsert(graph.nodes, graph.edges);
        store.createSnapshot();

        output(`Imported: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
        output(`Source: ${filePath}`);
      } catch (err) {
        logger.error(`Import failed: ${getErrorMessage(err)}`);
        // Bug #056: close store before exit to prevent connection leak
        store.close();
        process.exit(1);
      } finally {
        store.close();
      }
    });
}
