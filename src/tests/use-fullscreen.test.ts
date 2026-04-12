/**
 * TDD tests for useFullscreen hook
 * Task 2.1: Hook use-fullscreen.ts
 * Node: node_7325a7f91cfe (parent: node_50b8008784e7)
 *
 * Structural tests — no DOM env. Tests hook exports and logic.
 */
import { describe, it, expect } from 'vitest';

describe('useFullscreen hook exports', () => {
  it('should export useFullscreen as a named function', async () => {
    const mod = await import('../web/dashboard/src/hooks/use-fullscreen.js');
    expect(mod.useFullscreen).toBeDefined();
    expect(typeof mod.useFullscreen).toBe('function');
  });

  it('should export FULLSCREEN_SHORTCUT constant', async () => {
    const mod = await import('../web/dashboard/src/hooks/use-fullscreen.js');
    expect(mod.FULLSCREEN_SHORTCUT).toBeDefined();
    expect(typeof mod.FULLSCREEN_SHORTCUT).toBe('string');
    // Should contain the shortcut description
    expect(mod.FULLSCREEN_SHORTCUT).toMatch(/Cmd|Ctrl/i);
  });

  it('should export isFullscreenSupported function', async () => {
    const mod = await import('../web/dashboard/src/hooks/use-fullscreen.js');
    expect(mod.isFullscreenSupported).toBeDefined();
    expect(typeof mod.isFullscreenSupported).toBe('function');
  });

  it('isFullscreenSupported should return boolean', async () => {
    const mod = await import('../web/dashboard/src/hooks/use-fullscreen.js');
    // In Node/test env, document doesn't have fullscreenEnabled
    const result = mod.isFullscreenSupported();
    expect(typeof result).toBe('boolean');
  });
});
