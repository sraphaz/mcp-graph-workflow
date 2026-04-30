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
