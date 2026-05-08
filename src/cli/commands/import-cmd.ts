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
import { openStoreOrFail } from "../open-store.js";
import { readFileContent } from "../../core/parser/file-reader.js";
import { extractEntities } from "../../core/parser/extract.js";
import { convertToGraph } from "../../core/importer/prd-to-graph.js";
import { getErrorMessage } from "../../core/utils/errors.js";
import { createLogger } from "../../core/utils/logger.js";

const log = createLogger({ layer: "cli", source: "import-cmd.ts" });

function output(msg: string): void {
  process.stdout.write(msg + "\n");
}

/** importCommand — auto-generated description placeholder. */
export function importCommand(): Command {
  return new Command("import")
    .description("Import a PRD file into the graph")
    .argument("<file>", "Path to PRD file (.md, .txt, .pdf, .html)")
    .option("-d, --dir <dir>", "Project directory", process.cwd())
    .option("--force", "Re-import even if the source file was already imported (creates duplicate nodes)", false)
    .option("--allow-empty", "Exit 0 even when the file produces zero nodes (default: exit 1 with hint)", false)
    .action(async (file: string, opts: { dir: string; force: boolean; allowEmpty: boolean }) => {
      const filePath = path.resolve(file);
      const store = openStoreOrFail(opts.dir);

      if (!store.getProject()) {
        store.initProject(path.basename(opts.dir));
        log.info("Project initialized", { name: path.basename(opts.dir) });
      }

      // B14 (node_6b7d86d7238a): refuse to re-import the same source file by
      // default. Without this guard a CI loop or accidental double-invoke
      // doubled every node and edge in the graph.
      if (!opts.force && store.hasImport(filePath)) {
        log.error(`Source already imported: ${filePath}. Pass --force to re-import (will create duplicate nodes).`);
        store.close();
        process.exit(1);
      }

      try {
        const resultValue = await readFileContent(filePath);
        const entities = extractEntities(resultValue.text);
        const graph = convertToGraph(entities, filePath);

        store.bulkInsert(graph.nodes, graph.edges);
        store.recordImport(filePath, graph.nodes.length, graph.edges.length);
        store.createSnapshot();

        output(`Imported: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
        output(`Source: ${filePath}`);

        // B12+B13 (node_bc09db1f30f6): a non-empty file that yields 0 nodes is
        // almost always an accident — wrong file (binary), wrong format, or a
        // parser miss. Exit 1 with a hint unless the caller opted in via
        // --allow-empty. Empty files (size 0) still pass through silently.
        if (graph.nodes.length === 0 && resultValue.text.length > 0 && !opts.allowEmpty) {
          log.error(`No entities extracted from ${filePath} (text length ${resultValue.text.length}). Pass --allow-empty if this is intentional.`);
          store.close();
          process.exit(1);
        }
      } catch (err) {
        log.error(`Import failed: ${getErrorMessage(err)}`);
        // Bug #056: close store before exit to prevent connection leak
        store.close();
        process.exit(1);
      } finally {
        store.close();
      }
    });
}
