/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { checkDefinitionOfDone } from "../core/implementer/definition-of-done.js";
import type { GraphDocument, GraphNode } from "../core/graph/graph-types.js";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function makeDocWithTouched(touchedFiles: string[]): GraphDocument {
  const node: GraphNode = {
    id: "task_1",
    type: "task",
    title: "core change",
    status: "in_progress",
    priority: 3,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    description: "x",
    acceptanceCriteria: ["does X measurably"],
    metadata: { touchedFiles },
    xpSize: "S",
  } as GraphNode;
  return {
    version: "1.0",
    project: { id: "p", name: "t", createdAt: "x", updatedAt: "x" },
    nodes: [node],
    edges: [],
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
    meta: { sourceFiles: [], lastImport: null },
  };
}

describe("DoD has_citations_in_new_core_files", () => {
  let tmp: string;
  let prevCwd: string;

  beforeEach(() => {
    prevCwd = process.cwd();
    tmp = mkdtempSync(join(tmpdir(), "dod-citations-"));
    mkdirSync(join(tmp, "src/core"), { recursive: true });
    process.chdir(tmp);
  });

  afterEach(() => {
    process.chdir(prevCwd);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("passes when there are no core files touched (N/A)", () => {
    const doc = makeDocWithTouched([]);
    const report = checkDefinitionOfDone(doc, "task_1");
    const check = report.checks.find((c) => c.name === "has_citations_in_new_core_files");
    expect(check).toBeDefined();
    expect(check?.passed).toBe(true);
    expect(check?.details).toMatch(/N\/A/);
  });

  it("passes when every touched core file contains a §EPIC citation", () => {
    writeFileSync(join(tmp, "src/core/foo.ts"), "// §EPIC-13.2 ok\nexport const x = 1;");
    const doc = makeDocWithTouched(["src/core/foo.ts"]);
    const report = checkDefinitionOfDone(doc, "task_1");
    const check = report.checks.find((c) => c.name === "has_citations_in_new_core_files");
    expect(check?.passed).toBe(true);
  });

  it("fails when a touched core file is missing a citation", () => {
    writeFileSync(join(tmp, "src/core/foo.ts"), "export const x = 1;");
    const doc = makeDocWithTouched(["src/core/foo.ts"]);
    const report = checkDefinitionOfDone(doc, "task_1");
    const check = report.checks.find((c) => c.name === "has_citations_in_new_core_files");
    expect(check?.passed).toBe(false);
    expect(check?.details).toMatch(/sem citation/);
  });

  it("ignores non-core touched files", () => {
    mkdirSync(join(tmp, "src/cli"), { recursive: true });
    writeFileSync(join(tmp, "src/cli/index.ts"), "no ref");
    const doc = makeDocWithTouched(["src/cli/index.ts"]);
    const report = checkDefinitionOfDone(doc, "task_1");
    const check = report.checks.find((c) => c.name === "has_citations_in_new_core_files");
    expect(check?.passed).toBe(true);
    expect(check?.details).toMatch(/N\/A/);
  });

  it("is severity:recommended (does not block ready)", () => {
    writeFileSync(join(tmp, "src/core/foo.ts"), "export const x = 1;");
    const doc = makeDocWithTouched(["src/core/foo.ts"]);
    const report = checkDefinitionOfDone(doc, "task_1");
    const check = report.checks.find((c) => c.name === "has_citations_in_new_core_files");
    expect(check?.severity).toBe("recommended");
  });
});
