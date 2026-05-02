/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Persistence for journey runs: the plan, per-step results (with optional OCR
 * text), verdict, and screenshots on disk. Mirrors the shape of
 * `src/core/browser-harness/runs-store.ts` so both subsystems report the same
 * way. Screenshots live at
 * `<projectRoot>/workflow-graph/journeys/screenshots/<runId>/<stepIndex>.png`.
 */

import type Database from "better-sqlite3";
import { mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  JourneyRunSchema,
  type JourneyRun,
  type JourneyRunVerdict,
  type JourneyPlannedStep,
  type JourneyStepResult,
} from "../../schemas/journey-run.schema.js";
import { generateId } from "../utils/id.js";

interface JourneyRunRow {
  id: string;
  map_id: string;
  variant_id: string | null;
  node_id: string | null;
  prompt: string | null;
  plan: string;
  results: string;
  verdict: string;
  duration_ms: number;
  created_at: number;
  finished_at: number | null;
}

export interface CreateJourneyRunInput {
  mapId: string;
  variantId: string | null;
  nodeId: string | null;
  prompt: string | null;
  plan: JourneyPlannedStep[];
  results: JourneyStepResult[];
  verdict: JourneyRunVerdict;
  durationMs: number;
}

export interface FinaliseJourneyRunInput {
  results: JourneyStepResult[];
  verdict: JourneyRunVerdict;
  durationMs: number;
}

export interface ListJourneyRunsFilter {
  mapId?: string;
  limit?: number;
}

export class JourneyRunsStore {
  constructor(
    private readonly db: Database.Database,
    private readonly projectRoot: string,
  ) {}

  create(input: CreateJourneyRunInput): JourneyRun {
    const id = generateId("jrun");
    const createdAt = Date.now();
    this.db
      .prepare(
        `INSERT INTO journey_runs (id, map_id, variant_id, node_id, prompt, plan, results, verdict, duration_ms, created_at, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      )
      .run(
        id,
        input.mapId,
        input.variantId ?? null,
        input.nodeId ?? null,
        input.prompt ?? null,
        JSON.stringify(input.plan),
        JSON.stringify(input.results),
        input.verdict,
        input.durationMs,
        createdAt,
      );
    return JourneyRunSchema.parse({
      id,
      mapId: input.mapId,
      variantId: input.variantId ?? null,
      nodeId: input.nodeId ?? null,
      prompt: input.prompt ?? null,
      plan: input.plan,
      results: input.results,
      verdict: input.verdict,
      durationMs: input.durationMs,
      createdAt,
      finishedAt: null,
    });
  }

  get(id: string): JourneyRun | null {
    const row = this.db
      .prepare(
        `SELECT id, map_id, variant_id, node_id, prompt, plan, results, verdict, duration_ms, created_at, finished_at
         FROM journey_runs WHERE id = ?`,
      )
      .get(id) as JourneyRunRow | undefined;
    return row ? this.rowToRun(row) : null;
  }

  list(filter: ListJourneyRunsFilter = {}): JourneyRun[] {
    const limit = filter.limit ?? 50;
    if (filter.mapId) {
      const rows = this.db
        .prepare(
          `SELECT id, map_id, variant_id, node_id, prompt, plan, results, verdict, duration_ms, created_at, finished_at
           FROM journey_runs WHERE map_id = ? ORDER BY created_at DESC LIMIT ?`,
        )
        .all(filter.mapId, limit) as JourneyRunRow[];
      return rows.map((r) => this.rowToRun(r));
    }
    const rows = this.db
      .prepare(
        `SELECT id, map_id, variant_id, node_id, prompt, plan, results, verdict, duration_ms, created_at, finished_at
         FROM journey_runs ORDER BY created_at DESC LIMIT ?`,
      )
      .all(limit) as JourneyRunRow[];
    return rows.map((r) => this.rowToRun(r));
  }

  finalise(id: string, input: FinaliseJourneyRunInput): void {
    this.db
      .prepare(
        `UPDATE journey_runs
         SET results = ?, verdict = ?, duration_ms = ?, finished_at = ?
         WHERE id = ?`,
      )
      .run(JSON.stringify(input.results), input.verdict, input.durationMs, Date.now(), id);
  }

  updateResults(id: string, results: JourneyStepResult[]): void {
    this.db
      .prepare("UPDATE journey_runs SET results = ? WHERE id = ?")
      .run(JSON.stringify(results), id);
  }

  /** Persist a step screenshot. Returns the relative path from project root. */
  saveScreenshot(runId: string, stepIndex: number, pngBytes: Buffer): string {
    const dir = this.screenshotsDirFor(runId);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${stepIndex}.png`);
    writeFileSync(file, pngBytes);
    return this.relativeScreenshotPath(runId, stepIndex);
  }

  loadScreenshot(runId: string, stepIndex: number): Buffer | null {
    const file = join(this.screenshotsDirFor(runId), `${stepIndex}.png`);
    return existsSync(file) ? readFileSync(file) : null;
  }

  loadAllScreenshots(runId: string): Map<number, Buffer> {
    const out = new Map<number, Buffer>();
    const dir = this.screenshotsDirFor(runId);
    if (!existsSync(dir)) return out;
    for (const file of readdirSync(dir)) {
      const mVar = file.match(/^(\d+)\.png$/);
      if (!mVar) continue;
      out.set(parseInt(mVar[1], 10), readFileSync(join(dir, file)));
    }
    return out;
  }

  private screenshotsDirFor(runId: string): string {
    return join(this.projectRoot, "workflow-graph", "journeys", "screenshots", runId);
  }

  private relativeScreenshotPath(runId: string, stepIndex: number): string {
    return `workflow-graph/journeys/screenshots/${runId}/${stepIndex}.png`;
  }

  private rowToRun(row: JourneyRunRow): JourneyRun {
    return JourneyRunSchema.parse({
      id: row.id,
      mapId: row.map_id,
      variantId: row.variant_id,
      nodeId: row.node_id,
      prompt: row.prompt,
      plan: JSON.parse(row.plan),
      results: JSON.parse(row.results),
      verdict: row.verdict,
      durationMs: row.duration_ms,
      createdAt: row.created_at,
      finishedAt: row.finished_at,
    });
  }
}
