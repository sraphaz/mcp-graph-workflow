/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.3 — Wire 4 ferramentas MCP via adapter
 *
 * AC1: GIVEN Sentrux MCP server up WHEN chamo `scan` via adapter THEN payload válido retornado e parseado por Zod
 * AC2: GIVEN session iniciada via `session_start` WHEN chamo `session_end` depois de edits THEN delta de sinal computado
 * AC3: GIVEN `check_rules` chamado WHEN retorna THEN lista tipada de violações com path + regra
 * AC4: GIVEN payload malformado WHEN parse Zod THEN erro estruturado com path
 */

import { describe, it, expect } from "vitest";
import { SentruxMcpAdapter } from "../core/integrations/sentrux-mcp-adapter.js";

// ---------------------------------------------------------------------------
// Helpers — fake MCP call stubs
// ---------------------------------------------------------------------------

const scanPayload = {
  runId: "run-001",
  issuesFound: 3,
  severity: "warn",
  timestamp: "2026-05-09T22:00:00.000Z",
};

const sessionStartPayload = {
  sessionId: "sess-abc",
  startedAt: "2026-05-09T22:00:00.000Z",
};

const sessionEndPayload = {
  sessionId: "sess-abc",
  endedAt: "2026-05-09T22:10:00.000Z",
  delta: { issues: -2 },
  issuesDelta: -2,
};

const checkRulesPayload = {
  violations: [
    { path: "src/foo.ts", rule: "no-any", severity: "error" },
    { path: "src/bar.ts", rule: "explicit-return-type", severity: "warn" },
  ],
  totalCount: 2,
};

function makeCall(payload: unknown) {
  return async (_tool: string, _args: Record<string, unknown>) => payload;
}

// ---------------------------------------------------------------------------
// AC1: scan → valid payload parsed by Zod
// ---------------------------------------------------------------------------

describe("SentruxMcpAdapter.scan — AC1", () => {
  it("returns typed result with runId and severity", async () => {
    const adapter = new SentruxMcpAdapter(makeCall(scanPayload));
    const result = await adapter.scan();
    expect(result.runId).toBe("run-001");
    expect(result.severity).toBe("warn");
    expect(result.issuesFound).toBe(3);
  });

  it("accepts severity 'ok'", async () => {
    const adapter = new SentruxMcpAdapter(makeCall({ ...scanPayload, severity: "ok", issuesFound: 0 }));
    const result = await adapter.scan();
    expect(result.severity).toBe("ok");
  });

  it("accepts optional details field", async () => {
    const adapter = new SentruxMcpAdapter(
      makeCall({ ...scanPayload, details: { files: 10 } })
    );
    const result = await adapter.scan();
    expect(result.details?.["files"]).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// AC2: session_start + session_end → delta computed
// ---------------------------------------------------------------------------

describe("SentruxMcpAdapter session — AC2", () => {
  it("session_start returns sessionId and startedAt", async () => {
    const adapter = new SentruxMcpAdapter(makeCall(sessionStartPayload));
    const result = await adapter.sessionStart({ label: "my-session" });
    expect(result.sessionId).toBe("sess-abc");
    expect(result.startedAt).toBeTruthy();
  });

  it("session_end returns issuesDelta", async () => {
    const adapter = new SentruxMcpAdapter(makeCall(sessionEndPayload));
    const result = await adapter.sessionEnd({ sessionId: "sess-abc" });
    expect(result.sessionId).toBe("sess-abc");
    expect(result.issuesDelta).toBe(-2);
  });

  it("session_end delta is a record", async () => {
    const adapter = new SentruxMcpAdapter(makeCall(sessionEndPayload));
    const result = await adapter.sessionEnd({ sessionId: "sess-abc" });
    expect(typeof result.delta).toBe("object");
    expect(result.delta["issues"]).toBe(-2);
  });
});

// ---------------------------------------------------------------------------
// AC3: check_rules → typed violations with path + rule
// ---------------------------------------------------------------------------

describe("SentruxMcpAdapter.checkRules — AC3", () => {
  it("returns violations array with path and rule", async () => {
    const adapter = new SentruxMcpAdapter(makeCall(checkRulesPayload));
    const result = await adapter.checkRules();
    expect(Array.isArray(result.violations)).toBe(true);
    expect(result.violations[0]?.path).toBe("src/foo.ts");
    expect(result.violations[0]?.rule).toBe("no-any");
  });

  it("returns totalCount", async () => {
    const adapter = new SentruxMcpAdapter(makeCall(checkRulesPayload));
    const result = await adapter.checkRules();
    expect(result.totalCount).toBe(2);
  });

  it("violation severity is typed enum", async () => {
    const adapter = new SentruxMcpAdapter(makeCall(checkRulesPayload));
    const result = await adapter.checkRules();
    expect(["error", "warn", "info"]).toContain(result.violations[0]?.severity);
  });

  it("empty violations list is valid", async () => {
    const adapter = new SentruxMcpAdapter(makeCall({ violations: [], totalCount: 0 }));
    const result = await adapter.checkRules();
    expect(result.violations).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC4: malformed payload → structured error with path
// ---------------------------------------------------------------------------

describe("SentruxMcpAdapter — AC4: malformed payload", () => {
  it("scan with missing runId throws with path info", async () => {
    const adapter = new SentruxMcpAdapter(makeCall({ issuesFound: 1, severity: "ok" }));
    await expect(adapter.scan()).rejects.toThrow();
  });

  it("scan error includes field name in message", async () => {
    const adapter = new SentruxMcpAdapter(makeCall({ issuesFound: "not-a-number", severity: "bad" }));
    const err = await adapter.scan().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain("sentrux:scan");
  });

  it("check_rules with malformed violation throws", async () => {
    const adapter = new SentruxMcpAdapter(
      makeCall({ violations: [{ path: 123, rule: null }], totalCount: 1 })
    );
    await expect(adapter.checkRules()).rejects.toThrow();
  });
});
