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
import { GradeSchema } from "../schemas/grade-schema.js";

describe("GradeSchema", () => {
  it("should accept valid grades", () => {
    for (const grade of ["A", "B", "C", "D", "F"]) {
      expect(GradeSchema.parse(grade)).toBe(grade);
    }
  });

  it("should reject invalid grades", () => {
    expect(() => GradeSchema.parse("E")).toThrow();
    expect(() => GradeSchema.parse("a")).toThrow();
    expect(() => GradeSchema.parse("")).toThrow();
    expect(() => GradeSchema.parse(1)).toThrow();
  });
});
