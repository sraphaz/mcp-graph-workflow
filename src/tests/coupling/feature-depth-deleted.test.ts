/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-sentrux — Task 2.1: tools/feature-depth Go tool deleted.
 *
 * AC2: directory absent after deletion
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");
const GO_TOOL_DIR = path.join(ROOT, "tools/feature-depth");

describe("Task 2.1: tools/feature-depth Go tool deleted", () => {
  it("tools/feature-depth directory no longer exists", () => {
    expect(fs.existsSync(GO_TOOL_DIR)).toBe(false);
  });
});
