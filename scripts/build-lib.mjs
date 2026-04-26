#!/usr/bin/env node
/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Wrapper for `tsc -p tsconfig.lib.json`. tsc emits files even with type
 * errors (default: noEmitOnError=false), but exits with non-zero status,
 * which would break the chained `build` script on Windows where `|| true`
 * isn't valid (cmd.exe lacks the `true` builtin).
 *
 * This wrapper runs tsc and exits 0 unconditionally — the granular
 * dist/core/, dist/utils/, dist/schemas/ files are emitted regardless,
 * and tsup already typechecks via its own pipeline. Pre-existing
 * type errors in src/core/parser/read-pdf.ts and onnx-embeddings.ts
 * are tolerated here for the lib emit; root-level `npm run typecheck`
 * still surfaces them.
 */

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const tscBin = require.resolve("typescript/lib/tsc.js");

const result = spawnSync(
  process.execPath,
  [tscBin, "-p", "tsconfig.lib.json"],
  { stdio: "inherit" },
);

if (result.error) {
  process.stderr.write(`build-lib: failed to spawn tsc — ${result.error.message}\n`);
}

// Always exit 0 — granular files emit even when tsc reports type errors,
// and the parent build chain depends only on those file outputs existing.
process.exit(0);
