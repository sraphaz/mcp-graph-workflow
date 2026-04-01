/**
 * UniversalGenerator — UCR-based code generation for all language pairs.
 *
 * Uses:
 * 1. SourceTextExtractor — enriches constructs with source text from line ranges
 * 2. PlaceholderResolver — extracts {{name}}, {{params}}, {{body}} from source text
 * 3. UCR getPrimaryMapping — looks up target language syntax pattern
 * 4. Substitution — fills target pattern with resolved values
 *
 * Works for all 12x12 language pairs via UCR (831 patterns across 12 languages).
 */

import type { ConstructRegistry } from "../ucr/construct-registry.js";
import type { GeneratorAdapter, GeneratedCode } from "./generator-adapter.js";
import type { ParsedConstruct } from "../parsers/parser-adapter.js";
import { extractSourceText } from "./source-text-extractor.js";
import { resolvePlaceholders } from "./placeholder-resolver.js";

// ── Language-Specific Defaults ────────────────────

const DEFAULTS_BY_LANGUAGE: Record<string, Record<string, string>> = {
  python: {
    body: "pass  # TODO: implement",
    members: "pass  # TODO: members",
    params: "",
    value: "None",
    condition: "True  # condition",
    type: "Any",
    module: "module",
    expression: "None  # expression",
    error: "e",
    message: "'Error'",
    parent: "object",
    items: "items",
    item: "item",
    elseBody: "pass",
    variable: "item",
    iterable: "items",
  },
  go: {
    body: "// TODO: implement",
    members: "// TODO: members",
    params: "",
    value: "nil",
    condition: "true /* condition */",
    type: "interface{}",
    module: "\"module\"",
    expression: "nil /* expression */",
    error: "err",
    message: "\"Error\"",
    items: "items",
    item: "item",
    elseBody: "// TODO",
    variable: "item",
    iterable: "items",
  },
  // Default for brace-family languages (TS, Java, C#, Rust, C++, PHP, Swift, Kotlin, Scala, Dart)
  _default: {
    body: "// TODO: implement",
    members: "// TODO: members",
    params: "",
    value: "undefined",
    condition: "/* condition */",
    type: "unknown",
    module: "'./module'",
    expression: "/* expression */",
    error: "e",
    message: "'Error'",
    items: "items",
    item: "item",
    elseBody: "// TODO",
    variable: "item",
    iterable: "items",
  },
};

// ── UniversalGenerator ────────────────────────────

export class UniversalGenerator implements GeneratorAdapter {
  readonly languageId: string;

  constructor(
    private readonly registry: ConstructRegistry,
    targetLanguageId: string,
    private readonly sourceCode: string,
    private readonly sourceLanguageId: string,
  ) {
    this.languageId = targetLanguageId;
  }

  generate(constructs: ParsedConstruct[]): GeneratedCode {
    if (constructs.length === 0) {
      return { code: "", mappedConstructs: [], unmappedConstructs: [] };
    }

    // Step 1: Enrich constructs with source text (only if not already enriched by AST extractor)
    const needsEnrichment = constructs.length > 0 && !constructs[0].sourceText;
    const enriched = needsEnrichment
      ? extractSourceText(this.sourceCode, constructs, this.sourceLanguageId)
      : constructs;

    const lines: string[] = [];
    const mapped: string[] = [];
    const unmapped: string[] = [];

    for (const construct of enriched) {
      // Step 2: Look up target UCR pattern
      const mapping = this.registry.getPrimaryMapping(construct.constructId, this.languageId);

      if (!mapping || !mapping.syntaxPattern) {
        unmapped.push(construct.constructId);
        continue;
      }

      // Step 3: Use pre-resolved placeholders (from AST) or resolve from source text (regex fallback)
      const resolved = construct.resolvedPlaceholders
        ? { ...construct.resolvedPlaceholders }
        : construct.sourceText
          ? resolvePlaceholders(construct.sourceText, construct.constructId, this.sourceLanguageId)
          : {};

      // Always include name from construct if available and not already resolved
      if (construct.name && !resolved.name) {
        resolved.name = construct.name;
      }

      // Step 4: Substitute resolved values into target pattern
      const code = substituteValues(mapping.syntaxPattern, resolved, this.languageId);

      lines.push(code);
      mapped.push(construct.constructId);
    }

    return {
      code: lines.join("\n\n"),
      mappedConstructs: mapped,
      unmappedConstructs: unmapped,
    };
  }
}

// ── Substitution ──────────────────────────────────

/**
 * Substitute resolved placeholder values into a UCR syntax pattern.
 * Any remaining unresolved {{...}} get language-appropriate defaults.
 */
function substituteValues(
  pattern: string,
  resolved: Record<string, string>,
  targetLanguageId: string,
): string {
  let result = pattern;

  // First pass: substitute resolved values
  for (const [key, value] of Object.entries(resolved)) {
    // eslint-disable-next-line security/detect-non-literal-regexp
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }

  // Second pass: replace remaining unresolved {{...}} with defaults
  const defaults = DEFAULTS_BY_LANGUAGE[targetLanguageId] ?? DEFAULTS_BY_LANGUAGE._default;
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return defaults[key] ?? `/* ${key} */`;
  });

  return result;
}
