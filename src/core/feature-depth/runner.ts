/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Thin wrapper around the Go feature-depth binary.
 *
 * The Go tool (tools/feature-depth/) is the canonical scorer for
 * standalone audits — 16-dim modules, growth analysis, full file
 * mode with cache. This runner shells out to `go run` so the MCP
 * tool can expose those capabilities without rebuilding them in TS.
 *
 * Graceful when Go isn't installed: returns a structured error
 * pointing at install instructions instead of throwing.
 */

import { spawn } from "node:child_process";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "core", source: "runner.ts" });

export interface RunnerResult {
  readonly ok: boolean;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly error?: string;
}

export interface RunnerOptions {
  readonly cwd: string;
  readonly toolPath: string; // path to tools/feature-depth (the Go module)
  readonly args: readonly string[];
  readonly timeoutMs?: number;
}

/**
 * Detect whether `go` is on PATH. Used by the MCP tool to short-circuit
 * with a helpful error before attempting `go run`.
 */
export function isGoAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("go", ["version"], { stdio: "ignore", shell: false });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

/**
 * Run `go run . <args>` from the feature-depth tool directory.
 * Captures stdout/stderr and returns them with the exit code.
 *
 * Default timeout 60s — growth mode on large repos can take a while
 * (parses every commit's numstat) but the audit modes are sub-second.
 */
export function runFeatureDepthGo(opts: RunnerOptions): Promise<RunnerResult> {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  return new Promise((resolve) => {
    const child = spawn("go", ["run", ".", ...opts.args], {
      cwd: opts.toolPath,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      log.warn("feature-depth:runner-error", { error: err.message });
      resolve({
        ok: false,
        stdout,
        stderr,
        exitCode: null,
        error: err.message,
      });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        stdout,
        stderr,
        exitCode: code,
        ...(code !== 0 ? { error: `go run exited with code ${code ?? "null"}` } : {}),
      });
    });
  });
}
