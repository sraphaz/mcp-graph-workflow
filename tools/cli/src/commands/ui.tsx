/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { spawn } from "node:child_process";
import {
  ParentNotInstalledError,
  getParentRuntime,
} from "../core/parent-bridge.js";
import type {
  CommandHandlerArgs,
  CommandHandlerResult,
} from "./registry.js";

/**
 * `/ui` · `mg ui` — launch the dashboard.
 *
 * Spawns the parent project's `mcp-graph serve` (Express :3000) as a child
 * process, prints the URL, and waits until Ctrl-C. Output streams through
 * so the user sees server logs.
 *
 *   mg ui                  default :3000
 *   mg ui --port 3377      override port
 *   mg ui --no-open        do not auto-open browser
 *   mg ui --json           one-shot: print {url, pid} and exit
 *
 * In `--json` mode we don't keep the process attached — useful for scripts
 * that just want the URL after a separate `mcp-graph serve` is already running.
 */

const DEFAULT_PORT = 3000;

export async function runUi(
  ctx: CommandHandlerArgs,
): Promise<CommandHandlerResult> {
  const port = parsePort(ctx.flags.port) ?? DEFAULT_PORT;
  const url = `http://localhost:${port}`;

  if (ctx.flags.json) {
    return {
      exitCode: 0,
      json: {
        url,
        port,
        note: "use `mg ui` (without --json) to actually start the server",
      },
    };
  }

  let parent;
  try {
    parent = await getParentRuntime();
  } catch (err) {
    if (err instanceof ParentNotInstalledError) {
      return { exitCode: 127, text: err.hint };
    }
    throw err;
  }

  if (!parent.cliEntry) {
    return {
      exitCode: 127,
      text: [
        "parent CLI entry not found at <dist>/cli/index.js.",
        "  build the parent first: `npm --prefix ../.. run build`",
      ].join("\n"),
    };
  }

  process.stdout.write(`▸ launching dashboard at ${url}\n`);
  process.stdout.write(`  press Ctrl-C to stop\n\n`);

  const child = spawn(
    process.execPath,
    [parent.cliEntry, "serve", "--port", String(port)],
    {
      stdio: "inherit",
      env: { ...process.env, PORT: String(port) },
    },
  );

  return new Promise<CommandHandlerResult>((resolvePromise) => {
    const onSignal = (sig: NodeJS.Signals) => {
      child.kill(sig);
    };
    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);

    child.on("error", (err) => {
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      resolvePromise({
        exitCode: 1,
        text: `failed to launch parent serve: ${err.message}`,
      });
    });

    child.on("exit", (code) => {
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      resolvePromise({ exitCode: code ?? 0 });
    });
  });
}

function parsePort(value: string | boolean | undefined): number | null {
  if (typeof value !== "string") return null;
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n) || n < 1 || n > 65535) return null;
  return n;
}
