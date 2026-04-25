/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolve the `mcp-graph-bridge` binary that ships from `tools/copilot-bridge-cli/`.
 *
 * Resolution order:
 *   1. `MG_BRIDGE_BIN` env var (full path) — escape hatch for tests / unusual installs.
 *   2. Sibling `tools/copilot-bridge-cli/dist/cli.cjs` (monorepo dev path).
 *   3. `node_modules/@mcp-graph-workflow/bridge-cli/dist/cli.cjs` (npm-installed).
 *   4. `mcp-graph-bridge` on PATH (post-`npm i -g @mcp-graph-workflow/bridge-cli`).
 *
 * Returns either:
 *   - `{ kind: "node", script }` — invoke as `node script ...` (preferred, no PATH dep).
 *   - `{ kind: "exec", bin }`    — invoke as `<bin> ...` (last resort, requires PATH).
 *   - `null` if nothing found.
 */

export type BridgeLocator =
  | { readonly kind: "node"; readonly script: string }
  | { readonly kind: "exec"; readonly bin: string };

export function locateBridgeBin(): BridgeLocator | null {
  const fromEnv = process.env.MG_BRIDGE_BIN;
  if (fromEnv && existsSync(fromEnv)) {
    return fromEnv.endsWith(".cjs") || fromEnv.endsWith(".mjs") || fromEnv.endsWith(".js")
      ? { kind: "node", script: fromEnv }
      : { kind: "exec", bin: fromEnv };
  }

  const sibling = locateSiblingDist();
  if (sibling) return { kind: "node", script: sibling };

  const fromNodeModules = locateInNodeModules();
  if (fromNodeModules) return { kind: "node", script: fromNodeModules };

  return { kind: "exec", bin: "mcp-graph-bridge" };
}

function locateSiblingDist(): string | null {
  // From the running cli.mjs, walk up looking for a sibling `copilot-bridge-cli/dist/cli.cjs`.
  // In dev (running via tsx or compiled `tools/cli/dist/cli.mjs`), this resolves to the
  // monorepo-local bridge build.
  const here = currentFileDir();
  const candidates = [
    resolve(here, "..", "copilot-bridge-cli", "dist", "cli.cjs"),
    resolve(here, "..", "..", "copilot-bridge-cli", "dist", "cli.cjs"),
    resolve(here, "..", "..", "..", "copilot-bridge-cli", "dist", "cli.cjs"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

function locateInNodeModules(): string | null {
  // `npm i -g @mcp-graph-workflow/cli` installs the cli; the bridge is a peer.
  // If the user installed both, the bridge lives under the same node_modules root.
  const here = currentFileDir();
  let dir = here;
  for (let i = 0; i < 8; i++) {
    const candidate = join(
      dir,
      "node_modules",
      "@mcp-graph-workflow",
      "bridge-cli",
      "dist",
      "cli.cjs",
    );
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function currentFileDir(): string {
  // ESM-safe __dirname.
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    return process.cwd();
  }
}
