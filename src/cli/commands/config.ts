/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import type { Command } from "commander";
import { makeV11WrapperCommand } from "./_v11-bridge.js";

/** configCommand — auto-generated description placeholder. */
export function configCommand(): Command {
  return makeV11WrapperCommand({
    name: "config",
    description: "Sync IDE configs (.mcp.json, .vscode, .cursor, .claude)",
    args: ["<action>"],
  });
}
