#!/usr/bin/env node
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

export {};

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("../../package.json") as { name: string; version: string };

// Smart entry point: detect if called by an MCP client (piped stdin, no args)
// or as an interactive CLI (TTY stdin or explicit subcommand/flags).
const isMcpClient = !process.stdin.isTTY && process.argv.length <= 2;

// Sprint 9 #9.5 — non-blocking deprecation banner. Only fires when the
// user is actually looking at the terminal (stderr TTY) and we're not
// being driven as an MCP transport. The banner never blocks; the legacy
// CLI continues to work after.
if (!isMcpClient) {
  const { printDeprecationBanner } = await import("./deprecation.js");
  printDeprecationBanner({
    newCommand: "npm i -g @mcp-graph-workflow/cli  →  mg <command>",
    migrationDoc: "docs/_internal/migration/v10-to-v11-cli.md",
  });
}

if (isMcpClient) {
  // Delegate to MCP stdio server — the client expects JSON-RPC over stdin/stdout
  await import("../mcp/stdio.js");
} else {
  // Check for updates (non-blocking, background check). Skipped when the
  // user opts out via MCP_GRAPH_NO_UPDATE_CHECK=1 or under CI — see
  // ADR-0057 (local-first invariant).
  const { shouldCheckForUpdates } = await import("../core/utils/update-check.js");
  if (shouldCheckForUpdates(process.env)) {
    const updateNotifier = (await import("update-notifier")).default;
    updateNotifier({ pkg }).notify();
  }

  // Interactive CLI with Commander.js
  const { Command } = await import("commander");
  const { serveCommand } = await import("./commands/serve.js");
  const { importCommand } = await import("./commands/import-cmd.js");
  const { statsCommand } = await import("./commands/stats.js");
  const { initCommand } = await import("./commands/init.js");
  const { indexCommand } = await import("./commands/index-cmd.js");
  const { doctorCommand } = await import("./commands/doctor.js");
  const { installNeuralCommand } = await import("./commands/install-neural.js");
  const { reviewDepthCommand } = await import("./commands/review-depth.js");
  const { updateCommand } = await import("./commands/update.js");
  const { browserHarnessCommand } = await import("./commands/browser-harness.js");
  // v11 lifecycle + ops wrappers (delegate to @mcp-graph-workflow/cli bundle)
  const { nextCommand } = await import("./commands/next.js");
  const { startCommand } = await import("./commands/start.js");
  const { finishCommand } = await import("./commands/finish.js");
  const { listCommand } = await import("./commands/list.js");
  const { statusCommand } = await import("./commands/status.js");
  const { addCommand } = await import("./commands/add.js");
  const { hooksCommand } = await import("./commands/hooks.js");
  const { uiCommand } = await import("./commands/ui.js");
  const { demoCommand } = await import("./commands/demo.js");
  const { loginCommand } = await import("./commands/login.js");
  const { setPhaseCommand } = await import("./commands/set-phase.js");
  const { harnessCommand } = await import("./commands/harness.js");
  const { langCommand } = await import("./commands/lang.js");
  const { configCommand } = await import("./commands/config.js");
  const { logCommand } = await import("./commands/log.js");
  const { replCommand } = await import("./commands/repl.js");

  const program = new Command();

  program
    .name("mcp-graph")
    .description(
      "Local-first PRD to task graph — transforms text into executable structure",
    )
    .version(pkg.version);

  program.addCommand(serveCommand());
  program.addCommand(importCommand());
  program.addCommand(statsCommand());
  program.addCommand(initCommand());
  program.addCommand(indexCommand());
  program.addCommand(doctorCommand());
  program.addCommand(installNeuralCommand());
  program.addCommand(reviewDepthCommand());
  program.addCommand(updateCommand());
  program.addCommand(browserHarnessCommand());
  // v11 lifecycle + ops (delegated)
  program.addCommand(nextCommand());
  program.addCommand(startCommand());
  program.addCommand(finishCommand());
  program.addCommand(listCommand());
  program.addCommand(statusCommand());
  program.addCommand(addCommand());
  program.addCommand(hooksCommand());
  program.addCommand(uiCommand());
  program.addCommand(demoCommand());
  program.addCommand(loginCommand());
  program.addCommand(setPhaseCommand());
  program.addCommand(harnessCommand());
  program.addCommand(langCommand());
  program.addCommand(configCommand());
  program.addCommand(logCommand());
  program.addCommand(replCommand());

  program.parse();
}
