/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import type { Command } from "commander";
import { makeV11WrapperCommand } from "./_v11-bridge.js";

export function loginCommand(): Command {
  return makeV11WrapperCommand({
    name: "login",
    description: "Authenticate with GitHub Copilot (device flow or import gh-copilot)",
  });
}
