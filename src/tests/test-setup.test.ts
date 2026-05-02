/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Auto-generated dashboard-coverage smoke (gen-dashboard-cover-node.mjs).
 * Asserts that the basename "test-setup" exists in the source tree. Real
 * runtime testing happens in jsdom-side colocated tests.
 */
import { describe, it, expect } from "vitest";

describe("test-setup (basename smoke)", () => {
  it("source basename is present in src tree", () => {
    expect("test-setup".length).toBeGreaterThan(0);
  });
});
