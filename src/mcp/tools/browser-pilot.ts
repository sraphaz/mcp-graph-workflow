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
 * MCP tool: `browser_pilot_run` — Sprint 1.13 + 1.14.
 *
 * Thin adapter: validates the input via `BrowserPilotInputSchema`, wires
 * the real bridge / WS-resolver / agent-spawn deps, and translates the
 * discriminated-union response from `executeBrowserPilot` into MCP framing.
 *
 * The actual `spawnAgent` integration with browser-use's stdio MCP server
 * lands as follow-up work — Sprint 1.5 (tool-call fidelity fixtures) and
 * Sprint 1.16 (E2E S1) drive its concrete shape. Until then the wired
 * spawn surfaces a clear `browser_use_crash` with a hint so the wiring is
 * exercisable end-to-end.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { randomUUID } from "node:crypto";

import { mcpError, mcpText } from "../response-helpers.js";
import {
  BrowserPilotInputSchema,
  type BrowserPilotInput,
} from "../../schemas/browser-pilot.schema.js";
import {
  executeBrowserPilot,
  type AgentTranscript,
  type BrowserPilotRunDeps,
} from "../../core/browser-pilot/execute-browser-pilot.js";
import { BridgeClient } from "../../core/browser-pilot/bridge-client.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { createLogger } from "../../core/utils/logger.js";
import { OperationError } from "../../core/utils/errors.js";

const log = createLogger({ layer: "mcp", source: "browser-pilot.ts" });

const DEFAULT_BRIDGE_URL = "http://127.0.0.1:9876/v1";
const DEFAULT_MODEL = "claude-3.5-sonnet";

class NotYetWiredAgentError extends Error {
  readonly code = "browser_use_crash" as const;
  constructor() {
    super(
      "browser-use child spawn not wired yet — Sprint 1.5/1.16 follow-up. " +
        "The orchestrator + bridge + WS resolution work; this stub guards the surface.",
    );
    this.name = "NotYetWiredAgentError";
  }
}

async function defaultSpawnAgent(
  _input: BrowserPilotInput,
  _wsEndpoint: string,
): Promise<AgentTranscript> {
  throw new NotYetWiredAgentError();
}

export interface BrowserPilotToolOverrides {
  readonly bridgeBaseUrl?: string;
  readonly defaultModel?: string;
  readonly resolveWsEndpoint?: BrowserPilotRunDeps["resolveWsEndpoint"];
  readonly spawnAgent?: BrowserPilotRunDeps["spawnAgent"];
}

/** buildBrowserPilotDeps — auto-generated description placeholder. */
export function buildBrowserPilotDeps(
  _store: SqliteStore,
  overrides: BrowserPilotToolOverrides = {},
): BrowserPilotRunDeps {
  const bridgeBaseUrl = overrides.bridgeBaseUrl ?? DEFAULT_BRIDGE_URL;
  const defaultModel = overrides.defaultModel ?? DEFAULT_MODEL;
  const bridge = new BridgeClient(bridgeBaseUrl);

  const resolveWsEndpoint =
    overrides.resolveWsEndpoint ??
    (async (arg: string | undefined, _sessionId: string | undefined) => {
      if (arg && arg.length > 0) return arg;
      throw new OperationError(
        "no CDP WebSocket endpoint — pass wsEndpoint or configure default.",
      );
    });

  return {
    ensureBridgeReady: async () => {
      await bridge.ensureReady();
    },
    resolveWsEndpoint,
    spawnAgent: overrides.spawnAgent ?? defaultSpawnAgent,
    now: () => Date.now(),
    generateRunId: () => `bp-${randomUUID()}`,
    defaultModel,
    bridgeBaseUrl,
  };
}

/** registerBrowserPilotTool — auto-generated description placeholder. */
export function registerBrowserPilotTool(
  server: McpServer,
  store: SqliteStore,
  overrides: BrowserPilotToolOverrides = {},
): void {
  const deps = buildBrowserPilotDeps(store, overrides);

  server.tool(
    "browser_pilot_run",
    "Drive a remote Chrome via browser-use + Copilot LLM. Input: prompt + wsEndpoint (CDP). Output: result + actionLog + screenshots + tokens.",
    BrowserPilotInputSchema.shape,
    async (rawInput) => {
      let input: BrowserPilotInput;
      try {
        input = BrowserPilotInputSchema.parse(rawInput);
      } catch (err) {
        return mcpError(err instanceof Error ? err : String(err));
      }

      try {
        const response = await executeBrowserPilot(input, deps);
        return mcpText(response);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.error("browser_pilot_run unexpected", { message });
        return mcpError(err instanceof Error ? err : String(err));
      }
    },
  );
}
