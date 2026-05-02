/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import type { Command } from "commander";
import { makeV11WrapperCommand } from "./_v11-bridge.js";

/** harnessCommand — auto-generated description placeholder. */
export function harnessCommand(): Command {
  return makeV11WrapperCommand({
    name: "harness",
    description: "Browser CDP harness control (v11 surface)",
  });
}
