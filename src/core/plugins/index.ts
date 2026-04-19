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

export { HookSystem } from './hook-system.js';
export type { HookPoint, HookContext, HookRegistration, HookExecutionResult } from './hook-system.js';
export { PluginCircularDependencyError, resolveLoadOrder, PluginLoader } from './plugin-loader.js';
export type { PluginContext, PluginInstance } from './plugin-loader.js';
export { PluginConflictError, PluginDependencyError, PluginDependentError, PluginNotFoundError, PluginRegistry } from './plugin-registry.js';
export type { PluginManifest, PluginStatus, PluginRegistration } from './plugin-registry.js';
export { PluginStore } from './plugin-store.js';
export type { PluginRow, InstallPluginParams } from './plugin-store.js';
export { PluginToolRegistry } from './plugin-tool-registry.js';
export type { PluginToolRegistration } from './plugin-tool-registry.js';
