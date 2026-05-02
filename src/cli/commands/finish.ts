/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import type { Command } from "commander";
import { makeV11WrapperCommand } from "./_v11-bridge.js";

/** finishCommand — auto-generated description placeholder. */
export function finishCommand(): Command {
  return makeV11WrapperCommand({
    name: "finish",
    description: "Finish current (or named) task: status → done, run DoD (lifecycle)",
    aliases: ["done"],
    args: ["[id]"],
  });
}
