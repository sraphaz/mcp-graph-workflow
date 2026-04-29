/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { agentInputSchema, buildAgentHandler } from "../mcp/tools/agent.js";

function createStore(): SqliteStore {
  const store = SqliteStore.open(":memory:");
  store.initProject("agent-tool-test");
  return store;
}

describe("agentInputSchema — validation", () => {
  it("rejects missing action", () => {
    expect(agentInputSchema.safeParse({}).success).toBe(false);
  });

  it("rejects unknown action", () => {
    expect(agentInputSchema.safeParse({ action: "destroy" }).success).toBe(false);
  });

  it("accepts action: list", () => {
    expect(agentInputSchema.safeParse({ action: "list" }).success).toBe(true);
  });

  it("accepts action: describe with agentName", () => {
    expect(agentInputSchema.safeParse({ action: "describe", agentName: "prd-analyst" }).success).toBe(true);
  });

  it("accepts action: metrics", () => {
    expect(agentInputSchema.safeParse({ action: "metrics" }).success).toBe(true);
  });

  it("accepts action: spawn with agentName and phase", () => {
    expect(agentInputSchema.safeParse({ action: "spawn", agentName: "coder", phase: "IMPLEMENT" }).success).toBe(true);
  });
});

describe("agent handler — list", () => {
  let store: SqliteStore;

  beforeEach(() => { store = createStore(); });
  afterEach(() => { store.close(); });

  it("list returns ok:true and agents array", async () => {
    const handler = buildAgentHandler(store);
    const result = await handler({ action: "list" });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(true);
    expect(Array.isArray(parsed.agents)).toBe(true);
  });
});

describe("agent handler — describe", () => {
  let store: SqliteStore;

  beforeEach(() => { store = createStore(); });
  afterEach(() => { store.close(); });

  it("describe returns error when agentName missing", async () => {
    const handler = buildAgentHandler(store);
    const result = await handler({ action: "describe" });
    expect(result.isError).toBe(true);
  });

  it("describe returns ok for known agent name (claude)", async () => {
    const handler = buildAgentHandler(store);
    const result = await handler({ action: "describe", agentName: "claude" });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(true);
  });

  it("describe returns error for unknown agent", async () => {
    const handler = buildAgentHandler(store);
    const result = await handler({ action: "describe", agentName: "nonexistent-xyz" });
    expect(result.isError).toBe(true);
  });
});

describe("agent handler — metrics", () => {
  let store: SqliteStore;

  beforeEach(() => { store = createStore(); });
  afterEach(() => { store.close(); });

  it("metrics returns ok:true and summary object", async () => {
    const handler = buildAgentHandler(store);
    const result = await handler({ action: "metrics" });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.ok).toBe(true);
    expect(parsed.summary).toBeDefined();
  });
});

describe("agent handler — spawn phase validation", () => {
  let store: SqliteStore;

  beforeEach(() => { store = createStore(); });
  afterEach(() => { store.close(); });

  it("spawn succeeds when phase is IMPLEMENT", async () => {
    store.setProjectSetting("lifecycle_phase_override", "IMPLEMENT");
    const handler = buildAgentHandler(store);
    const result = await handler({ action: "spawn", agentName: "coder", phase: "IMPLEMENT" });
    expect(result.isError).toBeFalsy();
  });

  it("spawn succeeds when phase is VALIDATE", async () => {
    store.setProjectSetting("lifecycle_phase_override", "VALIDATE");
    const handler = buildAgentHandler(store);
    const result = await handler({ action: "spawn", agentName: "qa-validator", phase: "VALIDATE" });
    expect(result.isError).toBeFalsy();
  });

  it("spawn returns error when current phase is ANALYZE (spawn not allowed)", async () => {
    store.setProjectSetting("lifecycle_phase_override", "ANALYZE");
    const handler = buildAgentHandler(store);
    const result = await handler({ action: "spawn", agentName: "prd-analyst", phase: "ANALYZE" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/phase/i);
  });

  it("spawn returns error when agentName is missing", async () => {
    const handler = buildAgentHandler(store);
    const result = await handler({ action: "spawn" });
    expect(result.isError).toBe(true);
  });
});
