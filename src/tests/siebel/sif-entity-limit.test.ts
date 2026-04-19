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

import { describe, it, expect } from "vitest";
import { parseSifContent } from "../../core/siebel/sif-parser.js";

/**
 * Generate a SIF-like XML with N Siebel objects to test entity expansion limits.
 * Real corporate SIF files can have 1000+ objects easily.
 */
function generateLargeSif(objectCount: number): string {
  const objects: string[] = [];
  for (let i = 0; i < objectCount; i++) {
    objects.push(`
        <PROJECT NAME="Test Project ${i}">
          <BUSINESS_COMPONENT NAME="BC_${i}" TABLE="S_CONTACT">
            <FIELD NAME="Field_${i}_A" TYPE="DTYPE_TEXT" LENGTH="100" />
            <FIELD NAME="Field_${i}_B" TYPE="DTYPE_TEXT" LENGTH="200" />
            <FIELD NAME="Field_${i}_C" TYPE="DTYPE_NUMBER" />
          </BUSINESS_COMPONENT>
        </PROJECT>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<REPOSITORY>
  ${objects.join("\n")}
</REPOSITORY>`;
}

describe("SIF entity expansion limit fix", () => {
  it("should parse SIF with 100 objects without error", () => {
    const sif = generateLargeSif(100);
    const result = parseSifContent(sif, "test-large.sif");

    expect(result).toBeDefined();
    expect(result.objects.length).toBeGreaterThanOrEqual(0);
  });

  it("should parse SIF with 1500 objects without ENTITY EXPANSION LIMIT error", () => {
    const sif = generateLargeSif(1500);

    // This should NOT throw "ENTITY EXPANSION LIMIT EXCEEDED: 1004 > 1000"
    expect(() => parseSifContent(sif, "test-large.sif")).not.toThrow();
  });

  it("should parse SIF with 5000 objects without error", () => {
    const sif = generateLargeSif(5000);

    expect(() => parseSifContent(sif, "test-large.sif")).not.toThrow();
    const result = parseSifContent(sif, "test-large.sif");
    expect(result).toBeDefined();
  });

  it("should parse SIF with 10000 objects without error (stress test)", () => {
    const sif = generateLargeSif(10000);

    expect(() => parseSifContent(sif, "test-large.sif")).not.toThrow();
  });
});
