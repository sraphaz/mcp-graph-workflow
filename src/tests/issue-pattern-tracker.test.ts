/**
 * TDD tests for Issue Pattern Tracker (Harness Engineering — Steering Loop)
 * Task 1.1: Issue Pattern Tracker
 * Node: node_c25b25b6ef88
 *
 * Based on: "Harness Engineering for Coding Agent Users" (Böckeler, Thoughtworks 2026)
 * Concept: Steering Loop — auto-detect recurring issues and suggest rules
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteStore } from '../core/store/sqlite-store.js';
import { IssuePatternTracker } from '../core/harness/issue-pattern-tracker.js';

describe('IssuePatternTracker', () => {
  let store: SqliteStore;
  let tracker: IssuePatternTracker;

  beforeEach(() => {
    store = SqliteStore.open(':memory:');
    store.initProject('Harness Test');
    tracker = new IssuePatternTracker(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  describe('recordIssue', () => {
    it('should record a new pattern with count=1 on first detection', () => {
      tracker.recordIssue('missing_ac', 'node_123');
      const pattern = tracker.getPattern('missing_ac');
      expect(pattern).toBeDefined();
      expect(pattern!.count).toBe(1);
      expect(pattern!.patternType).toBe('missing_ac');
    });

    it('should increment count on subsequent detections', () => {
      tracker.recordIssue('missing_ac', 'node_1');
      tracker.recordIssue('missing_ac', 'node_2');
      tracker.recordIssue('missing_ac', 'node_3');
      const pattern = tracker.getPattern('missing_ac');
      expect(pattern!.count).toBe(3);
    });

    it('should track different patterns independently', () => {
      tracker.recordIssue('missing_ac', 'node_1');
      tracker.recordIssue('status_skip', 'node_2');
      tracker.recordIssue('missing_ac', 'node_3');

      expect(tracker.getPattern('missing_ac')!.count).toBe(2);
      expect(tracker.getPattern('status_skip')!.count).toBe(1);
    });

    it('should update last_seen timestamp on each detection', () => {
      tracker.recordIssue('missing_ac', 'node_1');
      const first = tracker.getPattern('missing_ac')!.lastSeen;

      tracker.recordIssue('missing_ac', 'node_2');
      const second = tracker.getPattern('missing_ac')!.lastSeen;

      expect(second).toBeDefined();
      // Timestamps should be valid ISO strings
      expect(new Date(first).getTime()).toBeLessThanOrEqual(new Date(second).getTime());
    });
  });

  describe('threshold and rule suggestion', () => {
    it('should not suggest rule when count < threshold', () => {
      tracker.recordIssue('missing_ac', 'node_1');
      tracker.recordIssue('missing_ac', 'node_2');
      const suggestions = tracker.getSuggestedRules();
      expect(suggestions).toHaveLength(0);
    });

    it('should suggest rule when count >= 3 (default threshold)', () => {
      tracker.recordIssue('missing_ac', 'node_1');
      tracker.recordIssue('missing_ac', 'node_2');
      tracker.recordIssue('missing_ac', 'node_3');
      const suggestions = tracker.getSuggestedRules();
      expect(suggestions.length).toBeGreaterThanOrEqual(1);
      expect(suggestions[0].patternType).toBe('missing_ac');
      expect(suggestions[0].suggestedRule).toBeDefined();
      expect(suggestions[0].suggestedRule.length).toBeGreaterThan(0);
    });

    it('should generate meaningful rule text for known patterns', () => {
      for (let i = 0; i < 3; i++) {
        tracker.recordIssue('status_skip', `node_${i}`);
      }
      const suggestions = tracker.getSuggestedRules();
      expect(suggestions[0].suggestedRule).toMatch(/status/i);
    });
  });

  describe('getStats', () => {
    it('should return total and recurring counts', () => {
      tracker.recordIssue('missing_ac', 'n1');
      tracker.recordIssue('missing_ac', 'n2');
      tracker.recordIssue('missing_ac', 'n3');
      tracker.recordIssue('status_skip', 'n4');

      const stats = tracker.getStats();
      expect(stats.total).toBe(2); // 2 unique patterns
      expect(stats.recurring).toBe(1); // 1 pattern with count >= 3
    });

    it('should return zero stats for empty tracker', () => {
      const stats = tracker.getStats();
      expect(stats.total).toBe(0);
      expect(stats.recurring).toBe(0);
    });
  });

  describe('getPattern', () => {
    it('should return null for unknown pattern', () => {
      expect(tracker.getPattern('nonexistent')).toBeNull();
    });
  });
});
