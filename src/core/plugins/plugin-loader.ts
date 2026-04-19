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
 * Plugin Loader — dynamic ESM import with error boundaries.
 * Validates manifests, resolves dependencies via topological sort,
 * and activates plugins with PluginContext.
 * v1: blessed plugins only (local paths), no sandbox.
 */

import { logger } from "../utils/logger.js";
import { McpGraphError } from "../utils/errors.js";
import { PluginRegistry } from "./plugin-registry.js";
import type { PluginManifest } from "./plugin-registry.js";

export interface PluginContext {
  registerTool: (name: string, handler: unknown) => void;
  registerAnalyzer: (name: string, handler: unknown) => void;
  registerValidator: (name: string, handler: unknown) => void;
  registerClassifierPattern: (nodeType: string, patterns: string[]) => void;
  registerTemplate: (name: string, template: unknown) => void;
}

export interface PluginInstance {
  activate: (context: PluginContext) => void | Promise<void>;
  deactivate?: () => void | Promise<void>;
}

export class PluginCircularDependencyError extends McpGraphError {
  constructor(cycle: string[]) {
    super(`Circular dependency detected: ${cycle.join(" → ")}`);
    this.name = "PluginCircularDependencyError";
  }
}

/**
 * Topological sort of plugin manifests by dependency order.
 * Throws on circular dependencies.
 */
export function resolveLoadOrder(manifests: PluginManifest[]): PluginManifest[] {
  const nameToManifest = new Map(manifests.map((m) => [m.name, m]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const sorted: PluginManifest[] = [];

  function visit(name: string, path: string[]): void {
    if (visited.has(name)) return;
    if (visiting.has(name)) {
      throw new PluginCircularDependencyError([...path, name]);
    }

    visiting.add(name);
    const manifest = nameToManifest.get(name);
    if (manifest) {
      const deps = manifest.requires?.plugins ?? [];
      for (const dep of deps) {
        visit(dep, [...path, name]);
      }
      sorted.push(manifest);
    }
    visiting.delete(name);
    visited.add(name);
  }

  for (const manifest of manifests) {
    visit(manifest.name, []);
  }

  return sorted;
}

function createPluginContext(): PluginContext {
  return {
    registerTool: (_name: string, _handler: unknown) => {
      logger.debug(`Plugin registered tool: ${_name}`);
    },
    registerAnalyzer: (_name: string, _handler: unknown) => {
      logger.debug(`Plugin registered analyzer: ${_name}`);
    },
    registerValidator: (_name: string, _handler: unknown) => {
      logger.debug(`Plugin registered validator: ${_name}`);
    },
    registerClassifierPattern: (_nodeType: string, _patterns: string[]) => {
      logger.debug(`Plugin registered classifier patterns for: ${_nodeType}`);
    },
    registerTemplate: (_name: string, _template: unknown) => {
      logger.debug(`Plugin registered template: ${_name}`);
    },
  };
}

export class PluginLoader {
  private readonly instances: Map<string, PluginInstance> = new Map();

  constructor(private readonly registry: PluginRegistry) {}

  async loadPlugin(manifest: PluginManifest, instance: PluginInstance): Promise<void> {
    const context = createPluginContext();

    // Register in registry first (validates deps/conflicts)
    try {
      this.registry.register(manifest);
    } catch (err) {
      logger.error(`Plugin registration failed: ${manifest.name}`, { error: err instanceof Error ? err.message : String(err) });
      throw err;
    }

    // Activate with error boundary
    try {
      await instance.activate(context);
      this.instances.set(manifest.name, instance);
      logger.info(`Plugin activated: ${manifest.name}@${manifest.version}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      // Mark as error in registry instead of removing
      const registration = this.registry.get(manifest.name);
      if (registration) {
        registration.status = "error";
        registration.error = errorMsg;
      }
      logger.error(`Plugin activation failed: ${manifest.name}`, { error: errorMsg });
    }
  }

  async unloadPlugin(name: string): Promise<void> {
    const instance = this.instances.get(name);
    if (instance?.deactivate) {
      try {
        await instance.deactivate();
      } catch (err) {
        logger.error(`Plugin deactivation error: ${name}`, { error: err instanceof Error ? err.message : String(err) });
      }
    }
    this.instances.delete(name);
    this.registry.remove(name);
    logger.info(`Plugin unloaded: ${name}`);
  }

  async loadPlugins(manifests: PluginManifest[], instanceMap: Map<string, PluginInstance>): Promise<void> {
    const sorted = resolveLoadOrder(manifests);
    for (const manifest of sorted) {
      const instance = instanceMap.get(manifest.name);
      if (instance) {
        await this.loadPlugin(manifest, instance);
      }
    }
  }
}
