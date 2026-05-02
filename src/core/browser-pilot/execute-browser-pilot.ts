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
 * executeBrowserPilot — Sprint 1.14 orchestrator for `browser_pilot_run`.
 *
 * Pure orchestrator (no globals, no I/O of its own — every effect is
 * threaded via `BrowserPilotRunDeps`). The MCP tool wrapper in
 * `src/mcp/tools/browser-pilot.ts` is a thin adapter that wires the real
 * deps and translates the discriminated-union result to MCP framing.
 *
 * Pipeline:
 *   1. ensureBridgeReady — Copilot Bridge is on (else `bridge_unreachable`).
 *   2. resolveWsEndpoint — 3-tier (arg / sessionId / config default; else
 *      `cdp_ws_unreachable`).
 *   3. spawnAgent — runs the browser-use child + returns the transcript.
 *      Specific failure modes use a `code: BrowserPilotErrorCode` shape
 *      (passed through); anything else degrades to `browser_use_crash`.
 */

import {
  BROWSER_PILOT_ERROR_CODES,
  type BrowserPilotErrorCode,
  type BrowserPilotInput,
  type BrowserPilotOutput,
  type BrowserPilotResponse,
} from "../../schemas/browser-pilot.schema.js";

export interface AgentTranscript {
  readonly result: string;
  readonly actionLog: BrowserPilotOutput["actionLog"];
  readonly screenshots: BrowserPilotOutput["screenshots"];
  readonly tokens: BrowserPilotOutput["tokens"];
  readonly model: string;
}

export interface BrowserPilotRunDeps {
  ensureBridgeReady(): Promise<void>;
  resolveWsEndpoint(
    arg: string | undefined,
    sessionId: string | undefined,
  ): Promise<string>;
  spawnAgent(
    input: BrowserPilotInput,
    wsEndpoint: string,
  ): Promise<AgentTranscript>;
  now(): number;
  generateRunId(): string;
  defaultModel: string;
  bridgeBaseUrl: string;
}

const RETRIABLE_CODES: ReadonlySet<BrowserPilotErrorCode> = new Set([
  "bridge_unreachable",
  "copilot_unavailable",
  "cdp_ws_unreachable",
  "browser_use_crash",
  "timeout",
]);

function isKnownErrorCode(code: unknown): code is BrowserPilotErrorCode {
  return (
    typeof code === "string" &&
    (BROWSER_PILOT_ERROR_CODES as readonly string[]).includes(code)
  );
}

function errorOf(
  code: BrowserPilotErrorCode,
  message: string,
  hint?: string,
): BrowserPilotResponse {
  return {
    success: false,
    error: {
      code,
      message,
      ...(hint !== undefined ? { hint } : {}),
      retriable: RETRIABLE_CODES.has(code),
    },
  };
}

/** executeBrowserPilot — auto-generated description placeholder. */
export async function executeBrowserPilot(
  input: BrowserPilotInput,
  deps: BrowserPilotRunDeps,
): Promise<BrowserPilotResponse> {
  const startedAt = deps.now();
  const runId = deps.generateRunId();

  try {
    await deps.ensureBridgeReady();
  } catch (err) {
    return errorOf(
      "bridge_unreachable",
      err instanceof Error ? err.message : String(err),
      "Open VS Code with the Copilot Bridge extension active.",
    );
  }

  let wsEndpoint: string;
  try {
    wsEndpoint = await deps.resolveWsEndpoint(input.wsEndpoint, input.sessionId);
  } catch (err) {
    return errorOf(
      "cdp_ws_unreachable",
      err instanceof Error ? err.message : String(err),
      "Pass wsEndpoint or configure integrations.browserAutomation.defaultCdpUrl.",
    );
  }

  let transcript: AgentTranscript;
  try {
    transcript = await deps.spawnAgent(input, wsEndpoint);
  } catch (err) {
    const code: unknown =
      err && typeof err === "object" && "code" in err
        ? (err as { code: unknown }).code
        : undefined;
    if (isKnownErrorCode(code)) {
      return errorOf(
        code,
        err instanceof Error ? err.message : String(err),
      );
    }
    return errorOf(
      "browser_use_crash",
      err instanceof Error ? err.message : String(err),
      "Inspect the bridge log and the browser-use child stderr.",
    );
  }

  const finishedAt = deps.now();

  return {
    success: true,
    result: transcript.result,
    actionLog: transcript.actionLog,
    screenshots: transcript.screenshots,
    tokens: transcript.tokens,
    model: transcript.model || input.model || deps.defaultModel,
    durationMs: Math.max(0, finishedAt - startedAt),
    runId,
  };
}
