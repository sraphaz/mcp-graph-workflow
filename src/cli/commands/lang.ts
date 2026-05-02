/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import type { Command } from "commander";
import { makeV11WrapperCommand } from "./_v11-bridge.js";

/** langCommand — auto-generated description placeholder. */
export function langCommand(): Command {
  return makeV11WrapperCommand({
    name: "lang",
    description: "Switch CLI language (en / pt-BR)",
  });
}
