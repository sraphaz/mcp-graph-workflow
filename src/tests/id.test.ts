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
import { generateId } from "../core/utils/id.js";

describe("generateId", () => {
  it("should default to 'node' prefix when none is given", () => {
    const id = generateId();
    expect(id).toMatch(/^node_[a-f0-9]{12}$/);
  });

  it("should respect a custom prefix", () => {
    const id = generateId("epic");
    expect(id).toMatch(/^epic_[a-f0-9]{12}$/);
  });

  it("should generate unique IDs across rapid successive calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      seen.add(generateId());
    }
    // 1000 calls, 96 bits of entropy each — collisions effectively impossible.
    expect(seen.size).toBe(1000);
  });

  it("should produce 12 hex characters of entropy (6 bytes)", () => {
    const id = generateId("x");
    const hex = id.slice("x_".length);
    expect(hex).toHaveLength(12);
    expect(hex).toMatch(/^[a-f0-9]+$/);
  });
});
