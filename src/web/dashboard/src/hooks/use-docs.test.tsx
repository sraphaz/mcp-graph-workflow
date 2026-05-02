/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Auto-generated smoke test (scripts/gen-dashboard-smoke.mjs).
 * Verifies the dashboard module loads cleanly in jsdom env.
 * Promote to characterization tests when touching this module.
 */

import { describe, it, expect } from "vitest";
import * as mod from "./use-docs";

describe("use-docs (dashboard smoke)", () => {
  it("module imports without throwing", () => {
    expect(mod).toBeDefined();
  });
});
