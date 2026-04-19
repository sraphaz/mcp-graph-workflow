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
 * Parser Adapter interface — language-agnostic contract for parsing code into
 * canonical constructs from the UCR (Universal Construct Registry).
 */

/** A construct detected in source code, mapped to a UCR canonical ID. */
export interface ParsedConstruct {
  /** UCR canonical construct ID (e.g., "uc_fn_def", "uc_class_def") */
  constructId: string;
  /** Name of the construct if applicable (function name, class name, etc.) */
  name?: string;
  /** 1-based start line in source */
  startLine: number;
  /** 1-based end line in source */
  endLine: number;
  /** Raw source text for this construct (populated by SourceTextExtractor or AST) */
  sourceText?: string;
  /** Resolved placeholder values from AST extraction (name, params, body, etc.) */
  resolvedPlaceholders?: Record<string, string>;
}

/** Adapter interface for language-specific parsers. */
export interface ParserAdapter {
  /** Language identifier (matches UCR language_id, e.g., "typescript", "python") */
  readonly languageId: string;

  /** Parse a code snippet and return detected canonical constructs. */
  parseSnippet(code: string): ParsedConstruct[];
}
