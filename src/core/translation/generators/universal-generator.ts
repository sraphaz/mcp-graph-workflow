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

    // Step 2: Filter out child constructs (contained within parent line ranges)
    // Only generate top-level constructs — children are part of the parent's body
    const topLevel = filterTopLevelConstructs(enriched);

    const lines: string[] = [];
    const mapped: string[] = [];
    const unmapped: string[] = [];

    for (const construct of topLevel) {
      // Step 3: Look up target UCR pattern
      const mapping = this.registry.getPrimaryMapping(construct.constructId, this.languageId);

      if (!mapping || !mapping.syntaxPattern) {
        unmapped.push(construct.constructId);
        continue;
      }

      // Step 4: Use pre-resolved placeholders (from AST) or resolve from source text (regex fallback)
      const resolved = construct.resolvedPlaceholders
        ? { ...construct.resolvedPlaceholders }
        : construct.sourceText
          ? resolvePlaceholders(construct.sourceText, construct.constructId, this.sourceLanguageId)
          : {};

      // Always include name from construct if available and not already resolved
      if (construct.name && !resolved.name) {
        resolved.name = construct.name;
      }

      // Step 5: Transform params and types for target language
      if (resolved.params) {
        resolved.params = transformParams(resolved.params, this.sourceLanguageId, this.languageId);
      }
      if (resolved.returnType) {
        const typeMap = TYPE_MAP[this.languageId] ?? {};
        resolved.returnType = typeMap[resolved.returnType] ?? resolved.returnType;
      }

      // Step 6: Substitute resolved values into target pattern
      const code = substituteValues(mapping.syntaxPattern, resolved, this.languageId);

      lines.push(code);
      mapped.push(construct.constructId);
    }

    // Track all constructs (including filtered children) as mapped
    for (const cVar of enriched) {
      if (!topLevel.includes(cVar) && !unmapped.includes(cVar.constructId)) {
        mapped.push(cVar.constructId);
      }
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
  let resultValue = pattern;

  // First pass: substitute resolved values
  for (const [key, value] of Object.entries(resolved)) {
    // eslint-disable-next-line security/detect-non-literal-regexp
    resultValue = resultValue.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }

  // Second pass: replace remaining unresolved {{...}} with defaults
  const defaults = DEFAULTS_BY_LANGUAGE[targetLanguageId] ?? DEFAULTS_BY_LANGUAGE._default;
  resultValue = resultValue.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return defaults[key] ?? `/* ${key} */`;
  });

  return resultValue;
}

// ── Hierarchy Filter ──────────────────────────────

/**
 * Filter out child constructs that are contained within a parent's line range.
 * Only keep top-level constructs — children are already part of the parent's body.
 */
function filterTopLevelConstructs(constructs: ParsedConstruct[]): ParsedConstruct[] {
  if (constructs.length <= 1) return constructs;

  // Compute effective endLine from sourceText (parsers often set endLine = startLine)
  const withEffectiveEnd = constructs.map((c) => {
    const textLines = c.sourceText ? c.sourceText.split("\n").length : 1;
    const effectiveEnd = Math.max(c.endLine, c.startLine + textLines - 1);
    return { construct: c, effectiveEnd };
  });

  const topLevel: ParsedConstruct[] = [];

  for (const { construct: current } of withEffectiveEnd) {
    const found = withEffectiveEnd.find((w) => w.construct === current);
    const currentEnd = found ? found.effectiveEnd : current.endLine;

    // Check if this construct is contained within ANY other construct
    const isChild = withEffectiveEnd.some(
      ({ construct: other, effectiveEnd: otherEnd }) =>
        other !== current &&
        current.startLine >= other.startLine &&
        currentEnd <= otherEnd &&
        // Only filter if the parent is strictly larger
        (current.startLine > other.startLine || currentEnd < otherEnd),
    );

    if (!isChild) {
      topLevel.push(current);
    }
  }

  return topLevel;
}

// ── Param Transformation ──────────────────────────

/** Type mappings from source to target language. */
const TYPE_MAP: Record<string, Record<string, string>> = {
  python: {
    string: "str", number: "int", boolean: "bool", void: "None",
    String: "str", Integer: "int", Boolean: "bool",
    "int": "int", "float": "float", "double": "float",
    any: "Any", undefined: "None", null: "None",
  },
  go: {
    string: "string", number: "int", boolean: "bool", void: "",
    String: "string", Integer: "int", Boolean: "bool",
    "int": "int", "float": "float64", "double": "float64",
    any: "interface{}", undefined: "nil", null: "nil",
  },
  rust: {
    string: "String", number: "i32", boolean: "bool", void: "()",
    String: "String", Integer: "i32", Boolean: "bool",
    "int": "i32", "float": "f64", "double": "f64",
    any: "Box<dyn Any>", undefined: "()", null: "()",
  },
  typescript: {
    str: "string", int: "number", float: "number", bool: "boolean",
    None: "void", dict: "Record<string, unknown>", list: "unknown[]",
    String: "string", Integer: "number", Boolean: "boolean",
  },
  java: {
    string: "String", number: "int", boolean: "boolean", void: "void",
    str: "String", int: "int", float: "float", bool: "boolean",
    None: "void",
  },
};

/** Languages where types come AFTER the parameter name (e.g., Go: `name string`). */
const TYPE_AFTER_NAME = new Set(["go", "rust"]);

/** Languages that are dynamically typed (strip type annotations). */
const DYNAMIC_TYPED = new Set(["python", "ruby", "php", "lua", "elixir"]);

/**
 * Transform parameter string from source language syntax to target language syntax.
 * Handles: type stripping for dynamic languages, type reordering for Go/Rust,
 * and type name mapping.
 */
function transformParams(params: string, sourceLang: string, targetLang: string): string {
  if (!params.trim()) return params;

  // For dynamic targets: strip type annotations
  if (DYNAMIC_TYPED.has(targetLang)) {
    return stripTypeAnnotations(params, sourceLang);
  }

  // For typed targets: map type names
  const typeMap = TYPE_MAP[targetLang] ?? {};
  return mapParamTypes(params, sourceLang, targetLang, typeMap);
}

/** Strip type annotations from params for dynamically-typed targets. */
function stripTypeAnnotations(params: string, sourceLang: string): string {
  return params
    .split(",")
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return trimmed;

      // TS style: `name: string`
      const tsMatch = trimmed.match(/^(\w+)\s*:\s*.+$/);
      if (tsMatch) return tsMatch[1];

      // Go style first (when source is Go): `name type` — must check before javaMatch
      // because javaMatch matches the same pattern but with inverted semantics
      if (sourceLang === "go") {
        const goMatch = trimmed.match(/^(\w+)\s+\w+$/);
        if (goMatch) return goMatch[1];
      }

      // Java/C# style: `Type name` or `final Type name`
      // eslint-disable-next-line security/detect-unsafe-regex
      const javaMatch = trimmed.match(/^(?:(?:final|const)\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)$/);
      if (javaMatch) return javaMatch[2];

      return trimmed;
    })
    .join(", ");
}

/** Map type names in params for statically-typed targets. */
function mapParamTypes(params: string, sourceLang: string, targetLang: string, typeMap: Record<string, string>): string {
  return params
    .split(",")
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return trimmed;

      // TS style: `name: string` → target style
      const tsMatch = trimmed.match(/^(\w+)\s*:\s*(\w+)$/);
      if (tsMatch) {
        const [, name, type] = tsMatch;
        const mappedType = typeMap[type] ?? type;
        if (TYPE_AFTER_NAME.has(targetLang)) return `${name} ${mappedType}`;
        return `${name}: ${mappedType}`;
      }

      // Go style first (when source is Go): `name type` — name comes first
      if (sourceLang === "go") {
        const goMatch = trimmed.match(/^(\w+)\s+(\w+)$/);
        if (goMatch) {
          const [, name, type] = goMatch;
          const mappedType = typeMap[type] ?? type;
          if (TYPE_AFTER_NAME.has(targetLang)) return `${name} ${mappedType}`;
          if (targetLang === "typescript") return `${name}: ${mappedType}`;
          return `${mappedType} ${name}`;
        }
      }

      // Java/C# style: `Type name` → target style
      // eslint-disable-next-line security/detect-unsafe-regex
      const javaMatch = trimmed.match(/^(\w+(?:<[^>]+>)?)\s+(\w+)$/);
      if (javaMatch) {
        const [, type, name] = javaMatch;
        const mappedType = typeMap[type] ?? type;
        if (TYPE_AFTER_NAME.has(targetLang)) return `${name} ${mappedType}`;
        if (targetLang === "typescript") return `${name}: ${mappedType}`;
        return `${mappedType} ${name}`;
      }

      return trimmed;
    })
    .join(", ");
}
