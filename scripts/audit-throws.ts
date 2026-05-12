#!/usr/bin/env tsx
/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §node_d09545a25596 — Story 8: Raw throw audit CLI
 * Usage: npm run audit:throws
 *
 * Lists all `throw new Error(...)` in src/core/**\/*.ts that should use a
 * typed error from src/core/utils/errors.ts instead.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { collectTsFiles, findRawThrows } from "./audit-catches.js";

const root = join(process.cwd(), "src", "core");
const files = collectTsFiles(root);
const allFindings = files.flatMap((file) =>
  findRawThrows(readFileSync(file, "utf-8"), file),
);

if (allFindings.length === 0) {
  process.stdout.write("audit:throws — no raw Error throws found in src/core/.\n");
} else {
  process.stdout.write(`audit:throws — ${allFindings.length} raw throw(s) found in src/core/:\n\n`);
  for (const f of allFindings) {
    process.stdout.write(`  ${f.file}:${f.line}  ${f.snippet}\n`);
  }
  process.exit(1);
}
