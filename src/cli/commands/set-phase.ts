/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import type { Command } from "commander";
import { makeV11WrapperCommand } from "./_v11-bridge.js";

/** setPhaseCommand — auto-generated description placeholder. */
export function setPhaseCommand(): Command {
  return makeV11WrapperCommand({
    name: "set-phase",
    description: "Override lifecycle phase + enforcement modes",
    args: ["<phase>"],
  });
}
