/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { spawn } from "node:child_process";
import { type BridgeLocator, locateBridgeBin } from "./locate.js";

export interface BridgeRunOptions {
  readonly subcommand: "login" | "logout" | "status" | "serve";
  readonly args?: readonly string[];
  readonly inheritStdio?: boolean; // default true (device-flow URL/code must reach user)
}

export interface BridgeRunResult {
  readonly exitCode: number;
  readonly locator: BridgeLocator | null;
  readonly stdout?: string;
  readonly stderr?: string;
}

/**
 * Run a bridge-cli subcommand as a child process.
 *
 * For `login`, stdio is inherited so the device-flow URL + user code print
 * directly to the terminal. For `status`, stdio is captured so we can return
 * the JSON output to the caller (`mcp-graph status` aggregates).
 */
export async function runBridge(
  opts: BridgeRunOptions,
): Promise<BridgeRunResult> {
  const locator = locateBridgeBin();
  if (!locator) {
    return { exitCode: 127, locator: null };
  }

  const args = [opts.subcommand, ...(opts.args ?? [])];
  const inherit = opts.inheritStdio ?? opts.subcommand === "login";

  const cmd = locator.kind === "node" ? process.execPath : locator.bin;
  const fullArgs = locator.kind === "node" ? [locator.script, ...args] : args;

  return new Promise((resolvePromise) => {
    let stdout = "";
    let stderr = "";

    const child = spawn(cmd, fullArgs, {
      stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    if (!inherit) {
      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
    }

    child.on("error", () => {
      resolvePromise({
        exitCode: 127,
        locator,
        stdout: inherit ? undefined : stdout,
        stderr: inherit ? undefined : stderr,
      });
    });

    child.on("exit", (code) => {
      resolvePromise({
        exitCode: code ?? 1,
        locator,
        stdout: inherit ? undefined : stdout,
        stderr: inherit ? undefined : stderr,
      });
    });
  });
}
