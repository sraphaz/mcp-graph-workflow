/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.5: Detector de drift contrato-código
 * AC1 — GIVEN interface alterada somente no código WHEN rodo scan THEN drift reportado com diff estruturado
 * AC2 — GIVEN interface alterada somente no grafo WHEN scan THEN drift reportado com lado divergente = "code-behind"
 * AC3 — GIVEN drift crítico e fase IMPLEMENT em strict WHEN finish_task THEN transição bloqueada com mensagem acionável
 */

import { describe, it, expect } from "vitest";
import {
  detectContractDrift,
  assertNoDrift,
  DriftBlockedError,
  type ContractSignature,
  type DriftReport,
} from "../../core/scaffolder/contract-drift-detector.js";

function sig(methods: Record<string, string>): ContractSignature {
  return { methods };
}

describe("AC1 — code-side change produces structured diff", () => {
  it("should report no drift when graph and code signatures are identical", () => {
    const graph = sig({ createUser: "(name: string) => User" });
    const code = sig({ createUser: "(name: string) => User" });
    const report = detectContractDrift("IUserService", graph, code);
    expect(report.hasDrift).toBe(false);
    expect(report.changes).toHaveLength(0);
  });

  it("should detect a method signature change in code", () => {
    const graph = sig({ createUser: "(name: string) => User" });
    const code = sig({ createUser: "(name: string, role: Role) => User" }); // code changed
    const report = detectContractDrift("IUserService", graph, code);
    expect(report.hasDrift).toBe(true);
    const change = report.changes.find((c) => c.method === "createUser");
    expect(change).toBeDefined();
    expect(change!.graphSignature).toBe("(name: string) => User");
    expect(change!.codeSignature).toBe("(name: string, role: Role) => User");
  });

  it("should detect a method added in code but missing in graph", () => {
    const graph = sig({ createUser: "(name: string) => User" });
    const code = sig({ createUser: "(name: string) => User", deleteUser: "(id: string) => void" });
    const report = detectContractDrift("IUserService", graph, code);
    expect(report.hasDrift).toBe(true);
    const added = report.changes.find((c) => c.method === "deleteUser");
    expect(added).toBeDefined();
    expect(added!.type).toBe("added_in_code");
  });

  it("should detect a method removed from code but still in graph", () => {
    const graph = sig({ createUser: "(name: string) => User", listUsers: "() => User[]" });
    const code = sig({ createUser: "(name: string) => User" });
    const report = detectContractDrift("IUserService", graph, code);
    expect(report.hasDrift).toBe(true);
    const removed = report.changes.find((c) => c.method === "listUsers");
    expect(removed).toBeDefined();
    expect(removed!.type).toBe("removed_from_code");
  });

  it("should include the contract name in the report", () => {
    const graph = sig({ m: "() => void" });
    const code = sig({ m: "() => string" });
    const report = detectContractDrift("MyContract", graph, code);
    expect(report.contractName).toBe("MyContract");
  });
});

describe("AC2 — graph-side change reports divergentSide=code-behind", () => {
  it("should set divergentSide=code-behind when graph has new method code does not", () => {
    const graph = sig({ create: "() => T", newMethod: "() => void" }); // graph updated
    const code = sig({ create: "() => T" }); // code not updated yet
    const report = detectContractDrift("IService", graph, code);
    expect(report.hasDrift).toBe(true);
    const change = report.changes.find((c) => c.method === "newMethod");
    expect(change!.divergentSide).toBe("code-behind");
  });

  it("should set divergentSide=graph-behind when code has new method graph does not", () => {
    const graph = sig({ create: "() => T" }); // graph not updated
    const code = sig({ create: "() => T", extra: "() => void" }); // code updated
    const report = detectContractDrift("IService", graph, code);
    const change = report.changes.find((c) => c.method === "extra");
    expect(change!.divergentSide).toBe("graph-behind");
  });

  it("should set divergentSide=both when signature differs in both directions", () => {
    const graph = sig({ m: "(a: string) => void" });
    const code = sig({ m: "(a: number) => Promise<void>" });
    const report = detectContractDrift("IService", graph, code);
    const change = report.changes.find((c) => c.method === "m");
    expect(change!.divergentSide).toBe("both");
  });

  it("should mark drift as critical when a previously declared method disappears from code", () => {
    const graph = sig({ required: "(id: string) => Entity" });
    const code = sig({}); // method gone from code
    const report = detectContractDrift("IRepo", graph, code);
    expect(report.hasDrift).toBe(true);
    expect(report.critical).toBe(true);
  });

  it("should not mark drift as critical for additions only", () => {
    const graph = sig({ create: "() => T" });
    const code = sig({ create: "() => T", extra: "() => void" });
    const report = detectContractDrift("IService", graph, code);
    expect(report.critical).toBe(false);
  });
});

describe("AC3 — critical drift in strict+IMPLEMENT blocks finish_task", () => {
  it("should throw DriftBlockedError when drift is critical, mode is strict, and phase is IMPLEMENT", () => {
    const report: DriftReport = {
      contractName: "IService",
      hasDrift: true,
      critical: true,
      changes: [{ method: "m", type: "removed_from_code", divergentSide: "code-behind" }],
    };
    expect(() =>
      assertNoDrift(report, { mode: "strict", phase: "IMPLEMENT" }),
    ).toThrow(DriftBlockedError);
  });

  it("should not throw in advisory mode even with critical drift", () => {
    const report: DriftReport = {
      contractName: "IService",
      hasDrift: true,
      critical: true,
      changes: [{ method: "m", type: "removed_from_code", divergentSide: "code-behind" }],
    };
    expect(() =>
      assertNoDrift(report, { mode: "advisory", phase: "IMPLEMENT" }),
    ).not.toThrow();
  });

  it("should not throw when drift is not critical even in strict mode", () => {
    const report: DriftReport = {
      contractName: "IService",
      hasDrift: true,
      critical: false,
      changes: [{ method: "extra", type: "added_in_code", divergentSide: "graph-behind" }],
    };
    expect(() =>
      assertNoDrift(report, { mode: "strict", phase: "IMPLEMENT" }),
    ).not.toThrow();
  });

  it("should include actionable message in DriftBlockedError", () => {
    const report: DriftReport = {
      contractName: "IRepo",
      hasDrift: true,
      critical: true,
      changes: [{ method: "findById", type: "removed_from_code", divergentSide: "code-behind" }],
    };
    let err: unknown;
    try {
      assertNoDrift(report, { mode: "strict", phase: "IMPLEMENT" });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(DriftBlockedError);
    const msg = (err as DriftBlockedError).message;
    expect(msg).toContain("IRepo");
    expect(msg).toMatch(/drift|update|sync/i);
  });

  it("should not block when there is no drift at all", () => {
    const report: DriftReport = {
      contractName: "IService",
      hasDrift: false,
      critical: false,
      changes: [],
    };
    expect(() =>
      assertNoDrift(report, { mode: "strict", phase: "IMPLEMENT" }),
    ).not.toThrow();
  });
});
