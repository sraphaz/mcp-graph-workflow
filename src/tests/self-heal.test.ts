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
import { SelfHealService, type SelfHealInput } from "../core/browser-harness/self-heal.js";
import { HelperValidationError } from "../core/utils/errors.js";
import type { HarnessGuardrail } from "../schemas/browser-harness.schema.js";

const guardrail: HarnessGuardrail = {
  allowedDomains: ["*"],
  forbiddenCdpMethods: [],
  selfHealPolicy: {
    requireTest: false,
    maxSourceBytes: 4096,
    forbiddenApis: ["fs", "child_process", "process.exit"],
  },
};

function makeInput(
  overrides: Partial<SelfHealInput> = {},
): SelfHealInput {
  return {
    sessionId: "session-1",
    name: "click_button",
    source: "async (cdp, args) => { return true; }",
    signature: { params: [], returns: "boolean" },
    guardrail,
    ...overrides,
  };
}

describe("SelfHealService", () => {
  let db: Database.Database;
  let service: SelfHealService;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    const registry = new HelpersRegistry(db);
    const runtime = new HelpersRuntime(registry);
    service = new SelfHealService(db, registry, runtime);
  });

  afterEach(() => {
    db.close();
  });

  describe("add — happy path", () => {
    it("should register a valid helper and return name + version=1", () => {
      const result = service.add(makeInput({ name: "first_helper" }));

      expect(result.name).toBe("first_helper");
      expect(result.version).toBe(1);
    });

    it("should increment version on second add of same name", () => {
      service.add(makeInput({ name: "iter", source: "async () => 1" }));
      const v2 = service.add(makeInput({ name: "iter", source: "async () => 2" }));

      expect(v2.version).toBe(2);
    });

    it("should write an audit row for successful add", () => {
      service.add(makeInput({ name: "audited" }));

      const audits = db
        .prepare("SELECT * FROM bh_audit WHERE action = 'add_helper'")
        .all();
      expect(audits.length).toBe(1);
    });
  });

  describe("add — validation failures", () => {
    it("should reject source larger than maxSourceBytes", () => {
      const huge = "async (cdp, args) => { return '" + "x".repeat(5000) + "'; }";

      expect(() =>
        service.add(makeInput({ name: "too_big", source: huge })),
      ).toThrow(HelperValidationError);
    });

    it("should reject source containing 'fs.' (forbidden token)", () => {
      const dangerous = "async () => { fs.readFileSync('/etc/passwd'); }";

      expect(() =>
        service.add(makeInput({ name: "exfil", source: dangerous })),
      ).toThrow(HelperValidationError);
    });

    it("should reject source containing 'child_process'", () => {
      const dangerous = "async () => { require('child_process').exec('ls'); }";

      expect(() =>
        service.add(makeInput({ name: "spawn", source: dangerous })),
      ).toThrow(HelperValidationError);
    });

    it("should record a 'safety_block' audit row when validation fails", () => {
      try {
        service.add(makeInput({ name: "blocked", source: "fs.readFile('x')" }));
      } catch {
        // expected
      }

      const audits = db
        .prepare("SELECT * FROM bh_audit WHERE action = 'safety_block'")
        .all();
      expect(audits.length).toBe(1);
    });
  });

  describe("audit", () => {
    it("should accept null result without crashing", () => {
      expect(() =>
        service.audit("s1", "test_action", { foo: 1 }, null),
      ).not.toThrow();
    });

    it("should serialize payload + result as JSON", () => {
      service.audit("s1", "custom", { key: "value" }, { ok: true });

      const row = db
        .prepare("SELECT payload, result FROM bh_audit WHERE action = 'custom'")
        .get() as { payload: string; result: string };

      expect(JSON.parse(row.payload)).toEqual({ key: "value" });
      expect(JSON.parse(row.result)).toEqual({ ok: true });
    });
  });
});
