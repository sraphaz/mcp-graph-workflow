/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import type { Command } from "commander";
import { makeV11WrapperCommand } from "./_v11-bridge.js";

/** demoCommand — auto-generated description placeholder. */
export function demoCommand(): Command {
  return makeV11WrapperCommand({
    name: "demo",
    description: "Zero-config sandbox: ephemeral PRD + graph in ~/.mcp-graph/demos/",
  });
}
