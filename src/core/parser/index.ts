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

export { isMetadataLine, classifyText, classifySectionTitle, classifySection, classifyTableRows } from './classify.js';
export type { BlockType, ClassifiedBlock, ClassifiedItem } from './classify.js';
export { extractEntities } from './extract.js';
export type { ExtractionResult } from './extract.js';
export { readFileContent, isSupportedFormat } from './file-reader.js';
export type { FileReadResult } from './file-reader.js';
export { normalize } from './normalize.js';
export { diffPrd } from './prd-diff.js';
export type { PrdDiffSection, PrdDiffResult } from './prd-diff.js';
export { isDocxSupported, readDocxContent } from './read-docx.js';
export { readPrdFile } from './read-file.js';
export type { PrdFileResult } from './read-file.js';
export { readHtmlContent } from './read-html.js';
export { readPdfBuffer } from './read-pdf.js';
export { parseSwaggerContent, parseWsdlContent } from './read-swagger.js';
export type { SwaggerEndpointParam, SwaggerEndpoint, SwaggerSchemaProperty, SwaggerSchema, SwaggerParseResult } from './read-swagger.js';
export { segment, extractTableSections } from './segment.js';
export type { Section } from './segment.js';
