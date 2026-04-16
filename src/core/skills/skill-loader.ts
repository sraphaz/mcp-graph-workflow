/**
 * Skill Loader — parses SKILL.md files with YAML frontmatter into CustomSkillInput.
 * Supports toolchain, triggers, and contextTemplate fields.
 * Inspired by hermes-agent skill system with progressive disclosure.
 */

import { CustomSkillInputSchema, type CustomSkillInput } from "../../schemas/skill.schema.js";
import { logger } from "../utils/logger.js";

export interface SkillMarkdownResult {
  ok: boolean;
  skill?: CustomSkillInput;
  error?: string;
}

/**
 * Simple YAML frontmatter parser — handles basic key:value, arrays, and nested objects.
 * Not a full YAML parser, but sufficient for SKILL.md frontmatter.
 */
function parseFrontmatter(yamlText: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yamlText.split("\n");
  let currentKey = "";
  let inArray = false;
  let arrayItems: unknown[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Inline array: key: [val1, val2]
    const inlineArrayMatch = trimmed.match(/^(\w+):\s*\[([^\]]*)\]$/);
    if (inlineArrayMatch) {
      const key = inlineArrayMatch[1];
      const values = inlineArrayMatch[2].split(",").map((v) => v.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
      result[key] = values;
      inArray = false;
      continue;
    }

    // Array item: - value or - event: "..." etc.
    if (trimmed.startsWith("- ")) {
      if (inArray) {
        const itemText = trimmed.slice(2).trim();
        // Check for key: value object style
        const objMatch = itemText.match(/^(\w+):\s*"?([^"]*)"?$/);
        if (objMatch) {
          // Look ahead for more keys at same indent
          const obj: Record<string, string> = { [objMatch[1]]: objMatch[2] };
          // Simple: just parse this line as single-key object
          // Multi-key objects will be handled by next lines checking indent
          arrayItems.push(obj);
        } else {
          arrayItems.push(itemText.replace(/^["']|["']$/g, ""));
        }
      }
      continue;
    }

    // Sub-key of array object: condition: "..."
    if (/^\s{2,}\w+:/.test(line) && inArray && arrayItems.length > 0) {
      const subMatch = trimmed.match(/^(\w+):\s*"?([^"]*)"?$/);
      if (subMatch) {
        const lastItem = arrayItems[arrayItems.length - 1];
        if (typeof lastItem === "object" && lastItem !== null) {
          (lastItem as Record<string, string>)[subMatch[1]] = subMatch[2];
        }
      }
      continue;
    }

    // Key: value pair
    const kvMatch = trimmed.match(/^(\w+):\s*(.+)$/);
    if (kvMatch) {
      // Commit previous array if any
      if (inArray && currentKey) {
        result[currentKey] = arrayItems;
        inArray = false;
        arrayItems = [];
      }

      const key = kvMatch[1];
      const value = kvMatch[2].trim().replace(/^["']|["']$/g, "");
      result[key] = value;
      currentKey = key;
      continue;
    }

    // Key with no value (starts array)
    const arrayStartMatch = trimmed.match(/^(\w+):$/);
    if (arrayStartMatch) {
      if (inArray && currentKey) {
        result[currentKey] = arrayItems;
      }
      currentKey = arrayStartMatch[1];
      inArray = true;
      arrayItems = [];
      continue;
    }
  }

  // Commit final array
  if (inArray && currentKey) {
    result[currentKey] = arrayItems;
  }

  return result;
}

/**
 * Parse a SKILL.md file content into a CustomSkillInput.
 * Expects YAML frontmatter between --- markers, followed by markdown body.
 */
export function parseSkillMarkdown(content: string): SkillMarkdownResult {
  // Extract frontmatter
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!frontmatterMatch) {
    return { ok: false, error: "No YAML frontmatter found. SKILL.md must start with --- markers." };
  }

  const yamlText = frontmatterMatch[1];
  const bodyText = frontmatterMatch[2].trim();

  // Parse frontmatter
  let frontmatter: Record<string, unknown>;
  try {
    frontmatter = parseFrontmatter(yamlText);
  } catch (err) {
    return { ok: false, error: `YAML parse error: ${err instanceof Error ? err.message : String(err)}` };
  }

  // Build skill input
  const raw = {
    name: frontmatter.name,
    description: frontmatter.description,
    category: frontmatter.category ?? "know-me",
    phases: frontmatter.phases,
    instructions: bodyText,
    toolchain: frontmatter.toolchain,
    triggers: frontmatter.triggers,
    contextTemplate: frontmatter.contextTemplate,
  };

  // Validate with Zod
  const parsed = CustomSkillInputSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    logger.warn("skill-loader:validation_failed", { issues });
    return { ok: false, error: `Validation failed: ${issues}` };
  }

  return { ok: true, skill: parsed.data };
}
