/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §node_4a468cce743a — Story 8 AC: 0 empty catches + 0 raw throws in src/core/
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { collectTsFiles, findEmptyCatches, findRawThrows } from "../../scripts/audit-catches.js";

const coreRoot = join(process.cwd(), "src", "core");
const coreFiles = collectTsFiles(coreRoot);

describe("Story 8 AC — empty-catch sweep + typed errors in src/core/", () => {
  it("src/core has 0 empty catch blocks", () => {
    const findings = coreFiles.flatMap((f) =>
      findEmptyCatches(readFileSync(f, "utf-8"), f),
    );
    const report = findings
      .map((f) => `  ${f.file.replace(process.cwd() + "/", "")}:${f.line}`)
      .join("\n");
    expect(
      findings,
      `Found ${findings.length} empty catch(es) in src/core/:\n${report}`,
    ).toHaveLength(0);
  });

  it("src/core has 0 raw throw new Error() (use typed errors from src/core/utils/errors.ts)", () => {
    const findings = coreFiles.flatMap((f) =>
      findRawThrows(readFileSync(f, "utf-8"), f),
    );
    const report = findings
      .map((f) => `  ${f.file.replace(process.cwd() + "/", "")}:${f.line}  ${f.snippet}`)
      .join("\n");
    expect(
      findings,
      `Found ${findings.length} raw throw(s) in src/core/:\n${report}`,
    ).toHaveLength(0);
  });
});
