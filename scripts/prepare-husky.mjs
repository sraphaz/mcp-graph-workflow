#!/usr/bin/env node
/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Wrapper for the `prepare` npm lifecycle hook. Husky may be absent in
 * environments that omit devDependencies (e.g. `npm ci --omit=dev` in
 * CI bench/size jobs, container production installs). Calling `husky`
 * directly aborts the install with exit 127 in that case.
 *
 * This wrapper invokes husky if available and silently exits 0 otherwise.
 * Cross-platform: avoids `|| true` which doesn't work in cmd.exe.
 */

import { spawnSync } from "node:child_process";

const result = spawnSync("husky", [], { stdio: "inherit", shell: true });

if (result.error || (typeof result.status === "number" && result.status !== 0)) {
  // husky absent (devDep omitted) or failed — non-fatal for install.
  // Husky hooks just won't be installed, which is the desired behavior
  // in production / slim CI environments.
}

process.exit(0);
