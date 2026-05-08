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

/**
 * MCP dependencies installer.
 * Detects ecosystem tools (Context7, Playwright).
 * Never throws — returns InstallResult[] with status for each dependency.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createLogger } from "../utils/logger.js";
import { whichCommand } from "../utils/platform.js";

const log = createLogger({ layer: "core", source: "mcp-deps-installer.ts" });

const execAsync = promisify(execFile);

export type InstallStatus = "installed" | "already_available" | "skipped" | "failed";

export interface InstallResult {
  name: string;
  status: InstallStatus;
  message: string;
}

/**
 * Check if a command-line tool is available in PATH.
 */
export async function isCommandAvailable(command: string): Promise<boolean> {
  try {
    await execAsync(whichCommand(), [command]);
    return true;
  } catch {
    return false;
  }
}

async function checkContext7(): Promise<InstallResult> {
  const name = "context7";

  const npxAvailable = await isCommandAvailable("npx");
  if (npxAvailable) {
    log.info("Context7 available via npx", { name });
    return { name, status: "already_available", message: "npx available — context7 runs via npx -y @upstash/context7-mcp" };
  }

  return { name, status: "skipped", message: "npx not available" };
}

async function checkPlaywright(): Promise<InstallResult> {
  const name = "playwright";

  const npxAvailable = await isCommandAvailable("npx");
  if (npxAvailable) {
    log.info("Playwright MCP available via npx", { name });
    return { name, status: "already_available", message: "npx available — playwright runs via npx @playwright/mcp@latest" };
  }

  return { name, status: "skipped", message: "npx not available" };
}

/**
 * Install/verify all MCP ecosystem dependencies.
 * Never throws — returns status for each dependency.
 */
export async function installAllMcpDeps(_basePath: string): Promise<InstallResult[]> {
  log.info("Checking MCP ecosystem dependencies");

  const results = await Promise.all([
    checkContext7(),
    checkPlaywright(),
  ]);

  const summary = results.map((r) => `${r.name}: ${r.status}`).join(", ");
  log.info("MCP dependencies check complete", { summary });

  return results;
}
