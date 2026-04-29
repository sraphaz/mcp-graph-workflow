/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { McpGraphError } from "../utils/errors.js";
import type { Topology } from "./swarm-types.js";

const SWARM_ALLOWED_PHASES = new Set(["IMPLEMENT", "VALIDATE"]);

export class SwarmTopologyGateError extends McpGraphError {
  constructor(
    public readonly phase: string,
    public readonly topology: string,
  ) {
    super(
      `swarmTopology cannot be set in phase "${phase}". Swarm coordination is only allowed in IMPLEMENT or VALIDATE.`,
    );
    this.name = "SwarmTopologyGateError";
  }
}

export interface SwarmGateWarning {
  warning: string;
  phase: string;
  topology: string;
}

export interface SwarmGateOptions {
  mode?: "strict" | "advisory";
}

/**
 * Validates that swarmTopology is only used in IMPLEMENT or VALIDATE phases.
 * - strict (default): throws SwarmTopologyGateError
 * - advisory: returns a warning object instead of throwing
 * - undefined topology: no-op (returns undefined)
 */
export function validateSwarmTopologyGate(
  phase: string,
  topology: Topology | string | undefined,
  opts: SwarmGateOptions = {},
): SwarmGateWarning | undefined {
  if (topology === undefined) return undefined;
  if (SWARM_ALLOWED_PHASES.has(phase)) return undefined;

  const mode = opts.mode ?? "strict";

  if (mode === "advisory") {
    return {
      warning: `swarmTopology "${topology}" is set but phase "${phase}" does not support swarm coordination (allowed: IMPLEMENT, VALIDATE)`,
      phase,
      topology,
    };
  }

  throw new SwarmTopologyGateError(phase, topology);
}
