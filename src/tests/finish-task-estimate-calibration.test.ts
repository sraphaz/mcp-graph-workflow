/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 2.3: Delta planejado vs real persistido ao finish_task
 * Tests for estimate calibration — computeEstimateDelta + computeSizeCalibration.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { makeNode } from "./helpers/factories.js";
import {
  computeEstimateDelta,
  computeSizeCalibration,
  type SizeCalibrationReport,
} from "../core/analyzer/estimate-calibration-analyzer.js";

describe("computeEstimateDelta", () => {
  // AC1: GIVEN task with estimateMinutes=120 and completionHours=3.5
  //       WHEN computed THEN estimateDelta = +1.5 (horas a mais)
  it("computes positive delta when task ran over estimate", () => {
    const delta = computeEstimateDelta(3.5, 120);
    expect(delta).toBeCloseTo(1.5, 5);
  });

  it("computes negative delta when task finished under estimate", () => {
    const delta = computeEstimateDelta(0.5, 120);
    expect(delta).toBeCloseTo(-1.5, 5);
  });

  it("computes zero delta when actual matches estimate exactly", () => {
    const delta = computeEstimateDelta(2, 120);
    expect(delta).toBeCloseTo(0, 5);
  });

  // AC3: GIVEN task without estimateMinutes WHEN computed THEN returns null
  it("returns null when estimateMinutes is 0 or absent", () => {
    expect(computeEstimateDelta(3.5, 0)).toBeNull();
    expect(computeEstimateDelta(3.5, undefined)).toBeNull();
  });

  it("returns null when completionHours is 0", () => {
    expect(computeEstimateDelta(0, 120)).toBeNull();
  });
});

describe("computeSizeCalibration", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Calibration Test");
  });

  afterEach(() => {
    store.close();
  });

  // AC2: GIVEN 5+ M tasks with estimateDelta persisted
  //       WHEN analyze(mode:"estimate_calibration") called
  //       THEN returns { M: { avg_delta, bias_pct, confidence: medium } }
  it("returns calibration report with medium confidence for 5+ same-size tasks", () => {
    // Insert 5 done tasks of size M with estimateDelta in metadata
    for (let i = 0; i < 5; i++) {
      const node = makeNode({
        id: `task-m-${i}`,
        title: `M Task ${i}`,
        status: "done",
        xpSize: "M",
        estimateMinutes: 120, // 2h estimate
        metadata: { estimateDelta: 0.9 + i * 0.1 } as Record<string, unknown>, // ~0.9-1.3h over
      });
      store.insertNode(node);
    }

    const report = computeSizeCalibration(store);

    expect(report).toBeDefined();
    expect(report.M).toBeDefined();
    expect(report.M!.avg_delta).toBeGreaterThan(0);
    expect(report.M!.bias_pct).toBeGreaterThan(0);
    expect(report.M!.confidence).toBe("medium"); // 5 samples = medium
    expect(report.M!.count).toBe(5);
  });

  it("returns low confidence for fewer than 5 samples", () => {
    for (let i = 0; i < 3; i++) {
      const node = makeNode({
        id: `task-s-${i}`,
        title: `S Task ${i}`,
        status: "done",
        xpSize: "S",
        estimateMinutes: 60,
        metadata: { estimateDelta: 0.5 } as Record<string, unknown>,
      });
      store.insertNode(node);
    }

    const report = computeSizeCalibration(store);
    expect(report.S).toBeDefined();
    expect(report.S!.confidence).toBe("low"); // <5 = low
  });

  it("returns high confidence for more than 10 samples", () => {
    for (let i = 0; i < 12; i++) {
      const node = makeNode({
        id: `task-xl-${i}`,
        title: `XL Task ${i}`,
        status: "done",
        xpSize: "XL",
        estimateMinutes: 480,
        metadata: { estimateDelta: 2.0 } as Record<string, unknown>,
      });
      store.insertNode(node);
    }

    const report = computeSizeCalibration(store);
    expect(report.XL).toBeDefined();
    expect(report.XL!.confidence).toBe("high"); // >10 = high
  });

  it("excludes done tasks without estimateDelta in metadata", () => {
    // Task with no estimateDelta
    const node = makeNode({
      id: "task-no-delta",
      title: "No delta task",
      status: "done",
      xpSize: "S",
      estimateMinutes: 60,
    });
    store.insertNode(node);

    const report = computeSizeCalibration(store);
    // Should not include tasks without estimateDelta
    expect(report.S).toBeUndefined();
  });

  it("computes correct bias_pct for M tasks with known delta", () => {
    // M tasks: 2h estimate, consistently 1h over → bias 50%
    for (let i = 0; i < 5; i++) {
      const node = makeNode({
        id: `task-bias-${i}`,
        title: `Bias Task ${i}`,
        status: "done",
        xpSize: "M",
        estimateMinutes: 120, // 2h
        metadata: { estimateDelta: 1.0 } as Record<string, unknown>, // 1h over
      });
      store.insertNode(node);
    }

    const report = computeSizeCalibration(store);
    expect(report.M).toBeDefined();
    // avg_delta = 1.0h, estimate = 2h → bias_pct = 1.0/2.0 * 100 = 50%
    expect(report.M!.avg_delta).toBeCloseTo(1.0, 5);
    expect(report.M!.bias_pct).toBeCloseTo(50, 1);
  });

  // AC4 dependency: calibration warning threshold
  it("returns bias_pct above 30 when tasks run significantly over", () => {
    for (let i = 0; i < 5; i++) {
      const node = makeNode({
        id: `task-warn-${i}`,
        title: `Warning Task ${i}`,
        status: "done",
        xpSize: "L",
        estimateMinutes: 240, // 4h
        metadata: { estimateDelta: 2.0 } as Record<string, unknown>, // 2h over = 50%
      });
      store.insertNode(node);
    }

    const report = computeSizeCalibration(store);
    expect(report.L).toBeDefined();
    expect(report.L!.bias_pct).toBeGreaterThan(30);
  });
});

describe("SizeCalibrationReport type", () => {
  it("covers all XP sizes", () => {
    const sizes: Array<keyof SizeCalibrationReport> = ["XS", "S", "M", "L", "XL"];
    // Verify that the type supports all size keys without TS errors at compile time
    const report: SizeCalibrationReport = {};
    for (const size of sizes) {
      report[size] = { avg_delta: 0, bias_pct: 0, confidence: "low", count: 0, estimateHours: 0 };
    }
    expect(Object.keys(report).length).toBe(5);
  });
});
