import { describe, it, expect } from 'vitest';
import { classifyTools, getLayerDistribution, getToolLayer } from '../core/insights/deterministic-layers.js';

describe('Deterministic Layers Harness', () => {
  it('should classify all tools as deterministic (L0-L4)', () => {
    const classifications = classifyTools();
    // After v8.0 consolidation (davinci, siebel, knowledge, context, rag_context etc. merged)
    expect(classifications.length).toBeGreaterThanOrEqual(40);
    
    // Ensure every tool has a layer and rationale
    classifications.forEach(tool => {
      expect(tool.layer).toBeDefined();
      expect(tool.rationale.length).toBeGreaterThan(0);
    });
  });

  it('should provide a correct layer distribution', () => {
    const dist = getLayerDistribution();
    const total = Object.values(dist).reduce((a, b) => a + b, 0);
    const classifications = classifyTools();
    
    expect(total).toBe(classifications.length);
    expect(dist.L0_SQL).toBeGreaterThan(0);
    expect(dist.L2_Heuristic).toBeGreaterThan(0);
  });

  it('should correctly identify specific tool layers', () => {
    const startTask = getToolLayer('start_task');
    expect(startTask?.layer).toBe('L3_PropertyBased');

    const search = getToolLayer('search');
    expect(search?.layer).toBe('L0_SQL');

    const next = getToolLayer('next');
    expect(next?.layer).toBe('L2_Heuristic');

    const writeMemory = getToolLayer('write_memory');
    expect(writeMemory?.layer).toBe('L4_MetaRule');
  });

  it('should return undefined for unknown tools', () => {
    expect(getToolLayer('non_existent_tool')).toBeUndefined();
  });

  it('should maintain 100% deterministic score (no AI fallback)', () => {
    const classifications = classifyTools();
    // In v7.0, no tool should be classified as AI or have no layer
    const nonDeterministic = classifications.filter(c => !c.layer.startsWith('L'));
    expect(nonDeterministic.length).toBe(0);
  });
});
