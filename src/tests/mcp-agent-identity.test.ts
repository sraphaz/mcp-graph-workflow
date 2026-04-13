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
