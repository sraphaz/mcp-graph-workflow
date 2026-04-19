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

export { generateReadmeStats, generateArchToolSection, generateArchRouteSection, generateToolRefSummary } from './doc-generator.js';
export { applySectionWithName } from './doc-updater.js';
export { DocsCacheStore } from './docs-cache-store.js';
export type { CachedDoc } from './docs-cache-store.js';
export { DocsSyncer } from './docs-syncer.js';
export type { Context7Fetcher } from './docs-syncer.js';
export type { DocsManifest } from './generate-docs-manifest.js';
export { createMcpContext7Fetcher } from './mcp-context7-fetcher.js';
export type { Context7FetcherOptions } from './mcp-context7-fetcher.js';
export { introspectRoutes } from './route-introspector.js';
export type { EndpointInfo, RouteInfo } from './route-introspector.js';
export { detectStack } from './stack-detector.js';
export type { DetectedStack } from './stack-detector.js';
export { introspectTools } from './tool-introspector.js';
export type { ToolInfo } from './tool-introspector.js';
