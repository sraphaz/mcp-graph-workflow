/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

/**
 * Bridge to the parent `@mcp-graph-workflow/mcp-graph` runtime.
 *
 * The v11 CLI delegates domain logic — store, planner, importer, harness —
 * to the parent project rather than re-implementing it.
 *
 * Resolution order (first match wins):
 *   1. `MG_PARENT_DIST` env var (absolute path to the parent's `dist/`).
 *   2. Sibling monorepo path (`../../dist/` from this file).
 *   3. `node_modules/@mcp-graph-workflow/mcp-graph/dist/` from CWD upward.
 *
 * If nothing resolves, callers receive a `ParentNotInstalledError`.
 */

export class ParentNotInstalledError extends Error {
  readonly hint: string;
  constructor(hint: string) {
    super("@mcp-graph-workflow/mcp-graph is not installed");
    this.name = "ParentNotInstalledError";
    this.hint = hint;
  }
}

export interface ParentRuntime {
  readonly distRoot: string;
  /** Absolute path to the parent's CLI entry (`dist/cli/index.js`), if discoverable. */
  readonly cliEntry?: string | null;
  loadStore(): Promise<unknown>;
  loadPlanner(): Promise<unknown>;
  loadGraphTypes(): Promise<unknown>;
  loadBrowserHarness?(): Promise<unknown>;
  loadSetPhaseCore?(): Promise<unknown>;
}

let cached: ParentRuntime | null = null;

export function resetParentBridgeForTests(): void {
  cached = null;
}

export function setParentRuntimeForTests(runtime: ParentRuntime): void {
  cached = runtime;
}

export async function getParentRuntime(): Promise<ParentRuntime> {
  if (cached) return cached;

  const distRoot = locateParentDist();
  if (!distRoot) {
    throw new ParentNotInstalledError(
      [
        "Could not locate @mcp-graph-workflow/mcp-graph runtime.",
        "",
        "  Install it alongside the CLI:",
        "    npm install -g @mcp-graph-workflow/mcp-graph",
        "",
        "  Or in the monorepo: build the parent first:",
        "    npm --prefix ../.. run build",
        "",
        "  Override the path: set MG_PARENT_DIST=/abs/path/to/dist",
      ].join("\n"),
    );
  }

  const cliCandidate = join(distRoot, "cli", "index.js");
  const cliEntry = existsSync(cliCandidate) ? cliCandidate : null;

  const runtime: ParentRuntime = {
    distRoot,
    cliEntry,
    async loadStore() {
      return import(pathToFileURL(join(distRoot, "core", "store", "sqlite-store.js")).href);
    },
    async loadPlanner() {
      return import(pathToFileURL(join(distRoot, "core", "planner", "next-task.js")).href);
    },
    async loadGraphTypes() {
      return import(pathToFileURL(join(distRoot, "core", "graph", "graph-types.js")).href);
    },
    async loadBrowserHarness() {
      return import(pathToFileURL(join(distRoot, "core", "browser-harness", "index.js")).href);
    },
    async loadSetPhaseCore() {
      return import(pathToFileURL(join(distRoot, "core", "planner", "set-phase-core.js")).href);
    },
  };

  cached = runtime;
  return runtime;
}

function locateParentDist(): string | null {
  const fromEnv = process.env.MG_PARENT_DIST;
  if (fromEnv && hasStoreModule(fromEnv)) return fromEnv;

  const sibling = locateSiblingDist();
  if (sibling) return sibling;

  const inNodeModules = locateInNodeModules();
  if (inNodeModules) return inNodeModules;

  return null;
}

function hasStoreModule(distRoot: string): boolean {
  return existsSync(join(distRoot, "core", "store", "sqlite-store.js"));
}

function locateSiblingDist(): string | null {
  const here = currentFileDir();
  const candidates = [
    resolve(here, "..", "..", "..", "dist"),
    resolve(here, "..", "..", "..", "..", "dist"),
  ];
  for (const c of candidates) {
    if (hasStoreModule(c)) return c;
  }
  return null;
}

function locateInNodeModules(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const candidate = join(
      dir,
      "node_modules",
      "@mcp-graph-workflow",
      "mcp-graph",
      "dist",
    );
    if (hasStoreModule(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function currentFileDir(): string {
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    return process.cwd();
  }
}
