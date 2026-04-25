/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { runBridge } from "../core/bridge/spawn.js";
import type {
  CommandHandlerArgs,
  CommandHandlerResult,
} from "./registry.js";

/**
 * `/login` · `mg login` — thin wrapper over `mcp-graph-bridge login`.
 *
 * The device-flow CLI is fully implemented in `tools/copilot-bridge-cli/`.
 * We delegate end-to-end so device-code prompts print directly to the user's
 * terminal and we never have to maintain two auth implementations.
 *
 * Flags:
 *   --fresh   skip `gh copilot` token import; always run device flow
 *   --logout  zero out + remove ~/.mcp-graph/copilot.json (implies subcommand=logout)
 *   --status  print token status and exit (implies subcommand=status)
 */

export async function runLogin(
  ctx: CommandHandlerArgs,
): Promise<CommandHandlerResult> {
  const subcommand = pickSubcommand(ctx.flags);
  const args = subcommand === "login" && ctx.flags.fresh ? ["--fresh"] : [];

  const result = await runBridge({ subcommand, args, inheritStdio: true });

  if (result.locator === null) {
    return {
      exitCode: 127,
      text: bridgeNotFoundMessage(),
    };
  }

  if (result.exitCode === 127) {
    return {
      exitCode: 127,
      text: bridgeNotFoundMessage(),
    };
  }

  if (result.exitCode !== 0) {
    return {
      exitCode: result.exitCode,
      text: `(bridge exited with code ${result.exitCode})`,
    };
  }

  return { exitCode: 0 };
}

function pickSubcommand(
  flags: Record<string, string | boolean>,
): "login" | "logout" | "status" {
  if (flags.logout) return "logout";
  if (flags.status) return "status";
  return "login";
}

function bridgeNotFoundMessage(): string {
  return [
    "Could not locate the GitHub Copilot bridge CLI.",
    "",
    "  Install it with one of:",
    "    npm install -g @mcp-graph-workflow/bridge-cli",
    "    npm install --save @mcp-graph-workflow/bridge-cli",
    "",
    "  Or in dev: build the sibling at tools/copilot-bridge-cli/ first:",
    "    npm --prefix tools/copilot-bridge-cli run build",
    "",
    "  Override path: set MG_BRIDGE_BIN=/abs/path/to/bridge-cli",
  ].join("\n");
}
