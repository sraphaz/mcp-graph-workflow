/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import type { Command } from "commander";
import { makeV11WrapperCommand } from "./_v11-bridge.js";

/** statusCommand — auto-generated description placeholder. */
export function statusCommand(): Command {
  return makeV11WrapperCommand({
    name: "status",
    description: "One-screen project health summary (tasks + sprint + harness)",
  });
}
