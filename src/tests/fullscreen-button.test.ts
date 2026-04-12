/**
 * TDD tests for FullscreenButton component
 * Task 2.2: FullscreenButton component
 * Node: node_b1938cd7b18c (parent: node_c01b30d57ab3)
 */
import { describe, it, expect } from 'vitest';

describe('FullscreenButton component exports', () => {
  it('should export FullscreenButton as a named export', async () => {
    const mod = await import('../web/dashboard/src/components/ui/fullscreen-button.js');
    expect(mod.FullscreenButton).toBeDefined();
    // memo wraps as object
    expect(mod.FullscreenButton).toHaveProperty('$$typeof');
  });

  it('should be a memo-wrapped component named FullscreenButton', async () => {
    const mod = await import('../web/dashboard/src/components/ui/fullscreen-button.js');
    expect(mod.FullscreenButton).toHaveProperty('type');
    expect(typeof mod.FullscreenButton.type).toBe('function');
    expect(mod.FullscreenButton.type.name).toBe('FullscreenButton');
  });
});
