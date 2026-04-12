/**
 * TDD tests for SidebarGroup component
 * Task 1.2: Implementar SidebarGroup component
 * Node: node_4efd4a4a8c4e (parent: node_d66567498666)
 *
 * Structural tests — no DOM env available.
 * Visual/ARIA/keyboard testing via Playwright E2E.
 */
import { describe, it, expect } from 'vitest';

describe('SidebarGroup component exports', () => {
  it('should export SidebarGroup as a named export', async () => {
    const mod = await import('../web/dashboard/src/components/layout/sidebar-group.js');
    expect(mod.SidebarGroup).toBeDefined();
    // memo() wraps components as objects with $$typeof
    expect(mod.SidebarGroup).toHaveProperty('$$typeof');
  });

  it('SidebarGroup should be a memo-wrapped component', async () => {
    const mod = await import('../web/dashboard/src/components/layout/sidebar-group.js');
    // React.memo returns an object with type property pointing to the original component
    expect(mod.SidebarGroup).toHaveProperty('type');
    expect(typeof mod.SidebarGroup.type).toBe('function');
    expect(mod.SidebarGroup.type.name).toBe('SidebarGroup');
  });
});

describe('SidebarGroup integration with nav-config', () => {
  it('NAV_GROUPS items should be compatible with SidebarGroup props', async () => {
    const { NAV_GROUPS } = await import('../web/dashboard/src/components/layout/nav-config.js');
    for (const group of NAV_GROUPS) {
      expect(group).toHaveProperty('id');
      expect(group).toHaveProperty('label');
      expect(group).toHaveProperty('icon');
      expect(group).toHaveProperty('items');
      for (const item of group.items) {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('label');
        expect(item).toHaveProperty('icon');
      }
    }
  });
});
