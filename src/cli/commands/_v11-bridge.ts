/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

/**
 * v11 bridge — Commander wrappers delegate to the v11 CLI bundle via spawn.
 *
 * Architecture: v10 server CLI (`src/cli/index.ts`) and v11 CLI
 * (`tools/cli/src/cli.tsx`, bundled to `dist/cli.mjs`) live in different
 * build chains (tsc vs esbuild). Direct ESM import is impractical due
 * to JSX/Ink/React in the v11 source. This bridge spawns the v11 bundle
 * as a subprocess with inherited stdio, so Ink rendering and TTY
 * interaction work exactly as if the user invoked the v11 CLI directly.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Resolve the bundled CLI path.
 *
 * Tries (in order):
 * 1. `MG_V11_BUNDLE` env override (escape hatch for unusual setups)
 * 2. `<rootDist>/v11-cli.mjs` — post-build layout (also what ships on npm).
 *    Walks up from `__dirname` to find a `dist/` containing the bundle.
 * 3. `tools/cli/dist/cli.mjs` — monorepo dev pre-copy fallback.
 *
 * The published `@mcp-graph-workflow/mcp-graph` tarball includes
 * `dist/v11-cli.mjs` directly (copied from the private `tools/cli`
 * workspace during build). End users never need a separate npm package.
 */
export function resolveV11Bundle(): string | null {
  const envOverride = process.env.MG_V11_BUNDLE;
  if (envOverride && existsSync(envOverride)) return envOverride;

  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    // Post-build / published layout: dist/v11-cli.mjs alongside dist/cli/index.js
    const distCandidate = join(dir, "v11-cli.mjs");
    if (existsSync(distCandidate)) return distCandidate;
    const distNestedCandidate = join(dir, "dist", "v11-cli.mjs");
    if (existsSync(distNestedCandidate)) return distNestedCandidate;

    // Monorepo dev fallback: tools/cli built but bundle not yet copied
    const monorepoCandidate = join(dir, "tools", "cli", "dist", "cli.mjs");
    if (existsSync(monorepoCandidate)) return monorepoCandidate;

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Convert Commander option/argument state into argv tokens for the v11 CLI.
 * v11 parses its own argv: positional args + --flag=value or --flag value.
 */
function toV11Argv(commandName: string, command: Command): string[] {
  const argv = [commandName, ...command.args];
  const opts = command.opts();
  for (const [key, value] of Object.entries(opts)) {
    // Commander emits camelCase; v11 expects kebab-case. Convert.
    const flag = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    if (typeof value === "boolean") {
      if (value) argv.push(`--${flag}`);
    } else if (value !== undefined && value !== null) {
      argv.push(`--${flag}=${String(value)}`);
    }
  }
  return argv;
}

/**
 * Spawn the v11 CLI bundle with given argv. Inherits stdio so Ink/TTY work.
 * Exits the parent process with the child's status code.
 */
export function delegateToV11(commandName: string): (...args: unknown[]) => void {
  return (...args: unknown[]) => {
    const command = args[args.length - 1] as Command;
    const bundle = resolveV11Bundle();
    if (!bundle) {
      process.stderr.write(
        "✗ v11 CLI bundle not found. Try: npm install -g @mcp-graph-workflow/cli\n",
      );
      process.exit(2);
    }
    const result = spawnSync(process.execPath, [bundle, ...toV11Argv(commandName, command)], {
      stdio: "inherit",
    });
    process.exit(result.status ?? 1);
  };
}

/**
 * Convenience builder for declaring a v11-wrapper Commander command in one call.
 *
 * Default behavior is permissive: variadic positionals + unknown options are
 * passed through to the v11 bundle untouched. Override `args` / `flags` only
 * if you want Commander to validate them locally before delegation.
 */
export interface V11WrapperOptions {
  name: string;
  description: string;
  /** Optional alias names (e.g., ["ls"] for the list command). */
  aliases?: string[];
  /** Positional argument descriptors, e.g. "<id>" or "[id]". Default: variadic `[args...]`. */
  args?: string[];
  /** Flag descriptors: { flags: "--id", description: "..." } */
  flags?: Array<{ flags: string; description: string }>;
}

export function makeV11WrapperCommand(opts: V11WrapperOptions): Command {
  const cmd = new Command(opts.name).description(opts.description);
  if (opts.aliases?.length) cmd.aliases(opts.aliases);
  const args = opts.args ?? ["[args...]"];
  for (const arg of args) cmd.argument(arg);
  for (const flag of opts.flags ?? []) cmd.option(flag.flags, flag.description);
  cmd.allowUnknownOption(true);
  cmd.action(delegateToV11(opts.name));
  return cmd;
}
