/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  closeAllStores,
  getStore,
  hasOpenStore,
  resetStoreResolverForTests,
  setStoreResolver,
} from "./lazy-store.js";

interface StubStore {
  close(): void;
  basePath: string;
}

function makeStubModule() {
  const opens: string[] = [];
  const closes: string[] = [];
  const module = {
    SqliteStore: {
      open(basePath?: string): StubStore {
        const resolved = basePath ?? "default";
        opens.push(resolved);
        return {
          basePath: resolved,
          close: () => {
            closes.push(resolved);
          },
        };
      },
    },
  };
  return { module, opens, closes };
}

describe("lazy-store", () => {
  afterEach(() => {
    closeAllStores();
    resetStoreResolverForTests();
  });

  it("does not load the store module until getStore() is called", async () => {
    const { module } = makeStubModule();
    const resolver = vi.fn(async () => module);
    setStoreResolver(resolver);

    expect(resolver).not.toHaveBeenCalled();

    await getStore("/tmp/proj-a");
    expect(resolver).toHaveBeenCalledOnce();
  });

  it("caches the store per basePath (single open per project)", async () => {
    const { module, opens } = makeStubModule();
    setStoreResolver(async () => module);

    const a1 = await getStore("/tmp/proj-a");
    const a2 = await getStore("/tmp/proj-a");
    const b1 = await getStore("/tmp/proj-b");

    expect(a1).toBe(a2);
    expect(a1).not.toBe(b1);
    expect(opens).toEqual(["/tmp/proj-a", "/tmp/proj-b"]);
  });

  it("closeAllStores closes every cached instance and clears the cache", async () => {
    const { module, closes } = makeStubModule();
    setStoreResolver(async () => module);

    await getStore("/tmp/proj-a");
    await getStore("/tmp/proj-b");
    expect(hasOpenStore("/tmp/proj-a")).toBe(true);

    closeAllStores();

    expect(closes).toEqual(["/tmp/proj-a", "/tmp/proj-b"]);
    expect(hasOpenStore("/tmp/proj-a")).toBe(false);
    expect(hasOpenStore("/tmp/proj-b")).toBe(false);
  });

  it("close errors during shutdown never throw", async () => {
    const throwingModule = {
      SqliteStore: {
        open() {
          return {
            close() {
              throw new Error("boom");
            },
          };
        },
      },
    };
    setStoreResolver(async () => throwingModule);

    await getStore("/tmp/proj-x");
    expect(() => closeAllStores()).not.toThrow();
  });

  it("loads the module exactly once across many calls", async () => {
    const { module } = makeStubModule();
    const resolver = vi.fn(async () => module);
    setStoreResolver(resolver);

    await Promise.all([
      getStore("/tmp/p1"),
      getStore("/tmp/p2"),
      getStore("/tmp/p3"),
      getStore("/tmp/p1"),
    ]);

    expect(resolver).toHaveBeenCalledOnce();
  });
});
