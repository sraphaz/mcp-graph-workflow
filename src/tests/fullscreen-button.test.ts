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
