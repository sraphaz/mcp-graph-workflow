/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import type { Command } from "commander";
import { makeV11WrapperCommand } from "./_v11-bridge.js";

export function addCommand(): Command {
  return makeV11WrapperCommand({
    name: "add",
    description: 'Create a graph node (task/epic/decision/risk). Usage: add <type> --title "..."',
    args: ["<type>"],
  });
}
