/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Load harness guardrails from src/browser-harness-skills/SKILL.md frontmatter.
 * Falls back to permissive defaults if the file is missing.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import {
  HarnessGuardrailSchema,
  type HarnessGuardrail,
} from "../../schemas/browser-harness.schema.js";
import { logger } from "../utils/logger.js";

const HERE = dirname(fileURLToPath(import.meta.url));

/** defaultGuardrail — auto-generated description placeholder. */
export function defaultGuardrail(): HarnessGuardrail {
  return HarnessGuardrailSchema.parse({});
}

/** Try several common locations to find the SKILL.md file. */
function resolveSkillPath(): string | null {
  const candidates = [
    // src layout (dev mode via tsx)
    join(HERE, "..", "..", "browser-harness-skills", "SKILL.md"),
    // dist layout
    join(HERE, "..", "..", "..", "src", "browser-harness-skills", "SKILL.md"),
    // CWD fallback
    join(process.cwd(), "src", "browser-harness-skills", "SKILL.md"),
  ];
  for (const pVar of candidates) {
    if (existsSync(pVar)) return pVar;
  }
  return null;
}

/** loadGuardrail — auto-generated description placeholder. */
export function loadGuardrail(skillPath?: string): HarnessGuardrail {
  const path = skillPath ?? resolveSkillPath();
  if (!path) {
    logger.debug("bh:guardrail:default", { reason: "SKILL.md not found, using permissive defaults" });
    return defaultGuardrail();
  }
  try {
    const text = readFileSync(path, "utf8");
    const match = text.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return defaultGuardrail();
    const fm = parseYaml(match[1]) as Record<string, unknown>;
    return HarnessGuardrailSchema.parse({
      allowedDomains: fm.allowedDomains ?? ["*"],
      forbiddenCdpMethods: fm.forbiddenCdpMethods ?? [],
      selfHealPolicy: fm.selfHealPolicy ?? {},
    });
  } catch (err) {
    logger.warn("bh:guardrail:load:error", { error: err instanceof Error ? err.message : String(err) });
    return defaultGuardrail();
  }
}

/** isDomainAllowed — auto-generated description placeholder. */
export function isDomainAllowed(url: string, guardrail: HarnessGuardrail): boolean {
  const allow = guardrail.allowedDomains;
  if (allow.includes("*")) return true;
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  for (const pattern of allow) {
    if (pattern === host) return true;
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(1); // ".github.com"
      if (host.endsWith(suffix)) return true;
    }
  }
  return false;
}

/** isCdpMethodForbidden — auto-generated description placeholder. */
export function isCdpMethodForbidden(method: string, guardrail: HarnessGuardrail): boolean {
  return guardrail.forbiddenCdpMethods.includes(method);
}
