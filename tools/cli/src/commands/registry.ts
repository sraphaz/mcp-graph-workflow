/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Single source of truth for every command MCP Graph Workflow exposes.
 *
 * The same registry feeds three thin routers:
 *   1. REPL slash router  — `mg` (no args) → `/cmd args` inside the REPL
 *   2. Shell router       — `mcp-graph cmd args` at the OS prompt (Commander)
 *   3. Skill emitter      — `mcp-graph init` writes `.claude/skills/<cmd>.md`
 *
 * Adding a command means adding ONE entry here. The routers enumerate
 * this list at startup; nothing else needs to change.
 */

import type { ReactElement } from "react";

export interface CommandHandlerArgs {
  readonly args: readonly string[];
  readonly flags: Readonly<Record<string, string | boolean>>;
  readonly mode: "shell" | "repl" | "skill";
  readonly traceId: string;
}

export interface CommandHandlerResult {
  readonly exitCode?: number;
  readonly element?: ReactElement;
  readonly text?: string;
  readonly json?: unknown;
}

export type CommandHandler = (
  ctx: CommandHandlerArgs,
) => Promise<CommandHandlerResult> | CommandHandlerResult;

export interface CommandDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly usage: string;
  readonly slashAliases: readonly string[];
  readonly shellAliases: readonly string[];
  readonly category:
    | "lifecycle"
    | "auth"
    | "graph"
    | "browser"
    | "ops"
    | "meta"
    | "internal";
  /** When true, the command is hidden from the default `mcp-graph --help` listing. */
  readonly hidden?: boolean;
  readonly examples?: readonly string[];
  readonly emitSkill?: boolean;
  readonly handler: CommandHandler;
}

const registry: CommandDefinition[] = [];

export function registerCommand(def: CommandDefinition): void {
  if (registry.some((c) => c.id === def.id)) {
    throw new Error(`Command id already registered: ${def.id}`);
  }

  // Skip auto-trace for the hook dispatcher (it logs to hooks.jsonl on its own)
  // and for trivial meta calls (version/exit) — they would dominate the log.
  const skipTrace =
    def.id === "hook" || def.id === "version" || def.id === "exit";

  const wrapped: CommandDefinition = skipTrace
    ? def
    : {
        ...def,
        handler: async (ctx) => {
          const { withCommandTrace } = await import(
            "../core/log/cmd-trace.js"
          );
          return withCommandTrace(def.id, def.handler)(ctx);
        },
      };

  registry.push(wrapped);
}

export function listCommands(): readonly CommandDefinition[] {
  return registry;
}

export function findCommandBySlash(slash: string): CommandDefinition | undefined {
  const head = slash.startsWith("/") ? slash.slice(1) : slash;
  const first = head.split(/\s+/, 1)[0];
  return registry.find(
    (c) =>
      c.slashAliases.includes(first) ||
      c.id === first ||
      c.name === first,
  );
}

export function findCommandByShell(name: string): CommandDefinition | undefined {
  return registry.find(
    (c) =>
      c.shellAliases.includes(name) ||
      c.id === name ||
      c.name === name,
  );
}

/**
 * Sprint 7 #7.9 — typo-tolerant Damerau–Levenshtein distance.
 *
 * Counts edits between two short strings: insertion, deletion, substitution,
 * and adjacent-character transposition. Capped at `max + 1` so we can early-
 * exit when a candidate clearly exceeds the budget — relevant because the
 * fuzzy palette runs on every keystroke.
 */
function damerauLevenshtein(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  // Two rolling rows + one extra for the transposition lookup.
  let prevPrev: number[] = new Array(n + 1).fill(0);
  let prev: number[] = new Array(n + 1);
  let curr: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let val = Math.min(
        curr[j - 1] + 1, // insertion
        prev[j] + 1, // deletion
        prev[j - 1] + cost, // substitution
      );
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        val = Math.min(val, prevPrev[j - 2] + 1); // transposition
      }
      curr[j] = val;
      if (val < rowMin) rowMin = val;
    }
    if (rowMin > max) return max + 1; // early-exit when no path is viable
    prevPrev = prev;
    prev = curr;
    curr = new Array(n + 1);
  }
  return prev[n];
}

export function fuzzyMatchCommands(
  query: string,
  limit = 8,
): readonly CommandDefinition[] {
  if (!query) return registry.slice(0, limit);
  const q = query.toLowerCase().replace(/^\//, "");
  // Typo budget grows with query length: 1 for ≤4 chars, 2 for ≤8, 3 above.
  // Keeps "lst"→"list" cheap while still catching "stsrt"→"start".
  const typoBudget = q.length <= 4 ? 1 : q.length <= 8 ? 2 : 3;
  const scored = registry
    .map((c) => {
      const candidates = [
        c.id,
        c.name,
        c.description.toLowerCase(),
        ...c.slashAliases,
        ...c.shellAliases,
      ];
      let best = -1;
      for (const cand of candidates) {
        const lc = cand.toLowerCase();
        if (lc === q) {
          best = Math.max(best, 100);
          continue;
        }
        if (lc.startsWith(q)) {
          best = Math.max(best, 90 - lc.length);
          continue;
        }
        if (lc.includes(q)) {
          best = Math.max(best, 70 - lc.length);
          continue;
        }
        // simple subsequence scoring
        let qi = 0;
        for (let i = 0; i < lc.length && qi < q.length; i++) {
          if (lc[i] === q[qi]) qi++;
        }
        if (qi === q.length) {
          best = Math.max(best, 40 - lc.length);
          continue;
        }
        // Sprint 7 #7.9 — typo-tolerant fallback. Only run on short
        // candidates (command names, aliases — not the description text)
        // to avoid quadratic cost on long strings. Score decays with
        // edit distance: 1 typo → 30, 2 → 20, 3 → 10.
        if (lc.length <= 24) {
          const dist = damerauLevenshtein(lc, q, typoBudget);
          if (dist <= typoBudget && dist > 0) {
            best = Math.max(best, 30 - (dist - 1) * 10 - lc.length);
          }
        }
      }
      return { c, score: best };
    })
    .filter((s) => s.score > -1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.c);
  return scored;
}

export function clearRegistryForTests(): void {
  registry.length = 0;
}
