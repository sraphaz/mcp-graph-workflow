/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { HelpersRegistry, HelpersRuntime } from "../core/browser-harness/index.js";
import { HelperNotFoundError, HarnessSafetyViolation } from "../core/utils/errors.js";

let store: SqliteStore;
let registry: HelpersRegistry;
let runtime: HelpersRuntime;

const fakeCdp = { send: async (_m: string, _p: Record<string, unknown>) => ({ result: { value: 42 } }) } as unknown as import("../core/browser-harness/cdp-client.js").CdpClient;

beforeEach(() => {
  store = SqliteStore.openDb(":memory:");
  registry = new HelpersRegistry(store.getDb());
  runtime = new HelpersRuntime(registry);
});

describe("HelpersRuntime", () => {
  it("throws HelperNotFoundError if the helper is missing", async () => {
    await expect(runtime.invoke(fakeCdp, "missing")).rejects.toThrow(HelperNotFoundError);
  });

  it("compiles, runs, and returns the helper's result", async () => {
    registry.upsert({
      name: "echo",
      source: `async (cdp, args) => ({ ok: true, args })`,
      signature: { params: [], returns: "{ ok: boolean }" },
      origin: "agent",
    });
    const result = await runtime.invoke(fakeCdp, "echo", { foo: "bar" }) as { ok: boolean; args: Record<string, unknown> };
    expect(result.ok).toBe(true);
    expect(result.args).toEqual({ foo: "bar" });
  });

  it("isolates helpers from process / require", async () => {
    registry.upsert({
      name: "leak",
      source: `async () => { try { return { ok: true, hasProcess: typeof process } } catch (e) { return { ok: true, hasProcess: 'undefined' } } }`,
      signature: { params: [], returns: "any" },
      origin: "agent",
    });
    const r = await runtime.invoke(fakeCdp, "leak") as { ok: boolean; hasProcess: string };
    expect(r.hasProcess).toBe("undefined");
  });

  it("recompiles after invalidate when source changes", async () => {
    registry.upsert({
      name: "v",
      source: `async () => ({ ok: true, n: 1 })`,
      signature: { params: [], returns: "any" },
      origin: "agent",
    });
    expect(((await runtime.invoke(fakeCdp, "v")) as { n: number }).n).toBe(1);

    registry.upsert({
      name: "v",
      source: `async () => ({ ok: true, n: 2 })`,
      signature: { params: [], returns: "any" },
      origin: "agent",
    });
    runtime.invalidate("v");
    expect(((await runtime.invoke(fakeCdp, "v")) as { n: number }).n).toBe(2);
  });

  it("surfaces compile errors as HarnessSafetyViolation", async () => {
    registry.upsert({
      name: "broken",
      source: `not a function expression {{ syntax error`,
      signature: { params: [], returns: "any" },
      origin: "agent",
    });
    await expect(runtime.invoke(fakeCdp, "broken")).rejects.toThrow(HarnessSafetyViolation);
  });
});
