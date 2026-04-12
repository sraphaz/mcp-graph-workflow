/**
 * TDD tests for FullscreenOverlay component
 * Task 2.3: FullscreenOverlay component
 * Node: node_166bcd344a01 (parent: node_2e3cf7e4a916)
 */
import { describe, it, expect } from 'vitest';

describe('FullscreenOverlay component exports', () => {
  it('should export FullscreenOverlay as a memo-wrapped component', async () => {
    const mod = await import('../web/dashboard/src/components/ui/fullscreen-overlay.js');
    expect(mod.FullscreenOverlay).toBeDefined();
    expect(mod.FullscreenOverlay).toHaveProperty('$$typeof');
    expect(mod.FullscreenOverlay).toHaveProperty('type');
    expect(typeof mod.FullscreenOverlay.type).toBe('function');
    expect(mod.FullscreenOverlay.type.name).toBe('FullscreenOverlay');
  });
});
