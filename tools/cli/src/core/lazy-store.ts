/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Lazy SQLite store factory.
 *
 * The store module is heavy (better-sqlite3 native + migrations + indexes).
 * Loading it eagerly costs ~200ms cold-start — unacceptable for `mg --version`
 * or `mg --help`. This factory:
 *
 *  1. Defers `import("...sqlite-store.js")` until `getStore()` is first called.
 *  2. Caches the resolved store per `basePath` so subsequent calls are O(1).
 *  3. Exposes `closeAllStores()` for clean process exit and test teardown.
 *
 * The actual store class lives in the parent project at
 * `src/core/store/sqlite-store.ts`. Resolution is config-driven — see
 * `resolveStoreModule()` below — so this CLI sub-package never imports
 * from the parent `src/` directly at type-check time.
 */

export interface StoreLike {
  close(): void;
  // The full store surface is rich; commands that need typed methods
  // narrow this via `as unknown as SqliteStore` after import-time.
  // For the lazy-loader, all we contract on is `close()`.
}

interface StoreModule {
  SqliteStore: {
    open(basePath?: string): StoreLike;
  };
}

const CACHE = new Map<string, StoreLike>();
let modulePromise: Promise<StoreModule> | null = null;

/**
 * Override the resolution path. Used by tests to inject a stub module,
 * and by `mg init` flows that may run before the parent `dist/` is built.
 *
 * The resolver returns the absolute import specifier (file URL or package
 * name). It runs once; the result is memoized in `modulePromise`.
 */
let moduleResolver: () => Promise<StoreModule> = defaultResolver;

async function defaultResolver(): Promise<StoreModule> {
  // Resolve relative to the consumer's CWD: parent project's compiled output.
  // `MG_STORE_MODULE` env var lets ops point at a different build (e.g. dev vs prod).
  const override = process.env.MG_STORE_MODULE;
  if (override) {
    return (await import(override)) as StoreModule;
  }
  // Default convention: parent project ships `dist/core/store/sqlite-store.js`.
  // The CLI is expected to run inside (or alongside) an `npm install`ed
  // `@mcp-graph-workflow/mcp-graph` package.
  // String assignment hides the path from TS module resolution (CLI typechecks
  // standalone without parent package's types being installed).
  const parentStorePath = "@mcp-graph-workflow/mcp-graph/dist/core/store/sqlite-store.js";
  return (await import(parentStorePath)) as StoreModule;
}

export function setStoreResolver(
  resolver: () => Promise<StoreModule>,
): void {
  moduleResolver = resolver;
  modulePromise = null;
  CACHE.clear();
}

export function resetStoreResolverForTests(): void {
  moduleResolver = defaultResolver;
  modulePromise = null;
  CACHE.clear();
}

async function loadModule(): Promise<StoreModule> {
  if (!modulePromise) {
    modulePromise = moduleResolver();
  }
  return modulePromise;
}

export async function getStore(
  basePath: string = process.cwd(),
): Promise<StoreLike> {
  const cached = CACHE.get(basePath);
  if (cached) return cached;

  const mod = await loadModule();
  const store = mod.SqliteStore.open(basePath);
  CACHE.set(basePath, store);
  return store;
}

export function closeAllStores(): void {
  for (const store of CACHE.values()) {
    try {
      store.close();
    } catch {
      // best-effort during shutdown; never throw from close()
    }
  }
  CACHE.clear();
}

export function hasOpenStore(basePath: string = process.cwd()): boolean {
  return CACHE.has(basePath);
}
