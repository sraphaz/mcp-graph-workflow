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
import { now } from "../core/utils/time.js";

describe("now", () => {
  it("should return an ISO 8601 string", () => {
    const result = now();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("should be parseable back to a valid Date", () => {
    const result = now();
    const parsed = new Date(result);
    expect(parsed.toString()).not.toBe("Invalid Date");
    expect(parsed.getTime()).not.toBeNaN();
  });

  it("should return a value close to Date.now() (within 1s)", () => {
    const before = Date.now();
    const result = now();
    const after = Date.now();
    const parsed = new Date(result).getTime();
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });

  it("should produce monotonically non-decreasing timestamps in rapid succession", () => {
    const a = new Date(now()).getTime();
    const b = new Date(now()).getTime();
    expect(b).toBeGreaterThanOrEqual(a);
  });
});
