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

import { describe, it, expect } from 'vitest';
import { extractAgentId } from '../mcp/agent-identity.js';

describe('MCP Agent Identity Extraction', () => {
  it('should extract agentId from meta.sessionId', () => {
    const extra = { meta: { sessionId: 'session-abc-123' } };
    expect(extractAgentId(extra)).toBe('session-abc-123');
  });

  it('should extract agentId from meta.agentId', () => {
    const extra = { meta: { agentId: 'claude-opus-1' } };
    expect(extractAgentId(extra)).toBe('claude-opus-1');
  });

  it('should prefer meta.agentId over meta.sessionId', () => {
    const extra = { meta: { agentId: 'agent-1', sessionId: 'session-2' } };
    expect(extractAgentId(extra)).toBe('agent-1');
  });

  it('should return "unknown" when no meta available', () => {
    expect(extractAgentId({})).toBe('unknown');
    expect(extractAgentId(undefined)).toBe('unknown');
    expect(extractAgentId(null)).toBe('unknown');
  });

  it('should return "unknown" when meta has no identity fields', () => {
    const extra = { meta: { someOtherField: 'value' } };
    expect(extractAgentId(extra)).toBe('unknown');
  });

  it('should handle string meta gracefully', () => {
    const extra = { meta: 'not-an-object' };
    expect(extractAgentId(extra)).toBe('unknown');
  });
});
