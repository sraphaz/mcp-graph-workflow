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
 * graph_lifecycle — V11 Maestro Phase 3 facade wrapper over `analyze`.
 *
 * Decision: WRAPPER, not extract. `analyze` keeps its 53-mode surface;
 * `graph_lifecycle({phase})` runs every mode of a phase in parallel via
 * `Promise.allSettled` and aggregates outputs. ADR 0042 §wrapper.
 *
 * The runner is injected so the wrapper is unit-testable without a full
 * MCP server. The default runner looks up the registered analyze tool's
 * handler from the McpServer's internal `_registeredTools` map.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import {
  type AnalyzeMode,
  type LifecyclePhase,
  getModesForPhase,
} from "../../core/planner/lifecycle-phase.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

export type AnalyzeRunner = (mode: AnalyzeMode) => Promise<unknown>;

export interface ModeResult {
  mode: AnalyzeMode;
  ok: boolean;
  payload?: unknown;
  error?: string;
}

export type GraphLifecycleResponse =
  | {
      ok: true;
      phase: LifecyclePhase;
      results: ModeResult[];
      durationMs: number;
    }
  | {
      ok: false;
      phase: LifecyclePhase | string;
      error: string;
      results?: ModeResult[];
    };

export interface GraphLifecycleOptions {
  /** When provided, runs only this mode (must be part of the phase). */
  subCheck?: AnalyzeMode;
}

/**
 * Pure helper — runs every analyze mode of a phase via the injected runner
 * and aggregates outputs with `Promise.allSettled`. One mode failing never
 * aborts the wrapper; failures surface in `results[i].error`.
 */
export async function buildGraphLifecycleResponse(
  phase: LifecyclePhase,
  runAnalyze: AnalyzeRunner,
  options: GraphLifecycleOptions = {},
): Promise<GraphLifecycleResponse> {
  const modes = getModesForPhase(phase);
  if (modes.length === 0) {
    return { ok: false, phase, error: `Unknown lifecycle phase: ${phase}` };
  }

  let target: ReadonlyArray<AnalyzeMode> = modes as AnalyzeMode[];
  if (options.subCheck !== undefined) {
    if (!modes.includes(options.subCheck)) {
      return {
        ok: false,
        phase,
        error: `subCheck "${options.subCheck}" is not part of phase ${phase}`,
      };
    }
    target = [options.subCheck];
  }

  const startedAt = Date.now();
  const settled = await Promise.allSettled(
    target.map(async (mode): Promise<ModeResult> => {
      try {
        const payload = await runAnalyze(mode);
        return { mode, ok: true, payload };
      } catch (err) {
        return {
          mode,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  const results: ModeResult[] = settled.map((s, i) => {
    if (s.status === "fulfilled") return s.value;
    return {
      mode: target[i],
      ok: false,
      error: s.reason instanceof Error ? s.reason.message : String(s.reason),
    };
  });

  return {
    ok: true,
    phase,
    results,
    durationMs: Date.now() - startedAt,
  };
}

interface RegisteredToolHandle {
  callback: (...args: unknown[]) => Promise<unknown> | unknown;
}

/**
 * Default runner — invokes the registered `analyze` tool's handler with
 * `{mode}`. Decoupled via the runner injection so tests don't need an
 * McpServer.
 */
function makeDefaultAnalyzeRunner(server: McpServer): AnalyzeRunner {
  return async (mode: AnalyzeMode) => {
    const registry = (server as unknown as {
      _registeredTools?: Record<string, RegisteredToolHandle>;
    })._registeredTools;
    const analyzeHandle = registry?.["analyze"];
    if (!analyzeHandle) {
      throw new Error("analyze tool is not registered on the server");
    }
    // McpServer tool handlers receive the args dict as the first argument.
    return await analyzeHandle.callback({ mode });
  };
}

const PhaseEnum = z.enum([
  "ANALYZE", "DESIGN", "PLAN", "IMPLEMENT", "VALIDATE",
  "REVIEW", "HANDOFF", "DEPLOY", "LISTENING",
]);

export function registerGraphLifecycle(server: McpServer, _store: SqliteStore): void {
  const runAnalyze = makeDefaultAnalyzeRunner(server);

  server.tool(
    "graph_lifecycle",
    "Facade wrapper over `analyze` (V11 Maestro). graph_lifecycle({phase}) runs every analyze mode of the phase in parallel via Promise.allSettled and aggregates outputs. Use subCheck to scope to a single mode of the phase. `analyze` itself stays available for fine-grained calls.",
    {
      phase: PhaseEnum.describe("Lifecycle phase: ANALYZE | DESIGN | PLAN | IMPLEMENT | VALIDATE | REVIEW | HANDOFF | DEPLOY | LISTENING"),
      subCheck: z.string().optional().describe("Optional — restrict to a single mode that belongs to the phase. Returns error if mode is not in phase."),
    },
    async ({ phase, subCheck }) => {
      const r = await buildGraphLifecycleResponse(
        phase as LifecyclePhase,
        runAnalyze,
        { subCheck: subCheck as AnalyzeMode | undefined },
      );
      logger.debug("tool:graph_lifecycle", {
        phase: r.phase,
        ok: r.ok,
        modeCount: "results" in r ? r.results?.length ?? 0 : 0,
      });
      return mcpText(r);
    },
  );
}
