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

if (isMcpClient) {
  // Delegate to MCP stdio server — the client expects JSON-RPC over stdin/stdout
  await import("../mcp/stdio.js");
} else {
  // Check for updates (non-blocking, background check)
  const updateNotifier = (await import("update-notifier")).default;
  updateNotifier({ pkg }).notify();

  // Interactive CLI with Commander.js
  const { Command } = await import("commander");
  const { serveCommand } = await import("./commands/serve.js");
  const { importCommand } = await import("./commands/import-cmd.js");
  const { statsCommand } = await import("./commands/stats.js");
  const { initCommand } = await import("./commands/init.js");
  const { indexCommand } = await import("./commands/index-cmd.js");
  const { doctorCommand } = await import("./commands/doctor.js");
  const { updateCommand } = await import("./commands/update.js");
  const { browserHarnessCommand } = await import("./commands/browser-harness.js");

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
  program.addCommand(updateCommand());
  program.addCommand(browserHarnessCommand());

  program.parse();
}
