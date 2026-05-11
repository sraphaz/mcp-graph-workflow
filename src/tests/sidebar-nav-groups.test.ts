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
 * TDD tests for NAV_GROUPS refactoring
 * Task: Refatorar NAV_ITEMS de array flat para grupos
 * Node: node_12980faca2b5
 *
 * Data extracted to nav-config.ts (no React deps) for testability.
 */
import { describe, it, expect } from 'vitest';
import { NAV_GROUPS, NAV_ITEMS } from '../web/dashboard/src/components/layout/nav-config.js';

describe('NAV_GROUPS structure', () => {
  it('should export NAV_GROUPS array with 4 groups', () => {
    expect(NAV_GROUPS).toBeDefined();
    expect(Array.isArray(NAV_GROUPS)).toBe(true);
    expect(NAV_GROUPS).toHaveLength(4);
  });

  it('each group should have id, label, icon, items', () => {
    for (const group of NAV_GROUPS) {
      expect(group).toHaveProperty('id');
      expect(group).toHaveProperty('label');
      expect(group).toHaveProperty('icon');
      expect(group).toHaveProperty('items');
      expect(typeof group.id).toBe('string');
      expect(typeof group.label).toBe('string');
      expect(Array.isArray(group.items)).toBe(true);
      expect(group.items.length).toBeGreaterThan(0);
    }
  });

  it('group ids should be visualization, intelligence, tools, system', () => {
    const ids = NAV_GROUPS.map((g) => g.id);
    expect(ids).toEqual(['visualization', 'intelligence', 'tools', 'system']);
  });

  it('visualization group should contain Overview, Graph, PRD & Backlog, Kanban, Journey', () => {
    const vizGroup = NAV_GROUPS.find((g) => g.id === 'visualization')!;
    const tabIds = vizGroup.items.map((i) => i.id);
    expect(tabIds).toEqual(['overview', 'graph', 'prd-backlog', 'kanban', 'journey']);
  });

  it('intelligence group should contain Memories, Insights, Skills, Harness, Autopilot, Agents', () => {
    const intGroup = NAV_GROUPS.find((g) => g.id === 'intelligence')!;
    const tabIds = intGroup.items.map((i) => i.id);
    expect(tabIds).toEqual(['memories', 'insights', 'skills', 'harness', 'autopilot', 'agents']);
  });

  it('tools group should contain Context, Benchmark, Browser Pilot, Languages, DaVinci, Siebel, LSP', () => {
    const toolsGroup = NAV_GROUPS.find((g) => g.id === 'tools')!;
    const tabIds = toolsGroup.items.map((i) => i.id);
    expect(tabIds).toEqual(['context', 'benchmark', 'browser-pilot', 'languages', 'davinci', 'siebel', 'lsp']);
  });

  it('system group should contain Docs, Logs', () => {
    const sysGroup = NAV_GROUPS.find((g) => g.id === 'system')!;
    const tabIds = sysGroup.items.map((i) => i.id);
    expect(tabIds).toEqual(['docs', 'logs']);
  });

  it('all 20 tabs should be present across all groups (no duplicates)', () => {
    const allTabIds = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id));
    expect(allTabIds).toHaveLength(20);
    const expectedIds = new Set([
      'overview', 'graph', 'prd-backlog', 'kanban', 'journey',
      'memories', 'insights', 'skills', 'harness', 'autopilot', 'agents',
      'context', 'benchmark', 'browser-pilot', 'languages', 'davinci', 'siebel', 'lsp',
      'docs', 'logs',
    ]);
    expect(new Set(allTabIds)).toEqual(expectedIds);
  });

  it('should export NAV_ITEMS as flat array for backward compat', () => {
    expect(NAV_ITEMS).toBeDefined();
    expect(Array.isArray(NAV_ITEMS)).toBe(true);
    expect(NAV_ITEMS).toHaveLength(20);
  });

  it('NAV_ITEMS should equal the flat of NAV_GROUPS items', () => {
    const flatFromGroups = NAV_GROUPS.flatMap((g) => g.items);
    expect(NAV_ITEMS).toEqual(flatFromGroups);
  });

  it('each NavItem should have id, label, icon', () => {
    for (const item of NAV_ITEMS) {
      expect(typeof item.id).toBe('string');
      expect(typeof item.label).toBe('string');
      expect(item.icon).toBeDefined();
    }
  });

  it('group labels should match PRD spec', () => {
    const labels = NAV_GROUPS.map((g) => g.label);
    expect(labels).toEqual(['Visualize', 'Intelligence', 'Tools', 'System']);
  });
});
