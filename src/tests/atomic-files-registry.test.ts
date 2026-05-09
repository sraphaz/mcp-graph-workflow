/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 2.1 — Registry central de atomic files
 *
 * AC1: GIVEN feature chama registerAtomicFile WHEN init roda THEN arquivo é processado
 * AC2: GIVEN dois arquivos com mesmo fileId WHEN registro THEN throw duplicate_file_id
 * AC3: GIVEN registry WHEN inspecionado em runtime THEN lista todos cadastrados
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  registerAtomicFile,
  getRegistry,
  clearRegistry,
} from "../core/atomic-files/registry.js";
import type { AtomicFile } from "../core/atomic-files/types.js";

function makeFile(fileId: string, path = `/tmp/${fileId}.md`): AtomicFile {
  return {
    fileId,
    path,
    format: "markdown",
    managedContent: `# ${fileId}`,
  };
}

beforeEach(() => {
  clearRegistry();
});

// ---------------------------------------------------------------------------
// AC1: registered file is present in the registry
// ---------------------------------------------------------------------------

describe("registerAtomicFile — AC1: file is processed by init", () => {
  it("registered file appears in getRegistry()", () => {
    const file = makeFile("changelog");
    registerAtomicFile(file);
    const registry = getRegistry();
    expect(registry.some((f) => f.fileId === "changelog")).toBe(true);
  });

  it("registered file preserves all fields", () => {
    const file = makeFile("readme", "/project/README.md");
    registerAtomicFile(file);
    const found = getRegistry().find((f) => f.fileId === "readme");
    expect(found).toBeDefined();
    expect(found?.path).toBe("/project/README.md");
    expect(found?.format).toBe("markdown");
  });

  it("multiple files can be registered independently", () => {
    registerAtomicFile(makeFile("file-a"));
    registerAtomicFile(makeFile("file-b"));
    registerAtomicFile(makeFile("file-c"));
    const registry = getRegistry();
    expect(registry).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// AC2: duplicate fileId throws
// ---------------------------------------------------------------------------

describe("registerAtomicFile — AC2: duplicate fileId throws", () => {
  it("throws when registering the same fileId twice", () => {
    registerAtomicFile(makeFile("shared-id"));
    expect(() => registerAtomicFile(makeFile("shared-id"))).toThrow();
  });

  it("thrown error message includes 'duplicate_file_id'", () => {
    registerAtomicFile(makeFile("dup-id"));
    expect(() => registerAtomicFile(makeFile("dup-id"))).toThrowError(
      /duplicate_file_id/,
    );
  });

  it("registry remains unchanged after duplicate attempt", () => {
    registerAtomicFile(makeFile("stable"));
    try {
      registerAtomicFile(makeFile("stable"));
    } catch {
      // expected
    }
    expect(getRegistry()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// AC3: runtime inspection lists all registered files
// ---------------------------------------------------------------------------

describe("getRegistry — AC3: lists all registered files", () => {
  it("returns empty array when nothing is registered", () => {
    expect(getRegistry()).toEqual([]);
  });

  it("returns a snapshot (not the internal reference)", () => {
    registerAtomicFile(makeFile("snap-test"));
    const r1 = getRegistry();
    const r2 = getRegistry();
    expect(r1).not.toBe(r2); // different references
    expect(r1).toEqual(r2);  // same contents
  });

  it("clearRegistry resets the list to empty", () => {
    registerAtomicFile(makeFile("to-be-cleared"));
    clearRegistry();
    expect(getRegistry()).toHaveLength(0);
  });
});
