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
import { OpenFolderBodySchema } from "../schemas/folder.schema.js";

describe("OpenFolderBodySchema", () => {
  it("should accept a non-empty path", () => {
    const result = OpenFolderBodySchema.safeParse({ path: "/Users/me/project" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.path).toBe("/Users/me/project");
  });

  it("should reject empty string with the configured message", () => {
    const result = OpenFolderBodySchema.safeParse({ path: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Path is required");
    }
  });

  it("should reject missing path field", () => {
    const result = OpenFolderBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("should reject paths over the 2000-char hard cap", () => {
    const huge = "/" + "a".repeat(2100);
    const result = OpenFolderBodySchema.safeParse({ path: huge });
    expect(result.success).toBe(false);
  });

  it("should reject non-string path values", () => {
    const result = OpenFolderBodySchema.safeParse({ path: 42 });
    expect(result.success).toBe(false);
  });

  it("should accept the boundary value (exactly 2000 chars)", () => {
    const exactlyBound = "a".repeat(2000);
    const result = OpenFolderBodySchema.safeParse({ path: exactlyBound });
    expect(result.success).toBe(true);
  });
});
