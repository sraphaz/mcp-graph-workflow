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
import { scoreToGrade } from "../core/utils/grading.js";
import type { Grade } from "../core/utils/grading.js";

describe("scoreToGrade", () => {
  it("should return A for scores >= 90", () => {
    expect(scoreToGrade(90)).toBe("A");
    expect(scoreToGrade(95)).toBe("A");
    expect(scoreToGrade(100)).toBe("A");
  });

  it("should return B for scores 75-89", () => {
    expect(scoreToGrade(75)).toBe("B");
    expect(scoreToGrade(89)).toBe("B");
  });

  it("should return C for scores 60-74", () => {
    expect(scoreToGrade(60)).toBe("C");
    expect(scoreToGrade(74)).toBe("C");
  });

  it("should return D for scores 40-59", () => {
    expect(scoreToGrade(40)).toBe("D");
    expect(scoreToGrade(59)).toBe("D");
  });

  it("should return F for scores < 40", () => {
    expect(scoreToGrade(39)).toBe("F");
    expect(scoreToGrade(0)).toBe("F");
  });

  it("should return correct type Grade", () => {
    const grade: Grade = scoreToGrade(85);
    expect(["A", "B", "C", "D", "F"]).toContain(grade);
  });
});
