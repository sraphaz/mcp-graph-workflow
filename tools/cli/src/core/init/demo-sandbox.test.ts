/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createDemoSandbox } from "./demo-sandbox.js";

describe("createDemoSandbox", () => {
  it("creates a fresh sandbox dir with PRD.md and workflow-graph", () => {
    const sandbox = createDemoSandbox();
    try {
      expect(existsSync(sandbox.path)).toBe(true);
      expect(existsSync(`${sandbox.path}/PRD.md`)).toBe(true);
      expect(existsSync(`${sandbox.path}/workflow-graph`)).toBe(true);
      expect(readFileSync(`${sandbox.path}/PRD.md`, "utf8")).toContain(
        "Sample PRD",
      );
    } finally {
      sandbox.cleanup();
    }
  });

  it("yields unique paths across calls (timestamp + random slug)", () => {
    const a = createDemoSandbox();
    const b = createDemoSandbox();
    try {
      expect(a.path).not.toBe(b.path);
    } finally {
      a.cleanup();
      b.cleanup();
    }
  });

  it("cleanup removes the directory and is idempotent", () => {
    const sandbox = createDemoSandbox();
    expect(existsSync(sandbox.path)).toBe(true);
    sandbox.cleanup();
    expect(existsSync(sandbox.path)).toBe(false);
    expect(() => sandbox.cleanup()).not.toThrow();
  });
});
