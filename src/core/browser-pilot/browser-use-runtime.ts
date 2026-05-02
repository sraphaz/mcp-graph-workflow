/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of MCP Graph Workflow.
 *
 * MCP Graph Workflow is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Affero General Public License v3.0 or later, as
 * published by the Free Software Foundation. See LICENSE for the full terms.
 *
 * MCP Graph Workflow is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

/**
 * browser-use-runtime — Copilot Bridge Sprint 1.11.
 *
 * Drives a `python -m browser_use.cli --mcp` child process, configured to
 * speak OpenAI-compat against the local Copilot Bridge (Sprint 1.1) and
 * to drive a Chrome over CDP-WebSocket (the portability win the whole
 * stack exists for).
 *
 * Split into three pure / thin layers so each is unit-testable without
 * spawning a real Python:
 *   - buildRuntimeSpec(config)      — pure: env, args, JSON payload
 *   - prepareRuntimeFiles(spec)     — IO-light: tmpdir + writeFile (deps DI'd)
 *   - spawnBrowserUseRuntime(...)   — actually forks the child (Sprint 1.14)
 *
 * The third layer ships when the orchestrating handler (#14) needs it.
 */

import * as nodePath from "node:path";

export interface BrowserUseRuntimeConfig {
  readonly bridgeBaseUrl: string;
  readonly model: string;
  readonly cdpUrl: string;
  readonly allowedDomains: readonly string[];
  readonly forbiddenCdpMethods?: readonly string[];
  readonly maxSteps?: number;
}

export interface RuntimeSpec {
  readonly command: string;
  readonly args: readonly string[];
  readonly env: Record<string, string>;
  readonly configFileContent: string;
}

/** buildRuntimeSpec — auto-generated description placeholder. */
export function buildRuntimeSpec(
  config: BrowserUseRuntimeConfig,
): RuntimeSpec {
  const env: Record<string, string> = {
    OPENAI_API_KEY: "copilot-dummy",
    OPENAI_BASE_URL: config.bridgeBaseUrl,
    BROWSER_USE_LLM_MODEL: config.model,
  };

  const payload: Record<string, unknown> = {
    cdp_url: config.cdpUrl,
    allowed_domains: [...config.allowedDomains],
  };
  if (config.forbiddenCdpMethods !== undefined) {
    payload.forbidden_cdp_methods = [...config.forbiddenCdpMethods];
  }
  if (config.maxSteps !== undefined) {
    payload.max_steps = config.maxSteps;
  }

  return {
    command: "python",
    args: ["-m", "browser_use.cli", "--mcp"],
    env,
    configFileContent: JSON.stringify(payload, null, 2),
  };
}

export interface PrepareRuntimeDeps {
  readonly writeFile: (
    path: string,
    contents: string,
    encoding: "utf8",
  ) => Promise<void>;
  readonly mkdtemp: (prefix: string) => Promise<string>;
  readonly tmpRoot: string;
}

export interface PreparedRuntime {
  readonly args: readonly string[];
  readonly env: Record<string, string>;
  readonly configPath: string;
  readonly tmpDir: string;
}

/** prepareRuntimeFiles — auto-generated description placeholder. */
export async function prepareRuntimeFiles(
  spec: RuntimeSpec,
  deps: PrepareRuntimeDeps,
): Promise<PreparedRuntime> {
  const tmpDir = await deps.mkdtemp(
    nodePath.join(deps.tmpRoot, "browser-pilot-"),
  );
  const configPath = nodePath.join(tmpDir, "config.json");
  await deps.writeFile(configPath, spec.configFileContent, "utf8");

  return {
    args: [...spec.args, "--config", configPath],
    env: { ...spec.env },
    configPath,
    tmpDir,
  };
}
