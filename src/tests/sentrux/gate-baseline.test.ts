/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-sentrux-adoption — Task 0.2: Snapshot de gate baseline
 *
 * AC1: GIVEN scan baseline existe WHEN rodo `sentrux gate --save .`
 *      THEN baseline persistido em `.sentrux/baseline`
 * AC2: GIVEN baseline salvo WHEN rodo `sentrux gate .` sem alterações
 *      THEN status = pass
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { runSentruxGate, saveGateBaseline, type GateBaseline } from "../../core/integrations/sentrux-gate.js";

const BASELINE_PATH = path.resolve(".sentrux/baseline.json");

// ── AC1: baseline file exists ──────────────────────────────────────────────

describe("sentrux gate — AC1: baseline file persisted", () => {
  it("should exist at .sentrux/baseline.json", () => {
    expect(fs.existsSync(BASELINE_PATH)).toBe(true);
  });

  it("should be valid JSON with a quality_signal field", () => {
    const content = fs.readFileSync(BASELINE_PATH, "utf8");
    const parsed = JSON.parse(content) as GateBaseline;
    expect(typeof parsed.quality_signal).toBe("number");
  });

  it("should have a numeric timestamp", () => {
    const parsed = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")) as GateBaseline;
    expect(typeof parsed.timestamp).toBe("number");
    expect(parsed.timestamp).toBeGreaterThan(0);
  });
});

// ── saveGateBaseline — round-trip ──────────────────────────────────────────

describe("saveGateBaseline — writes valid baseline object", () => {
  it("serializes all required fields", () => {
    const baseline: GateBaseline = {
      timestamp: 1_700_000_000,
      quality_signal: 0.5,
      coupling_score: 0.1,
      cycle_count: 2,
      god_file_count: 5,
      hotspot_count: 3,
      complex_fn_count: 20,
      max_depth: 10,
      total_import_edges: 100,
      cross_module_edges: 40,
    };
    const json = saveGateBaseline(baseline);
    const parsed = JSON.parse(json) as GateBaseline;
    expect(parsed.quality_signal).toBe(0.5);
    expect(parsed.timestamp).toBe(1_700_000_000);
  });
});

// ── AC2: runSentruxGate returns pass ──────────────────────────────────────

describe("sentrux gate — AC2: gate returns pass when no regression", () => {
  it("returns status=pass when current matches baseline exactly", () => {
    const baseline: GateBaseline = {
      timestamp: 1_700_000_000,
      quality_signal: 0.5,
      coupling_score: 0.1,
      cycle_count: 2,
      god_file_count: 5,
      hotspot_count: 3,
      complex_fn_count: 20,
      max_depth: 10,
      total_import_edges: 100,
      cross_module_edges: 40,
    };
    const result = runSentruxGate(baseline, baseline);
    expect(result.status).toBe("pass");
  });

  it("returns status=pass when current is better than baseline", () => {
    const baseline: GateBaseline = {
      timestamp: 1_700_000_000,
      quality_signal: 0.4,
      coupling_score: 0.2,
      cycle_count: 4,
      god_file_count: 10,
      hotspot_count: 5,
      complex_fn_count: 50,
      max_depth: 15,
      total_import_edges: 200,
      cross_module_edges: 100,
    };
    const current: GateBaseline = {
      ...baseline,
      quality_signal: 0.5,
      god_file_count: 8,
    };
    const result = runSentruxGate(baseline, current);
    expect(result.status).toBe("pass");
  });

  it("returns status=fail when quality_signal drops significantly", () => {
    const baseline: GateBaseline = {
      timestamp: 1_700_000_000,
      quality_signal: 0.5,
      coupling_score: 0.1,
      cycle_count: 2,
      god_file_count: 5,
      hotspot_count: 3,
      complex_fn_count: 20,
      max_depth: 10,
      total_import_edges: 100,
      cross_module_edges: 40,
    };
    const current: GateBaseline = {
      ...baseline,
      quality_signal: 0.2,
    };
    const result = runSentruxGate(baseline, current);
    expect(result.status).toBe("fail");
  });

  it("returns status=fail when god_file_count increases substantially", () => {
    const baseline: GateBaseline = {
      timestamp: 1_700_000_000,
      quality_signal: 0.5,
      coupling_score: 0.1,
      cycle_count: 2,
      god_file_count: 5,
      hotspot_count: 3,
      complex_fn_count: 20,
      max_depth: 10,
      total_import_edges: 100,
      cross_module_edges: 40,
    };
    const current: GateBaseline = { ...baseline, god_file_count: 20 };
    const result = runSentruxGate(baseline, current);
    expect(result.status).toBe("fail");
  });

  it("pass result includes a delta object", () => {
    const baseline: GateBaseline = {
      timestamp: 1_700_000_000,
      quality_signal: 0.5,
      coupling_score: 0.1,
      cycle_count: 2,
      god_file_count: 5,
      hotspot_count: 3,
      complex_fn_count: 20,
      max_depth: 10,
      total_import_edges: 100,
      cross_module_edges: 40,
    };
    const result = runSentruxGate(baseline, baseline);
    expect(result).toHaveProperty("delta");
  });
});
