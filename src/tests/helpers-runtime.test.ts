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

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { HelpersRegistry } from "../core/browser-harness/helpers-registry.js";
import { HelpersRuntime } from "../core/browser-harness/helpers-runtime.js";
import { HelperNotFoundError, HarnessSafetyViolation } from "../core/utils/errors.js";
import type { CdpClient } from "../core/browser-harness/cdp-client.js";

// Minimal CdpClient stub — runtime won't really connect, just needs the type.
const stubCdp: CdpClient = {} as unknown as CdpClient;

function registerHelper(
  registry: HelpersRegistry,
  name: string,
  source: string,
): void {
  registry.upsert({
    name,
    source,
    signature: { params: [], returns: "any" },
    origin: "agent",
    createdBy: "test",
  });
}

describe("HelpersRuntime", () => {
  let db: Database.Database;
  let registry: HelpersRegistry;
  let runtime: HelpersRuntime;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    registry = new HelpersRegistry(db);
    runtime = new HelpersRuntime(registry);
  });

  afterEach(() => {
    db.close();
  });

  describe("invoke", () => {
    it("should throw HelperNotFoundError when helper does not exist", async () => {
      await expect(runtime.invoke(stubCdp, "missing")).rejects.toThrow(
        HelperNotFoundError,
      );
    });

    it("should compile and execute a simple helper that returns a literal", async () => {
      registerHelper(registry, "answer", "async () => 42");

      const result = await runtime.invoke(stubCdp, "answer");
      expect(result).toBe(42);
    });

    it("should pass args through to the helper", async () => {
      registerHelper(
        registry,
        "echo",
        "async (cdp, args) => args.value",
      );

      const result = await runtime.invoke(stubCdp, "echo", { value: "hello" });
      expect(result).toBe("hello");
    });

    it("should reject malformed source with HarnessSafetyViolation", async () => {
      registerHelper(registry, "broken", "this is not js {{{ ;");

      await expect(runtime.invoke(stubCdp, "broken")).rejects.toThrow(
        HarnessSafetyViolation,
      );
    });

    it("should NOT have access to fs / process / require in sandbox", async () => {
      // The sandbox whitelist excludes node built-ins. Source attempting to
      // read process.env should produce undefined or throw — either way,
      // it must not return real env data.
      registerHelper(
        registry,
        "leak_attempt",
        "async () => typeof process",
      );

      const result = await runtime.invoke(stubCdp, "leak_attempt");
      expect(result).toBe("undefined");
    });
  });

  describe("invalidate", () => {
    it("should drop cached compilation so the next invoke recompiles", async () => {
      registerHelper(registry, "v_test", "async () => 1");
      const first = await runtime.invoke(stubCdp, "v_test");
      expect(first).toBe(1);

      // Update source via new version
      registerHelper(registry, "v_test", "async () => 99");
      runtime.invalidate("v_test");

      const second = await runtime.invoke(stubCdp, "v_test");
      expect(second).toBe(99);
    });

    it("should not crash when invalidating a name that was never cached", () => {
      expect(() => runtime.invalidate("never_seen")).not.toThrow();
    });
  });
});
