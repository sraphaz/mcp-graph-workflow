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
import { SqliteStore } from "../core/store/sqlite-store.js";
import { makeNode } from "./helpers/factories.js";
import { checkDefinitionOfDone } from "../core/implementer/definition-of-done.js";

describe("testFiles field", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("TestFiles Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should round-trip testFiles through store", () => {
    const node = makeNode({
      testFiles: ["src/tests/foo.test.ts", "src/tests/bar.test.ts"],
      acceptanceCriteria: ["deve funcionar"],
    });
    store.insertNode(node);

    const retrieved = store.getNodeById(node.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.testFiles).toEqual(["src/tests/foo.test.ts", "src/tests/bar.test.ts"]);
  });

  it("should update testFiles via updateNode", () => {
    const node = makeNode({ acceptanceCriteria: ["deve funcionar"] });
    store.insertNode(node);

    store.updateNode(node.id, { testFiles: ["src/tests/new.test.ts"] });

    const updated = store.getNodeById(node.id);
    expect(updated!.testFiles).toEqual(["src/tests/new.test.ts"]);
  });

  it("should return undefined testFiles when not set", () => {
    const node = makeNode();
    store.insertNode(node);

    const retrieved = store.getNodeById(node.id);
    expect(retrieved!.testFiles).toBeUndefined();
  });

  it("should include has_test_files check in definition of done", () => {
    const withFiles = makeNode({
      id: "with-files",
      status: "in_progress",
      testFiles: ["src/tests/foo.test.ts"],
      acceptanceCriteria: ["deve retornar status 200"],
    });
    const withoutFiles = makeNode({
      id: "without-files",
      status: "in_progress",
      acceptanceCriteria: ["deve retornar status 200"],
    });
    store.insertNode(withFiles);
    store.insertNode(withoutFiles);

    const doc = store.toGraphDocument();

    const reportWith = checkDefinitionOfDone(doc, "with-files");
    const reportWithout = checkDefinitionOfDone(doc, "without-files");

    const checkWith = reportWith.checks.find((c) => c.name === "has_test_files");
    const checkWithout = reportWithout.checks.find((c) => c.name === "has_test_files");

    expect(checkWith).toBeDefined();
    expect(checkWith!.passed).toBe(true);
    expect(checkWith!.severity).toBe("recommended");

    expect(checkWithout).toBeDefined();
    expect(checkWithout!.passed).toBe(false);
  });
});
