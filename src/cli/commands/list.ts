/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import type { Command } from "commander";
import { makeV11WrapperCommand } from "./_v11-bridge.js";

/** listCommand — auto-generated description placeholder. */
export function listCommand(): Command {
  return makeV11WrapperCommand({
    name: "list",
    description: "Query tasks (filters: --status, --type, --search, --all, --limit)",
    aliases: ["ls"],
  });
}
