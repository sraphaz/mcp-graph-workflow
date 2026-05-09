/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 2.5 — Substituir regression gate em finish-task
 *
 * AC1: GIVEN finish-task editado WHEN inspeciono linha 345 THEN chama Sentrux session_end advisory
 * AC2: GIVEN strict-mode branch removido WHEN inspeciono linhas 362-367 THEN ausente
 * AC3: GIVEN Sentrux retorna degradação WHEN finish_task roda THEN warn em response, status `done` ainda aplicado
 * AC4: GIVEN nenhum signal estático WHEN inspeciono blockers THEN nenhum item de origem estática
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runSentruxAdvisoryCheck } from "../core/pipeline/sentrux-advisory-check.js";
import { SentruxMcpAdapter } from "../core/integrations/sentrux-mcp-adapter.js";

const FINISH_TASK_PATH = join(process.cwd(), "src/core/pipeline/finish-task.ts");

// ---------------------------------------------------------------------------
// AC1 + AC2: structural checks on finish-task.ts source
// ---------------------------------------------------------------------------

describe("finish-task.ts source — AC1 & AC2: structural", () => {
  const source = readFileSync(FINISH_TASK_PATH, "utf-8");

  it("AC1: source references sentrux advisory check (not feature-depth static call)", () => {
    expect(source).toMatch(/sentrux.*advisory|runSentruxAdvisoryCheck/i);
  });

  it("AC2: strict-mode blockers promotion block is absent", () => {
    // The removed block contained: featureDepthReport.blockers and blockers.push
    // within the feature-depth section. Verify that pattern is gone.
    expect(source).not.toMatch(/featureDepthReport\.blockers\.length > 0/);
  });

  it("AC4: no static-origin items pushed to blockers from feature-depth", () => {
    // featureDepthReport.blockers should not be spread into the blockers array
    expect(source).not.toMatch(/blockers\.push\(\.\.\.featureDepthReport\.blockers\)/);
  });
});

// ---------------------------------------------------------------------------
// AC3: runSentruxAdvisoryCheck — advisory behavior (never blocks)
// ---------------------------------------------------------------------------

describe("runSentruxAdvisoryCheck — AC3: advisory behavior", () => {
  it("returns warned: false when session_end reports no degradation", async () => {
    const adapter = new SentruxMcpAdapter(async () => ({
      sessionId: "sess-1",
      endedAt: new Date().toISOString(),
      delta: {},
      issuesDelta: 0,
    }));
    const result = await runSentruxAdvisoryCheck(adapter, "sess-1");
    expect(result.warned).toBe(false);
  });

  it("returns warned: true when issuesDelta > 0 (degradation)", async () => {
    const adapter = new SentruxMcpAdapter(async () => ({
      sessionId: "sess-2",
      endedAt: new Date().toISOString(),
      delta: { issues: 5 },
      issuesDelta: 5,
    }));
    const result = await runSentruxAdvisoryCheck(adapter, "sess-2");
    expect(result.warned).toBe(true);
    expect(result.message).toBeTruthy();
  });

  it("never throws — returns warned: false when session_end fails", async () => {
    const adapter = new SentruxMcpAdapter(async () => {
      throw new Error("Sentrux unavailable");
    });
    const result = await runSentruxAdvisoryCheck(adapter, "sess-fail");
    expect(result.warned).toBe(false);
  });

  it("returns warned: false when sessionId is null (no active session)", async () => {
    const adapter = new SentruxMcpAdapter(async () => {
      throw new Error("should not be called");
    });
    const result = await runSentruxAdvisoryCheck(adapter, null);
    expect(result.warned).toBe(false);
  });

  it("includes issuesDelta in message when warned", async () => {
    const adapter = new SentruxMcpAdapter(async () => ({
      sessionId: "sess-3",
      endedAt: new Date().toISOString(),
      delta: {},
      issuesDelta: 3,
    }));
    const result = await runSentruxAdvisoryCheck(adapter, "sess-3");
    expect(result.message).toContain("3");
  });
});
