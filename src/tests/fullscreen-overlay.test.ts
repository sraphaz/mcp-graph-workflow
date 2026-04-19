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
