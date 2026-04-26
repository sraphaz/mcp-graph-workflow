/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * `mcp-graph repl` — launch the v11 Ink REPL by spawning the v11 bundle
 * with no arguments. The bundle's main() detects empty argv and renders
 * the interactive REPL.
 */

import { Command } from "commander";
import { spawnSync } from "node:child_process";
import { resolveV11Bundle } from "./_v11-bridge.js";

export function replCommand(): Command {
  return new Command("repl")
    .description("Launch interactive REPL (Ink-based, type / for slash commands)")
    .action(() => {
      const bundle = resolveV11Bundle();
      if (!bundle) {
        process.stderr.write(
          "✗ v11 CLI bundle not found. Try: npm install -g @mcp-graph-workflow/cli\n",
        );
        process.exit(2);
      }
      const result = spawnSync(process.execPath, [bundle], {
        stdio: "inherit",
      });
      process.exit(result.status ?? 1);
    });
}
