/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Auto-generated smoke test (scripts/gen-smoke-tests.mjs).
 * Verifies module loads cleanly. Promote to characterization tests when
 * touching this module — see CLAUDE.md "Testing & Quality Methodology".
 */

import { describe, it, expect } from "vitest";
import * as mod from "../mcp/tools/node.js";

describe("node (smoke)", () => {
  it("module imports without throwing", () => {
    expect(mod).toBeDefined();
  });
});
