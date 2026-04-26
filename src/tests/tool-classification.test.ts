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
import {
  ALWAYS_ALLOWED_TOOLS,
  READ_ONLY_TOOLS,
  BOOTSTRAP_TOOLS,
} from "../mcp/tool-classification.js";

describe("tool-classification (re-exports from constants)", () => {
  it("should expose ALWAYS_ALLOWED_TOOLS as a non-empty Set", () => {
    expect(ALWAYS_ALLOWED_TOOLS).toBeInstanceOf(Set);
    expect(ALWAYS_ALLOWED_TOOLS.size).toBeGreaterThan(0);
  });

  it("should expose READ_ONLY_TOOLS as a non-empty Set", () => {
    expect(READ_ONLY_TOOLS).toBeInstanceOf(Set);
    expect(READ_ONLY_TOOLS.size).toBeGreaterThan(0);
  });

  it("should expose BOOTSTRAP_TOOLS as a non-empty Set", () => {
    expect(BOOTSTRAP_TOOLS).toBeInstanceOf(Set);
    expect(BOOTSTRAP_TOOLS.size).toBeGreaterThan(0);
  });

  it("should include 'init' in ALWAYS_ALLOWED_TOOLS (canonical bootstrap tool)", () => {
    expect(ALWAYS_ALLOWED_TOOLS.has("init")).toBe(true);
  });

  it("should be the same Set instance as BOOTSTRAP_TOOLS (single source of truth)", () => {
    // ALWAYS_ALLOWED_TOOLS is documented as an alias for BOOTSTRAP_TOOLS.
    expect(ALWAYS_ALLOWED_TOOLS).toBe(BOOTSTRAP_TOOLS);
  });

  it("should treat read-only tools as a subset/overlap with always-allowed", () => {
    // The two sets should not be disjoint — read-only tools like `list`,
    // `show`, `query_graph` are universally callable. If they go disjoint,
    // it's a regression in the unified-gate allowlist.
    const overlap = [...READ_ONLY_TOOLS].filter((t) => ALWAYS_ALLOWED_TOOLS.has(t));
    expect(overlap.length).toBeGreaterThan(0);
  });
});
