/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import {
  HelpersRegistry,
  HelpersRuntime,
  SelfHealService,
  defaultGuardrail,
} from "../core/browser-harness/index.js";
import { HelperValidationError } from "../core/utils/errors.js";

let store: SqliteStore;
let svc: SelfHealService;

beforeEach(() => {
  store = SqliteStore.openDb(":memory:");
  const reg = new HelpersRegistry(store.getDb());
  const rt = new HelpersRuntime(reg);
  svc = new SelfHealService(store.getDb(), reg, rt);
});

const validSource = `async (cdp, args) => ({ ok: true, value: args.x })`;

describe("SelfHealService.add", () => {
  it("accepts a clean function expression and returns name + version", () => {
    const result = svc.add({
      sessionId: "sess-1",
      name: "ok_helper",
      source: validSource,
      guardrail: defaultGuardrail(),
    });
    expect(result.name).toBe("ok_helper");
    expect(result.version).toBe(1);

    const audit = store.getDb().prepare("SELECT action FROM bh_audit WHERE session_id = ?").all("sess-1") as Array<{ action: string }>;
    expect(audit.some((a) => a.action === "add_helper")).toBe(true);
  });

  it("rejects helpers using require()", () => {
    expect(() =>
      svc.add({
        sessionId: "sess-1",
        name: "bad",
        source: `async () => { const fs = require('fs'); return { ok: true } }`,
        guardrail: defaultGuardrail(),
      }),
    ).toThrow(HelperValidationError);

    const blocks = store.getDb().prepare("SELECT action FROM bh_audit WHERE session_id = ?").all("sess-1") as Array<{ action: string }>;
    expect(blocks.some((b) => b.action === "safety_block")).toBe(true);
  });

  it("rejects helpers exceeding maxSourceBytes", () => {
    const tiny = { ...defaultGuardrail(), selfHealPolicy: { ...defaultGuardrail().selfHealPolicy, maxSourceBytes: 50 } };
    expect(() =>
      svc.add({
        sessionId: "sess-1",
        name: "too_big",
        source: `async () => ({ ok: true, payload: "${"x".repeat(200)}" })`,
        guardrail: tiny,
      }),
    ).toThrow(HelperValidationError);
  });

  it("rejects helpers using process / eval / Function ctor", () => {
    for (const bad of [
      `async () => { process.exit(0) }`,
      `async () => { eval('1+1') }`,
      `async () => { return new Function('return 1')() }`,
    ]) {
      expect(() =>
        svc.add({ sessionId: "s", name: "bad", source: bad, guardrail: defaultGuardrail() }),
      ).toThrow(HelperValidationError);
    }
  });

  it("requires source to look like a function expression", () => {
    expect(() =>
      svc.add({ sessionId: "s", name: "bad", source: "let x = 1", guardrail: defaultGuardrail() }),
    ).toThrow(HelperValidationError);
  });
});
