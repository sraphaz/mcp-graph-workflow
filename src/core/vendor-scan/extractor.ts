/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-vendor-insights-scanner — Task 1.2: symbol extractor.
 *
 * Extracts exports/symbols from .py, .ts, and .md vendor files.
 * Python: regex top-level detection. TypeScript: acorn AST with regex fallback.
 * Markdown: header + paragraph extraction.
 * All paths are wrapped — never throws, returns parseError on failure.
 */

import * as acorn from "acorn";

export interface ExtractedSymbol {
  name: string;
  kind: "function" | "class" | "export" | "header";
  docstring?: string;
}

export interface ExtractionResult {
  symbols: ExtractedSymbol[];
  parseError?: string;
}

// ── Python (.py) ─────────────────────────────────────────

const PY_TOP_LEVEL = /^(?:(async def |def |class ))(\w+)/;

function extractPython(content: string): ExtractionResult {
  const symbols: ExtractedSymbol[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = PY_TOP_LEVEL.exec(line);
    if (!m) continue;

    const keyword = m[1].trim();
    const name = m[2];
    const kind: ExtractedSymbol["kind"] = keyword === "class" ? "class" : "function";

    const nextLine = lines[i + 1]?.trimStart();
    let docstring: string | undefined;
    if (nextLine?.startsWith('"""') || nextLine?.startsWith("'''")) {
      const q = nextLine.startsWith('"""') ? '"""' : "'''";
      const body = nextLine.slice(3);
      const closeIdx = body.indexOf(q);
      const raw = closeIdx >= 0 ? body.slice(0, closeIdx) : body;
      docstring = raw.trim() || undefined;
    }

    symbols.push({ name, kind, ...(docstring !== undefined ? { docstring } : {}) });
  }

  return { symbols };
}

// ── TypeScript (.ts) — acorn AST ─────────────────────────

type AcornNode = acorn.Node & Record<string, unknown>;

function nodeId(node: AcornNode): string | null {
  const id = node.id as AcornNode | undefined;
  return id?.type === "Identifier" ? (id.name as string) : null;
}

function extractTypeScript(content: string): ExtractionResult {
  let ast: acorn.Node;
  try {
    ast = acorn.parse(content, { ecmaVersion: "latest", sourceType: "module" });
  } catch (err) {
    return { symbols: [], parseError: err instanceof Error ? err.message : String(err) };
  }

  const symbols: ExtractedSymbol[] = [];
  const body = (ast as AcornNode).body as AcornNode[];

  for (const node of body) {
    if (node.type === "ExportNamedDeclaration") {
      const decl = node.declaration as AcornNode | null;
      if (decl) {
        const name = nodeId(decl) ??
          ((decl.type === "VariableDeclaration")
            ? ((decl.declarations as AcornNode[])[0]?.id as AcornNode)?.name as string | undefined
            : undefined);
        if (name) symbols.push({ name, kind: "export" });
      }
      const specifiers = (node.specifiers as AcornNode[]) ?? [];
      for (const spec of specifiers) {
        const exported = spec.exported as AcornNode;
        const name = exported?.name as string | undefined;
        if (name) symbols.push({ name, kind: "export" });
      }
    } else if (node.type === "ExportDefaultDeclaration") {
      const decl = node.declaration as AcornNode;
      const name = nodeId(decl) ?? "default";
      symbols.push({ name, kind: "export" });
    }
  }

  return { symbols };
}

// ── Markdown (.md) ────────────────────────────────────────

const MD_HEADER = /^(#{1,2})\s+(.+)/;

function extractMarkdown(content: string): ExtractionResult {
  const symbols: ExtractedSymbol[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const m = MD_HEADER.exec(lines[i]);
    if (!m) continue;

    const name = m[2].trim();

    // Collect the first non-empty paragraph after the header
    const paragraphLines: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const trimmed = lines[j].trim();
      if (MD_HEADER.test(lines[j])) break;
      if (trimmed === "") {
        if (paragraphLines.length > 0) break;
        continue;
      }
      paragraphLines.push(trimmed);
    }

    const raw = paragraphLines.join(" ");
    const docstring = raw.slice(0, 200) || undefined;
    symbols.push({ name, kind: "header", ...(docstring !== undefined ? { docstring } : {}) });
  }

  return { symbols };
}

// ── Public API ────────────────────────────────────────────

export function extractSymbols(content: string, ext: string): ExtractionResult {
  try {
    switch (ext) {
      case ".py": return extractPython(content);
      case ".ts": return extractTypeScript(content);
      case ".md": return extractMarkdown(content);
      default: return { symbols: [] };
    }
  } catch (err) {
    return { symbols: [], parseError: err instanceof Error ? err.message : String(err) };
  }
}
