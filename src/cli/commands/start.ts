/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import type { Command } from "commander";
import { makeV11WrapperCommand } from "./_v11-bridge.js";

export function startCommand(): Command {
  return makeV11WrapperCommand({
    name: "start",
    description: "Start a task: status → in_progress, render TDD checklist (lifecycle)",
    args: ["[id]"],
  });
}
