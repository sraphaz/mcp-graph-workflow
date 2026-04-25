/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Lazy gate-evaluation factory.
 *
 * Mirrors `lazy-store.ts`: dynamically imports the gate primitives from the
 * parent project's compiled `dist/` so this CLI sub-package never imports
 * from the parent `src/` directly at type-check time.
 *
 * The pre-tool-use hook (`mg hook pre-tool-use`) calls `getGateDeps()` to
 * obtain `loadGateContext` + `checkGates` and forwards them to
 * `evaluatePreToolUse(input, { store, gateDeps })`. Tests inject a fake
 * resolver via `setGateResolver`.
 */

import type { GateDeps } from "../commands/pre-tool-use.js";

interface GateModule {
  loadGateContext: (store: unknown) => unknown;
  checkGates: (
    store: unknown,
    toolName: string,
    args: unknown[],
    currentGitHash?: string | null,
    options?: { applyReadOnlySkip?: boolean; skipCodeIntel?: boolean },
  ) => {
    allowed: boolean;
    warnings: ReadonlyArray<{ severity: "error" | "warning" | "info"; message: string; code?: string }>;
    lifecycleBlock?: { phase?: string };
  };
}

let modulePromise: Promise<GateModule> | null = null;
let moduleResolver: () => Promise<GateModule> = defaultResolver;

async function defaultResolver(): Promise<GateModule> {
  const override = process.env.MG_GATE_MODULE;
  if (override) {
    return (await import(override)) as unknown as GateModule;
  }
  // Cast through `unknown` because the published types lag the new exports
  // (`loadGateContext`, `checkGates` options) until the parent dist/ is rebuilt.
  // Runtime presence is checked the first time getGateDeps() is invoked.
  return (await import(
    "@mcp-graph-workflow/mcp-graph/dist/mcp/unified-gate.js"
  )) as unknown as GateModule;
}

export function setGateResolver(
  resolver: () => Promise<GateModule>,
): void {
  moduleResolver = resolver;
  modulePromise = null;
}

export function resetGateResolverForTests(): void {
  moduleResolver = defaultResolver;
  modulePromise = null;
}

async function loadModule(): Promise<GateModule> {
  if (!modulePromise) {
    modulePromise = moduleResolver();
  }
  return modulePromise;
}

export async function getGateDeps(): Promise<GateDeps> {
  const mod = await loadModule();
  return {
    loadGateContext: mod.loadGateContext,
    checkGates: mod.checkGates,
  };
}
