/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import type { Command } from "commander";
import { makeV11WrapperCommand } from "./_v11-bridge.js";

export function uiCommand(): Command {
  return makeV11WrapperCommand({
    name: "ui",
    description: "Launch the dashboard (Express on :3000 by default)",
    aliases: ["dashboard"],
  });
}
