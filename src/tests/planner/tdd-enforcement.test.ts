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

/**
 * Task 9.3: Enforcement "teste antes do codigo" — node_26ab194fdc59
 *
 * AC1: code file committed without preceding test → blocked in strict with list
 * AC2: test and code in same commit → acceptable with educational warning
 * AC3: purely declarative files (types) → exempt via configurable whitelist
 */

import { describe, it, expect } from "vitest";
import { checkTddEnforcement, DEFAULT_DECLARATIVE_WHITELIST } from "../../core/planner/tdd-enforcement.js";
import type { TddEnforcementContext } from "../../core/planner/tdd-enforcement.js";

function makeCtx(partial: Partial<TddEnforcementContext>): TddEnforcementContext {
  return {
    touchedFiles: [],
    commitHistory: [],
    mode: "strict",
    declarativeWhitelist: [],
    ...partial,
  };
}

// ── AC1: strict blocks code without preceding test ────────────────
describe("checkTddEnforcement — AC1: strict blocks missing test commits", () => {
  it("should block when a code file has no preceding test commit", () => {
    const ctx = makeCtx({
      touchedFiles: ["src/core/foo.ts"],
      commitHistory: [
        { hash: "abc1", timestamp: "2026-01-02T00:00:00Z", files: ["src/core/foo.ts"] },
      ],
      mode: "strict",
    });
    const result = checkTddEnforcement(ctx);
    expect(result.blocked).toBe(true);
  });

  it("should list the offending file in violations", () => {
    const ctx = makeCtx({
      touchedFiles: ["src/core/bar.ts"],
      commitHistory: [
        { hash: "abc2", timestamp: "2026-01-02T00:00:00Z", files: ["src/core/bar.ts"] },
      ],
      mode: "strict",
    });
    const result = checkTddEnforcement(ctx);
    expect(result.violations).toContain("src/core/bar.ts");
  });

  it("should not block when a test commit precedes the code commit", () => {
    const ctx = makeCtx({
      touchedFiles: ["src/core/baz.ts"],
      commitHistory: [
        { hash: "t1", timestamp: "2026-01-01T00:00:00Z", files: ["src/tests/baz.test.ts"] },
        { hash: "c1", timestamp: "2026-01-02T00:00:00Z", files: ["src/core/baz.ts"] },
      ],
      mode: "strict",
    });
    const result = checkTddEnforcement(ctx);
    expect(result.blocked).toBe(false);
    expect(result.violations).toHaveLength(0);
  });

  it("should not block in advisory mode with missing test", () => {
    const ctx = makeCtx({
      touchedFiles: ["src/core/qux.ts"],
      commitHistory: [
        { hash: "c2", timestamp: "2026-01-02T00:00:00Z", files: ["src/core/qux.ts"] },
      ],
      mode: "advisory",
    });
    const result = checkTddEnforcement(ctx);
    expect(result.blocked).toBe(false);
  });
});

// ── AC2: same commit is acceptable with warning ───────────────────
describe("checkTddEnforcement — AC2: same commit gets educational warning", () => {
  it("should not block when test and code are in the same commit", () => {
    const ctx = makeCtx({
      touchedFiles: ["src/core/svc.ts"],
      commitHistory: [
        {
          hash: "sc1",
          timestamp: "2026-01-01T00:00:00Z",
          files: ["src/tests/svc.test.ts", "src/core/svc.ts"],
        },
      ],
      mode: "strict",
    });
    const result = checkTddEnforcement(ctx);
    expect(result.blocked).toBe(false);
  });

  it("should emit an educational warning for same-commit test+code", () => {
    const ctx = makeCtx({
      touchedFiles: ["src/core/svc.ts"],
      commitHistory: [
        {
          hash: "sc2",
          timestamp: "2026-01-01T00:00:00Z",
          files: ["src/tests/svc.test.ts", "src/core/svc.ts"],
        },
      ],
      mode: "strict",
    });
    const result = checkTddEnforcement(ctx);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w: string) => w.includes("svc.ts"))).toBe(true);
  });
});

// ── AC3: declarative files are exempt ────────────────────────────
describe("checkTddEnforcement — AC3: declarative whitelist exemption", () => {
  it("should exempt *.d.ts files by default", () => {
    const ctx = makeCtx({
      touchedFiles: ["src/types/foo.d.ts"],
      commitHistory: [
        { hash: "d1", timestamp: "2026-01-01T00:00:00Z", files: ["src/types/foo.d.ts"] },
      ],
      mode: "strict",
      declarativeWhitelist: DEFAULT_DECLARATIVE_WHITELIST,
    });
    const result = checkTddEnforcement(ctx);
    expect(result.blocked).toBe(false);
    expect(result.exempted).toContain("src/types/foo.d.ts");
  });

  it("should exempt custom whitelist patterns", () => {
    const ctx = makeCtx({
      touchedFiles: ["src/schemas/node.schema.ts"],
      commitHistory: [
        { hash: "s1", timestamp: "2026-01-01T00:00:00Z", files: ["src/schemas/node.schema.ts"] },
      ],
      mode: "strict",
      declarativeWhitelist: ["**/*.schema.ts"],
    });
    const result = checkTddEnforcement(ctx);
    expect(result.blocked).toBe(false);
    expect(result.exempted).toContain("src/schemas/node.schema.ts");
  });

  it("should not exempt a non-matching file", () => {
    const ctx = makeCtx({
      touchedFiles: ["src/core/regular.ts"],
      commitHistory: [
        { hash: "r1", timestamp: "2026-01-01T00:00:00Z", files: ["src/core/regular.ts"] },
      ],
      mode: "strict",
      declarativeWhitelist: ["**/*.d.ts"],
    });
    const result = checkTddEnforcement(ctx);
    expect(result.violations).toContain("src/core/regular.ts");
    expect(result.exempted).not.toContain("src/core/regular.ts");
  });

  it("should pass in off mode regardless of commit history", () => {
    const ctx = makeCtx({
      touchedFiles: ["src/core/anything.ts"],
      commitHistory: [
        { hash: "off1", timestamp: "2026-01-01T00:00:00Z", files: ["src/core/anything.ts"] },
      ],
      mode: "off",
    });
    const result = checkTddEnforcement(ctx);
    expect(result.blocked).toBe(false);
    expect(result.violations).toHaveLength(0);
  });
});
