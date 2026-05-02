/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

/**
 * Wave-12 Sandbox — Builder Executor (Camada 2: Runner)
 *
 * Executes a build/test command under an isolation strategy, captures stdout
 * and stderr, enforces a hard timeout, and reports a normalized outcome. This
 * iteration ships **process isolation only** — Docker and Podman paths are
 * declared in the schema but will land in follow-up subtasks
 * (`node_0a4d4b371422` Docker, `node_39b52afc6313` Podman). Requesting them
 * now throws a clear error so callers do not silently run under the wrong
 * isolation guarantee.
 *
 * Policy highlights:
 *   - Timeout uses SIGKILL (hard-kill) per Wave-12 constraint — a SIGTERM
 *     grace period is inadequate for the predictability this layer promises.
 *   - Profile (ci-mirror / fast / full) is currently metadata-only; process
 *     isolation does not differentiate behavior across profiles, but the
 *     BuilderResult preserves the requested profile for the Reporter layer.
 *   - stdout/stderr are captured as UTF-8 strings; binary stacks (Java
 *     surefire, etc.) remain lossless because parsers inside the Reporter
 *     consume the text representations.
 */

import { spawn } from "node:child_process";
import { McpGraphError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export type BuilderStatus = "success" | "failure" | "error" | "timeout";
export type BuilderProfile = "ci-mirror" | "fast" | "full";
export type BuilderIsolation = "process" | "docker" | "podman";

export interface BuilderExecutorOptions {
  /** Program to execute. No shell interpretation unless you spawn one explicitly. */
  command: string;
  /** Command arguments. */
  args?: string[];
  /** Working directory for the child process. */
  workDir?: string;
  /** Isolation mechanism. Only `process` is implemented in this iteration. */
  isolation: BuilderIsolation;
  /** Hard timeout. Default: 300_000 (5 min). */
  timeoutMs?: number;
  /** Profile label forwarded to the Reporter. Default: `ci-mirror`. */
  profile?: BuilderProfile;
  /** Extra environment variables (merged onto `process.env`). */
  env?: Record<string, string>;
}

export interface BuilderResult {
  success: boolean;
  status: BuilderStatus;
  /** Process exit code. `null` when killed by a signal. */
  exitCode: number | null;
  /** Signal that terminated the process, if any. */
  signal: string | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  isolation: BuilderIsolation;
  profile: BuilderProfile;
}

const DEFAULT_TIMEOUT_MS = 300_000;

/** executeBuild — auto-generated description placeholder. */
export async function executeBuild(options: BuilderExecutorOptions): Promise<BuilderResult> {
  const {
    command,
    args = [],
    workDir,
    isolation,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    profile = "ci-mirror",
    env,
  } = options;

  if (isolation === "docker" || isolation === "podman") {
    throw new McpGraphError(
      `Isolation "${isolation}" not yet implemented — only "process" is available in this iteration.`,
    );
  }
  if (isolation !== "process") {
    throw new McpGraphError(`Unsupported isolation: "${isolation}"`);
  }

  const startedAt = Date.now();
  const mergedEnv = env ? { ...process.env, ...env } : process.env;

  return new Promise<BuilderResult>((resolve) => {
    const child = spawn(command, args, {
      cwd: workDir,
      env: mergedEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGKILL");
      } catch {
        /* already gone */
      }
    }, timeoutMs);

    const finish = (status: BuilderStatus, exitCode: number | null, signal: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const durationMs = Date.now() - startedAt;
      const success = status === "success";
      logger.debug("sandbox:builder:finished", {
        status,
        exitCode: String(exitCode ?? "null"),
        signal: String(signal ?? "null"),
        durationMs: String(durationMs),
        profile,
      });
      resolve({
        success,
        status,
        exitCode,
        signal,
        stdout,
        stderr,
        durationMs,
        isolation: "process",
        profile,
      });
    };

    child.on("error", (err: Error) => {
      logger.warn("sandbox:builder:spawn-error", { error: err.message });
      finish("error", null, null);
    });

    child.on("exit", (code, signal) => {
      if (timedOut) {
        finish("timeout", code, signal);
        return;
      }
      if (code === 0) {
        finish("success", 0, signal);
      } else {
        finish("failure", code, signal);
      }
    });
  });
}
