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
 * Generator Adapter interface — language-agnostic contract for generating code
 * from canonical constructs using UCR syntax patterns.
 */

import type { ParsedConstruct } from "../parsers/parser-adapter.js";

/** Result of code generation. */
export interface GeneratedCode {
  /** Generated source code */
  code: string;
  /** Construct IDs that were successfully mapped to syntax patterns */
  mappedConstructs: string[];
  /** Construct IDs that had no syntax pattern in the target language */
  unmappedConstructs: string[];
}

/** Adapter interface for language-specific code generators. */
export interface GeneratorAdapter {
  /** Target language identifier (matches UCR language_id) */
  readonly languageId: string;

  /** Generate code from parsed canonical constructs. */
  generate(constructs: ParsedConstruct[]): GeneratedCode;
}
