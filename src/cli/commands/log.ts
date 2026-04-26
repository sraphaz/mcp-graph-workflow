/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import type { Command } from "commander";
import { makeV11WrapperCommand } from "./_v11-bridge.js";

export function logCommand(): Command {
  return makeV11WrapperCommand({
    name: "log",
    description: "Query structured logs (~/.mcp-graph/logs/*.jsonl)",
  });
}
