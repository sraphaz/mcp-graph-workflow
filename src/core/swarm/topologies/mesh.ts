/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-1.T05 — Mesh topology (peer-to-peer).
 *
 * All-to-all routing: every agent can dispatch directly to every other
 * agent. No queen, no SPOF. Pure-function layout — caller wires it into
 * runtime via swarm-coordinator + a2a-mailbox.
 */

import { McpGraphError } from "../../utils/errors.js";

export interface MeshLayout {
  /** Sorted agent list (deterministic order). */
  agents: string[];
  /** agent → all peers (everyone except self). */
  peers: Record<string, string[]>;
  /** Total directed edges in the mesh. */
  edgeCount: number;
}

/** buildMeshLayout — auto-generated description placeholder. */
export function buildMeshLayout(agentIds: string[]): MeshLayout {
  if (agentIds.length === 0) {
    throw new McpGraphError("Mesh topology requires at least one agent");
  }
  const seen = new Set<string>();
  for (const id of agentIds) {
    if (seen.has(id)) {
      throw new McpGraphError(`Mesh topology requires unique agent IDs (duplicate: ${id})`);
    }
    seen.add(id);
  }

  const agents = [...agentIds].sort();
  const peers: Record<string, string[]> = {};
  for (const aVar of agents) {
    peers[aVar] = agents.filter((other) => other !== aVar);
  }
  return { agents, peers, edgeCount: agents.length * (agents.length - 1) };
}

/** True when no agent is a single point of failure (≥2 agents AND fully connected). */
export function hasNoSpof(layout: MeshLayout): boolean {
  if (layout.agents.length < 2) return false;
  const expected = layout.agents.length - 1;
  return layout.agents.every((a) => (layout.peers[a]?.length ?? 0) === expected);
}
