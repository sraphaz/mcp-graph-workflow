/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §extracta-domain-knowledge — browser-specific skill proposer.
 * After a browser-harness task completes successfully, capture the
 * interaction sequence as a domain skill at
 * `src/skills/domain/browser/<site>/<topic>.md`. Inspired by
 * browser-use's domain-skill auto-contribution.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface BrowserStep {
  action: string;
  selector?: string;
  url?: string;
  notes?: string;
}

export interface BrowserSkillInput {
  taskId: string;
  taskTitle: string;
  startUrl: string;
  steps: BrowserStep[];
  outcome: "success" | "partial" | "failure";
  discoveredAt?: string;
}

export interface BrowserSkillProposal {
  draft: string;
  /** Site host extracted from startUrl (e.g. "example.com"). */
  site: string;
  topic: string;
  /** Suggested path under src/skills/ for the harness to write. */
  suggestedPath: string;
  confidence: number;
}

function hostFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "unknown-site";
  }
}

function topicFromTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .split(/\s+/)
      .slice(0, 5)
      .join("-") || "untitled"
  );
}

function siteSlug(host: string): string {
  return host.replace(/[^a-z0-9.-]/gi, "-").toLowerCase();
}

function confidenceFor(input: BrowserSkillInput): number {
  if (input.outcome !== "success") return 0.4;
  // Reward longer, more deliberate sequences (capped).
  const lenBonus = Math.min(input.steps.length * 0.05, 0.3);
  return Math.min(0.9, Math.round((0.55 + lenBonus) * 100) / 100);
}

/**
 * Build a draft markdown skill capturing the interaction sequence. The
 * harness is responsible for writing this to disk (this function never
 * touches the filesystem) so callers can review-or-skip.
 */
export function proposeBrowserSkill(input: BrowserSkillInput): BrowserSkillProposal {
  const host = hostFromUrl(input.startUrl);
  const site = siteSlug(host);
  const topic = topicFromTitle(input.taskTitle);
  const confidence = confidenceFor(input);
  const discoveredAt = input.discoveredAt ?? new Date().toISOString();

  const stepsBlock = input.steps
    .map((s, i) => {
      const parts = [`${i + 1}. **${s.action}**`];
      if (s.selector) parts.push(`\`${s.selector}\``);
      if (s.url) parts.push(`→ ${s.url}`);
      if (s.notes) parts.push(`— ${s.notes}`);
      return parts.join(" ");
    })
    .join("\n");

  const draft = `---
domain: browser
topic: ${site}-${topic}
triggers: [browser_${site.replace(/\./g, "_")}, ${topic}]
discovered_at: ${discoveredAt}
source_task: ${input.taskId}
confidence: ${confidence}
---

# ${input.taskTitle} on ${host}

Captured automatically after a successful browser-harness run on ${host}.
Steps below replay the empirically-validated interaction sequence.

## Start URL

${input.startUrl}

## Steps

${stepsBlock || "(no steps recorded)"}

## Outcome

${input.outcome}
`;

  return {
    draft,
    site,
    topic,
    suggestedPath: `src/skills/domain/browser/${site}/${topic}.md`,
    confidence,
  };
}

/**
 * §extracta-wire-followups — write a proposal to disk, but only when:
 *   1. `MCP_GRAPH_AUTO_BROWSER_SKILL=1` is set in the environment
 *   2. the target file does not already exist (no overwrites)
 * Returns the path written, or `null` when skipped (env off, file
 * exists, or outcome != success).
 */
export interface WriteBrowserSkillResult {
  written: boolean;
  path: string;
  reason: "ok" | "env_off" | "already_exists" | "low_confidence";
}

export function writeBrowserSkillIfAbsent(
  proposal: BrowserSkillProposal,
  options: { rootDir?: string; env?: NodeJS.ProcessEnv } = {},
): WriteBrowserSkillResult {
  const env = options.env ?? process.env;
  const rootDir = options.rootDir ?? process.cwd();
  const fullPath = `${rootDir}/${proposal.suggestedPath}`;

  if (env.MCP_GRAPH_AUTO_BROWSER_SKILL !== "1") {
    return { written: false, path: fullPath, reason: "env_off" };
  }
  if (proposal.confidence < 0.5) {
    return { written: false, path: fullPath, reason: "low_confidence" };
  }
  if (existsSync(fullPath)) {
    return { written: false, path: fullPath, reason: "already_exists" };
  }
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, proposal.draft, "utf-8");
  return { written: true, path: fullPath, reason: "ok" };
}

/**
 * §extracta-wire-followups — finish_task hook. Reads the node's
 * metadata.browserSkillInput (populated by the browser-harness when a
 * run completes), generates a proposal, and writes it under the env
 * gate. Returns the result so callers can log/audit. Returns
 * `{ written: false, reason: "no_metadata" }` when the node has no
 * browser evidence — the common case for non-browser tasks.
 */
export interface BrowserHookOutcome {
  written: boolean;
  path?: string;
  reason: "ok" | "env_off" | "already_exists" | "low_confidence" | "no_metadata";
}

export function proposeBrowserSkillFromNode(
  node: { metadata?: Record<string, unknown> | null } | null | undefined,
  options: { rootDir?: string; env?: NodeJS.ProcessEnv } = {},
): BrowserHookOutcome {
  const meta = node?.metadata;
  const raw = meta && typeof meta === "object" ? (meta as Record<string, unknown>).browserSkillInput : undefined;
  if (!raw || typeof raw !== "object") {
    return { written: false, reason: "no_metadata" };
  }
  const proposal = proposeBrowserSkill(raw as BrowserSkillInput);
  const result = writeBrowserSkillIfAbsent(proposal, options);
  return { written: result.written, path: result.path, reason: result.reason };
}

/**
 * §extracta-completion — derive a BrowserSkillInput from a HarnessRun.
 * Inputs needed shape (we don't import schemas here to keep this module
 * dependency-free):
 *   - taskId, taskTitle (caller-provided since they sit on the graph node)
 *   - prompt (the user's instruction — used as fallback title)
 *   - plan: array of `{ helper, args }` describing the steps
 *   - verdict: "pass" | "fail" | "error"
 * Returns null when the run was not a clean success or the plan is empty.
 */
export interface RunPlanLike {
  helper: string;
  args?: Record<string, unknown>;
}

export interface DeriveOptions {
  taskId: string;
  taskTitle: string;
  prompt: string;
  plan: ReadonlyArray<RunPlanLike>;
  verdict: "pass" | "fail" | "error";
}

export function deriveBrowserSkillInput(opts: DeriveOptions): BrowserSkillInput | null {
  if (opts.verdict !== "pass") return null;
  if (opts.plan.length === 0) return null;
  const navigateStep = opts.plan.find((s) => s.helper === "navigate");
  const startUrl = navigateStep && typeof navigateStep.args?.url === "string"
    ? (navigateStep.args.url as string)
    : "";
  if (!startUrl) return null;
  const steps: BrowserStep[] = opts.plan.map((s) => ({
    action: s.helper,
    selector: typeof s.args?.selector === "string" ? (s.args.selector as string) : undefined,
    url: typeof s.args?.url === "string" ? (s.args.url as string) : undefined,
  }));
  return {
    taskId: opts.taskId,
    taskTitle: opts.taskTitle || opts.prompt.slice(0, 80),
    startUrl,
    steps,
    outcome: "success",
  };
}

/**
 * §extracta-completion — minimal store surface used by
 * persistBrowserSkillInput. Defined narrowly so tests can pass a
 * lightweight stub instead of constructing a SqliteStore.
 */
export interface BrowserSkillStoreLike {
  getNodeById(id: string): { metadata?: Record<string, unknown> | null; title?: string } | null;
  updateNode(id: string, fields: { metadata: Record<string, unknown> }): unknown;
}

export interface PersistBrowserSkillInputArgs {
  nodeId: string;
  prompt: string;
  run: { plan: ReadonlyArray<RunPlanLike>; verdict: "pass" | "fail" | "error" };
}

/**
 * §extracta-completion — extracted so the api/browser-harness route
 * stays thin and the persistence behavior can be unit-tested without
 * running through SSE / CDP.
 *
 * Returns the BrowserSkillInput that was persisted, or null when
 * nothing was written (verdict != pass, no startUrl, etc.).
 */
export function persistBrowserSkillInput(
  store: BrowserSkillStoreLike,
  args: PersistBrowserSkillInputArgs,
): BrowserSkillInput | null {
  const node = store.getNodeById(args.nodeId);
  const skillInput = deriveBrowserSkillInput({
    taskId: args.nodeId,
    taskTitle: node?.title ?? args.prompt,
    prompt: args.prompt,
    plan: args.run.plan,
    verdict: args.run.verdict,
  });
  if (!skillInput) return null;
  const meta = (node?.metadata as Record<string, unknown>) ?? {};
  store.updateNode(args.nodeId, {
    metadata: { ...meta, browserSkillInput: skillInput },
  });
  return skillInput;
}
