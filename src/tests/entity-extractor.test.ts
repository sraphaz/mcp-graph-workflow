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
 * Pure-function tests for entity-extractor — focused on the regex patterns
 * and dedup behavior of `extractEntitiesFromText` and `extractRelationsFromText`.
 *
 * Entity-store integration tests in `entity-kg.test.ts` exercise extractor
 * outputs through the indexing pipeline; this file tests the extractor in
 * isolation so a regex regression is caught before it reaches the indexer.
 */

import { describe, it, expect } from "vitest";
import {
  extractEntitiesFromText,
  extractRelationsFromText,
} from "../core/rag/entity-extractor.js";

describe("extractEntitiesFromText", () => {
  it("should return empty array for empty input", () => {
    expect(extractEntitiesFromText("")).toEqual([]);
  });

  it("should return empty array for plain prose without identifiers", () => {
    expect(extractEntitiesFromText("hello world")).toEqual([]);
  });

  it("should detect a known technology term", () => {
    const result = extractEntitiesFromText("we use React for the dashboard");
    const names = result.map((e) => e.name.toLowerCase());
    expect(names).toContain("react");
  });

  it("should classify technology terms as type 'technology' (not 'class')", () => {
    const result = extractEntitiesFromText("React is great");
    const reactEntity = result.find(
      (e) => e.name.toLowerCase() === "react",
    );
    expect(reactEntity?.type).toBe("technology");
  });

  it("should detect PascalCase identifiers as class", () => {
    const result = extractEntitiesFromText("class UserService extends BaseClass");
    const types = result.filter((e) => e.type === "class").map((e) => e.name);
    expect(types).toContain("UserService");
    expect(types).toContain("BaseClass");
  });

  it("should detect camelCase identifiers as function", () => {
    const result = extractEntitiesFromText("call findNextTask() then buildTaskContext()");
    const fns = result.filter((e) => e.type === "function").map((e) => e.name);
    expect(fns).toContain("findNextTask");
    expect(fns).toContain("buildTaskContext");
  });

  it("should dedupe identical (name, type) pairs", () => {
    const result = extractEntitiesFromText("React React React");
    const reactCount = result.filter(
      (e) => e.name.toLowerCase() === "react",
    ).length;
    expect(reactCount).toBe(1);
  });

  it("should handle trailing punctuation on technology terms", () => {
    const result = extractEntitiesFromText("React. is the choice");
    const names = result.map((e) => e.name.toLowerCase());
    expect(names).toContain("react");
  });

  it("should detect scoped npm packages", () => {
    const result = extractEntitiesFromText("import { z } from '@anthropic/sdk'");
    const pkgs = result.filter((e) => e.type === "package").map((e) => e.name);
    expect(pkgs).toContain("@anthropic/sdk");
  });

  it("should detect file paths", () => {
    const result = extractEntitiesFromText("see src/core/store/migrations.ts for details");
    const files = result.filter((e) => e.type === "file");
    expect(files.length).toBeGreaterThan(0);
  });
});

describe("extractRelationsFromText", () => {
  it("should return empty array when no entities are present", () => {
    const result = extractRelationsFromText("hello world", []);
    expect(result).toEqual([]);
  });

  it("should return empty array when entities list is empty", () => {
    const result = extractRelationsFromText(
      "UserService extends BaseClass",
      [],
    );
    expect(result).toEqual([]);
  });

  it("should not throw on arbitrary text input", () => {
    expect(() => extractRelationsFromText("any text here", [])).not.toThrow();
  });
});
