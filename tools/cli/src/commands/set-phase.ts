/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * `mg set-phase <PHASE>` — CLI replacement for the deprecated `set_phase` MCP
 * tool. Forwards to `setPhaseCore(store, opts)` in the parent runtime so
 * lifecycle/code-intel/prereq mode persistence stays in a single place.
 */

import {
  ParentNotInstalledError,
  getParentRuntime,
} from "../core/parent-bridge.js";
import type {
  CommandHandlerArgs,
  CommandHandlerResult,
} from "./registry.js";

const VALID_PHASES = [
  "ANALYZE",
  "DESIGN",
  "PLAN",
  "IMPLEMENT",
  "VALIDATE",
  "REVIEW",
  "HANDOFF",
  "DEPLOY",
  "LISTENING",
  "auto",
] as const;
type Phase = (typeof VALID_PHASES)[number];

interface SetPhaseInput {
  phase: Phase;
  force?: boolean;
  mode?: "strict" | "advisory";
  codeIntelligence?: "strict" | "advisory" | "off";
  prerequisites?: "strict" | "advisory" | "off";
  teamTask?: boolean;
  wipStrict?: boolean;
  maxInFlight?: number;
  autopilot?: boolean;
  sprintId?: string;
}

type SetPhaseSuccess = {
  ok: true;
  action: "reset_to_auto" | "override";
  phase?: string;
  detectedPhase?: string;
  mode: string;
  codeIntelligence: string;
  prerequisites: string;
  reminder: string;
  phaseSummaryIndexed?: boolean;
  cacheInvalidated?: boolean;
};
type SetPhaseBlocked = {
  ok: false;
  kind: string;
  error: string;
};
type SetPhaseResult = SetPhaseSuccess | SetPhaseBlocked;

interface SetPhaseModule {
  setPhaseCore: (store: unknown, input: SetPhaseInput) => SetPhaseResult;
}

interface StoreModule {
  SqliteStore: {
    open(basePath?: string): { close(): void };
  };
}

const USAGE = "usage: mg set-phase <PHASE> [--mode strict|advisory] [--code-intel strict|advisory|off] [--prerequisites strict|advisory|off] [--force] [--json]";

function isPhase(value: unknown): value is Phase {
  return typeof value === "string" && (VALID_PHASES as readonly string[]).includes(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

function parseInput(ctx: CommandHandlerArgs): { ok: true; input: SetPhaseInput } | { ok: false; error: string } {
  const phaseArg = ctx.args[0];
  if (!phaseArg) {
    return { ok: false, error: USAGE };
  }
  if (!isPhase(phaseArg)) {
    return {
      ok: false,
      error: `invalid phase '${phaseArg}'. Allowed: ${VALID_PHASES.join(", ")}`,
    };
  }

  const flags = ctx.flags;
  const mode = asEnum(flags.mode, ["strict", "advisory"] as const);
  const codeIntelligence = asEnum(
    flags["code-intel"] ?? flags.codeIntelligence,
    ["strict", "advisory", "off"] as const,
  );
  const prerequisites = asEnum(
    flags.prerequisites,
    ["strict", "advisory", "off"] as const,
  );
  const force = flags.force === true || flags.force === "true";
  const teamTask =
    flags["team-task"] === true || flags["team-task"] === "true"
      ? true
      : flags["team-task"] === false || flags["team-task"] === "false"
        ? false
        : undefined;
  const sprintId = asString(flags["sprint-id"]);

  const input: SetPhaseInput = {
    phase: phaseArg,
    ...(force ? { force } : {}),
    ...(mode ? { mode } : {}),
    ...(codeIntelligence ? { codeIntelligence } : {}),
    ...(prerequisites ? { prerequisites } : {}),
    ...(teamTask !== undefined ? { teamTask } : {}),
    ...(sprintId ? { sprintId } : {}),
  };
  return { ok: true, input };
}

export async function runSetPhase(ctx: CommandHandlerArgs): Promise<CommandHandlerResult> {
  const parsed = parseInput(ctx);
  if (!parsed.ok) {
    return { exitCode: 2, text: parsed.error };
  }

  let parent;
  try {
    parent = await getParentRuntime();
  } catch (err) {
    if (err instanceof ParentNotInstalledError) {
      return { exitCode: 127, text: err.hint };
    }
    throw err;
  }

  if (!parent.loadSetPhaseCore) {
    return {
      exitCode: 1,
      text: "parent runtime missing set-phase-core (rebuild with `npm run build` in parent)",
    };
  }

  const [storeMod, setPhaseMod] = (await Promise.all([
    parent.loadStore(),
    parent.loadSetPhaseCore(),
  ])) as [StoreModule, SetPhaseModule];

  const store = storeMod.SqliteStore.open(process.cwd());
  let result: SetPhaseResult;
  try {
    result = setPhaseMod.setPhaseCore(store, parsed.input);
  } finally {
    try {
      store.close();
    } catch {
      // best-effort close
    }
  }

  if (ctx.flags.json) {
    return {
      exitCode: result.ok ? 0 : 1,
      json: result,
    };
  }

  if (!result.ok) {
    return { exitCode: 1, text: result.error };
  }

  const phaseLabel =
    result.action === "reset_to_auto"
      ? `reset → auto-detected: ${result.detectedPhase ?? "?"}`
      : `→ ${result.phase ?? "?"}`;
  const lines = [
    `phase ${phaseLabel}`,
    `  mode:             ${result.mode}`,
    `  code-intel:       ${result.codeIntelligence}`,
    `  prerequisites:    ${result.prerequisites}`,
    "",
    result.reminder,
  ];
  return { exitCode: 0, text: lines.join("\n") };
}
