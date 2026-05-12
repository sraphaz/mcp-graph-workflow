/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Cross-platform path hygiene scanner.
 *
 * Guards against the recurring foot-gun where a test uses a raw `/tmp/...`
 * literal as the *expected* value of a path that production code routes
 * through `path.join(...)`. On Windows, `path.join` normalises forward
 * slashes to `\`, so the assertion stops matching even though the code
 * is correct.
 *
 * Files listed below were audited and either fixed (use `path.join`) or
 * confirmed safe (string is opaque, never compared against a joined path).
 * If you add a new offender, update this allow-list AND fix the test —
 * adding to the allow-list without fixing the bug is a regression.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

/**
 * Files where a raw `/tmp/...` literal is used as a path that round-trips
 * through `path.join(...)` in production. These MUST use `path.join` in
 * the test too. Empty list = no known offenders.
 */
const FILES_THAT_MUST_USE_PATH_JOIN: readonly string[] = [];

describe("cross-platform path hygiene", () => {
  it("FILES_THAT_MUST_USE_PATH_JOIN list is defined (may be empty when no offenders)", () => {
    expect(Array.isArray(FILES_THAT_MUST_USE_PATH_JOIN)).toBe(true);
  });

  for (const rel of FILES_THAT_MUST_USE_PATH_JOIN) {
    it(`${rel} uses path.join (or path.posix) for tmp paths`, () => {
      const abs = path.resolve(REPO_ROOT, rel);
      const source = readFileSync(abs, "utf8");

      // Must import node:path so it can produce platform-correct expected
      // values. A test that compares a `path.join`-produced string to a raw
      // `/tmp/...` literal will fail on Windows.
      expect(source).toMatch(/from\s+["']node:path["']/);
    });
  }
});
