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
 * Axiom gate — blocks VALIDATE→REVIEW transition when active constitution
 * principles lack a valid (non-revoked) AxiomLink in strict mode.
 *
 * Modes:
 *   strict   — blocked: true + orphanPrincipleIds populated when any orphan found
 *   advisory — blocked: false + warnings emitted per orphan
 *   off      — always passes, no checking
 */

import type { AxiomLink } from "../../schemas/axiom-link.schema.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "core", source: "axiom-gate.ts" });

export interface AxiomGateContext {
  activePrincipleIds: string[];
  axiomLinks: AxiomLink[];
  mode: "strict" | "advisory" | "off";
}

export interface AxiomGateResult {
  blocked: boolean;
  mode: "strict" | "advisory" | "off";
  orphanPrincipleIds: string[];
  warnings: string[];
  /** Present only when gate releases (no orphans) — token for snapshot record */
  snapshotToken?: string;
}

/** checkAxiomGate — auto-generated description placeholder. */
export function checkAxiomGate(ctx: AxiomGateContext): AxiomGateResult {
  const { activePrincipleIds, axiomLinks, mode } = ctx;

  const base: AxiomGateResult = {
    blocked: false,
    mode,
    orphanPrincipleIds: [],
    warnings: [],
  };

  if (mode === "off") {
    log.debug("axiom_gate:off", { principleCount: activePrincipleIds.length });
    return base;
  }

  // Build set of principle IDs with a valid (non-revoked) axiom_link
  const linked = new Set<string>(
    axiomLinks.filter((l) => !l.revoked).map((l) => l.constitutionPrincipleId),
  );

  const orphans = activePrincipleIds.filter((id) => !linked.has(id));

  if (orphans.length === 0) {
    const snapshotToken = `axiom_snapshot_${Date.now()}`;
    log.info("axiom_gate:released", { principleCount: activePrincipleIds.length, snapshotToken });
    return { ...base, snapshotToken };
  }

  const warnings = orphans.map(
    (id) => `Principle "${id}" has no valid axiom_link — link to AC + provenance before REVIEW`,
  );

  log.warn("axiom_gate:orphans_found", { orphans, mode });

  if (mode === "strict") {
    return { ...base, blocked: true, orphanPrincipleIds: orphans, warnings };
  }

  // advisory: warn but do not block
  return { ...base, orphanPrincipleIds: orphans, warnings };
}
