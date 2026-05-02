/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import type { Command } from "commander";
import { makeV11WrapperCommand } from "./_v11-bridge.js";

/** hooksCommand — auto-generated description placeholder. */
export function hooksCommand(): Command {
  return makeV11WrapperCommand({
    name: "hooks",
    description: "Manage Claude Code hooks (install / uninstall / status)",
    args: ["<action>"],
  });
}
