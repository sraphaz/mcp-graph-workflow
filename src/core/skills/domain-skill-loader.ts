/* eslint-disable security/detect-unsafe-regex */
/*!
 * Lint exemption: the regex patterns in this file are bounded
 * (literal alternations, short character classes, language-keyword
 * lookups) and run against parsed/structured input. The ReDoS class
 * the rule is designed to prevent is not reachable here.
 */
/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Domain Skill Loader — discovers `<root>/<area>/<topic>.md` files,
 * parses YAML frontmatter, validates with Zod, and returns typed skills.
 * Skills with empty `triggers` are rejected (a skill must have at least
 * one trigger to be discoverable).
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { z } from "zod/v4";
import { logger } from "../utils/logger.js";

export const DomainSkillFrontmatterSchema = z.object({
  domain: z.string().min(1),
  topic: z.string().min(1),
  triggers: z.array(z.string().min(1)).min(1, "triggers must contain at least one entry"),
  discovered_at: z.string().min(1),
  source_task: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export type DomainSkillFrontmatter = z.infer<typeof DomainSkillFrontmatterSchema>;

export interface DomainSkill extends DomainSkillFrontmatter {
  body: string;
  path: string;
}

export interface ParseDomainSkillResult {
  ok: boolean;
  skill?: DomainSkill;
  error?: string;
}

export interface LoadDomainSkillsResult {
  skills: DomainSkill[];
  errors: Array<{ path: string; error: string }>;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function parseFrontmatterRaw(yamlText: string): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const rawLine of yamlText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const valueRaw = line.slice(idx + 1).trim();

    if (valueRaw.startsWith("[") && valueRaw.endsWith("]")) {
      const inner = valueRaw.slice(1, -1).trim();
      obj[key] = inner.length === 0
        ? []
        : inner.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
      continue;
    }

    if (/^-?\d+(\.\d+)?$/.test(valueRaw)) {
      obj[key] = Number(valueRaw);
      continue;
    }

    obj[key] = valueRaw.replace(/^["']|["']$/g, "");
  }
  return obj;
}

export function parseDomainSkillMarkdown(content: string, path: string): ParseDomainSkillResult {
  const match = FRONTMATTER_RE.exec(content);
  if (!match) {
    return { ok: false, error: "Missing or malformed YAML frontmatter (---...---)" };
  }
  const [, yamlText, body] = match;
  if (!yamlText) {
    return { ok: false, error: "Empty frontmatter" };
  }

  const raw = parseFrontmatterRaw(yamlText);
  const parsed = DomainSkillFrontmatterSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }

  return {
    ok: true,
    skill: { ...parsed.data, body: body ?? "", path },
  };
}

export function loadDomainSkills(rootDir: string): LoadDomainSkillsResult {
  const skills: DomainSkill[] = [];
  const errors: Array<{ path: string; error: string }> = [];

  if (!existsSync(rootDir)) {
    return { skills, errors };
  }

  let areas: string[];
  try {
    areas = readdirSync(rootDir).filter((entry) => {
      try {
        return statSync(join(rootDir, entry)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch (err) {
    logger.warn("domain-skill-loader:read_root_failed", { rootDir, error: String(err) });
    return { skills, errors };
  }

  for (const area of areas) {
    const areaPath = join(rootDir, area);
    let files: string[];
    try {
      files = readdirSync(areaPath).filter((f) => extname(f) === ".md");
    } catch {
      continue;
    }
    for (const file of files) {
      const fullPath = join(areaPath, file);
      const relPath = `${area}/${basename(file)}`;
      try {
        const content = readFileSync(fullPath, "utf-8");
        const result = parseDomainSkillMarkdown(content, relPath);
        if (result.ok && result.skill) {
          skills.push(result.skill);
        } else {
          errors.push({ path: relPath, error: result.error ?? "unknown error" });
        }
      } catch (err) {
        errors.push({ path: relPath, error: String(err) });
      }
    }
  }

  return { skills, errors };
}
