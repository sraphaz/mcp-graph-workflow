#!/usr/bin/env node
/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Copies the workspace CLI bundle (`tools/cli/dist/cli.mjs`) into the
 * root `dist/` so it ships with `@mcp-graph-workflow/mcp-graph` on npm.
 *
 * Why: tools/cli is a private workspace (not published to npm). The
 * v11-bridge in `src/cli/commands/_v11-bridge.ts` resolves the bundle
 * at `<rootDist>/v11-cli.mjs` (post-build layout) so users who install
 * only `@mcp-graph-workflow/mcp-graph` get the full CLI surface.
 *
 * Cross-platform via `fs.cpSync` (Node 18+).
 */

import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const source = resolve(repoRoot, "tools", "cli", "dist", "cli.mjs");
const target = resolve(repoRoot, "dist", "v11-cli.mjs");

if (!existsSync(source)) {
  process.stderr.write(
    `copy-v11-bundle: source not found: ${source}\n` +
      `  hint: run \`npm --workspace tools/cli run build\` first.\n`,
  );
  process.exit(1);
}

mkdirSync(dirname(target), { recursive: true });
cpSync(source, target);
process.stdout.write(`✓ copied ${source} → ${target}\n`);
