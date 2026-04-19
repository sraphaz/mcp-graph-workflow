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
import { fuseSensors, type DimensionScores, type SensorCluster } from '../../core/harness/sensor-fusion.js';

describe('Sensor Fusion Engine', () => {
  it('should identify {types, errors} cluster when both are low', () => {
    const scores: DimensionScores = {
      types: 45, tests: 80, naming: 90, errors: 30, context: 85, docs: 90, fitness: 95,
    };
    const clusters = fuseSensors(scores);
    const codeQuality = clusters.find((c: SensorCluster) =>
      c.affectedDimensions.includes('types') && c.affectedDimensions.includes('errors'),
    );
    expect(codeQuality).toBeDefined();
    expect(codeQuality!.rootCause).toBeTruthy();
  });

  it('should return clusters sorted by combinedImpact desc', () => {
    const scores: DimensionScores = {
      types: 40, tests: 50, naming: 30, errors: 35, context: 20, docs: 90, fitness: 95,
    };
    const clusters = fuseSensors(scores);
    expect(clusters.length).toBeGreaterThan(0);
    for (let i = 1; i < clusters.length; i++) {
      expect(clusters[i - 1].combinedImpact).toBeGreaterThanOrEqual(clusters[i].combinedImpact);
    }
  });

  it('should return each cluster with rootCause, affectedDimensions, combinedImpact', () => {
    const scores: DimensionScores = {
      types: 40, tests: 80, naming: 90, errors: 30, context: 85, docs: 90, fitness: 95,
    };
    const clusters = fuseSensors(scores);
    for (const c of clusters) {
      expect(c.rootCause).toBeTruthy();
      expect(c.affectedDimensions.length).toBeGreaterThanOrEqual(1);
      expect(c.combinedImpact).toBeGreaterThan(0);
    }
  });

  it('should return empty array when all dimensions >= 85', () => {
    const scores: DimensionScores = {
      types: 90, tests: 95, naming: 88, errors: 92, context: 86, docs: 100, fitness: 95,
    };
    const clusters = fuseSensors(scores);
    expect(clusters).toEqual([]);
  });

  it('should handle single weak dimension (no cluster partner)', () => {
    const scores: DimensionScores = {
      types: 50, tests: 90, naming: 95, errors: 90, context: 90, docs: 90, fitness: 95,
    };
    const clusters = fuseSensors(scores);
    expect(clusters.length).toBeGreaterThanOrEqual(1);
    const typeCluster = clusters.find((c: SensorCluster) => c.affectedDimensions.includes('types'));
    expect(typeCluster).toBeDefined();
  });
});
