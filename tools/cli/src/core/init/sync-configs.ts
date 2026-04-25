/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { fingerprintProject, type IdeKind } from "./detect.js";
import { emitClaudeSettings } from "./emit-claude-config.js";
import { emitClaudeMd } from "./emit-claude-md.js";
import {
  emitCursorMcpConfig,
  emitRootMcpConfig,
  emitVsCodeMcpConfig,
} from "./emit-mcp-config.js";
import { emitSkills } from "./emit-skills.js";
import type { ScaffoldChange } from "./scaffold.js";

export interface ConfigSyncOptions {
  readonly force?: boolean;
  /** Override the IDE detection — useful for `--ide vscode` overrides. */
  readonly ides?: ReadonlyArray<IdeKind>;
  /** When true, compute changes but never write to disk. */
  readonly dryRun?: boolean;
}

export interface ConfigSyncResult {
  readonly cwd: string;
  readonly ides: ReadonlyArray<IdeKind>;
  readonly changes: ReadonlyArray<ScaffoldChange>;
}

/**
 * Coordinator: emits every config file the project should have, given its
 * detected IDE set. Idempotent — re-running on a synced project yields
 * `skipped-noop` for everything.
 *
 * Always emits:
 *   - `.mcp.json`               (root, generic Claude Code)
 *   - `.claude/settings.local.json`
 *
 * Conditionally emits (when the IDE marker dir exists):
 *   - `.vscode/mcp.json`        (if VS Code)
 *   - `.cursor/mcp.json`        (if Cursor)
 */
export function syncConfigs(
  cwd: string,
  opts: ConfigSyncOptions = {},
): ConfigSyncResult {
  const fp = fingerprintProject(cwd);
  const ides = opts.ides ?? fp.ides;
  const changes: ScaffoldChange[] = [];

  const passthrough = { force: opts.force, dryRun: opts.dryRun };
  changes.push(emitRootMcpConfig(cwd, passthrough));
  changes.push(emitClaudeSettings(cwd, passthrough));
  changes.push(...emitSkills(cwd, passthrough));
  // Sprint 7.4 #7.4.7 — drop a starter CLAUDE.md only when one is
  // not already present. The emitter is idempotent on its own (returns
  // skipped-existing) but we keep the call here so dry-run still
  // surfaces the would-be created entry in the change list.
  if (!opts.dryRun) {
    changes.push(emitClaudeMd(cwd));
  }

  if (ides.includes("vscode")) {
    changes.push(emitVsCodeMcpConfig(cwd, passthrough));
  }
  if (ides.includes("cursor")) {
    changes.push(emitCursorMcpConfig(cwd, passthrough));
  }

  return { cwd, ides, changes };
}

export interface ConfigCheckResult {
  readonly inSync: boolean;
  readonly drift: ReadonlyArray<ScaffoldChange>;
}

/**
 * Dry-run: reports which files would change if `syncConfigs` ran.
 * Never touches the filesystem.
 */
export function checkConfigs(cwd: string): ConfigCheckResult {
  const { changes } = syncConfigs(cwd, { dryRun: true });
  const drift = changes.filter(
    (c) => c.action !== "skipped-noop" && c.action !== "skipped-existing",
  );
  return { inSync: drift.length === 0, drift };
}
