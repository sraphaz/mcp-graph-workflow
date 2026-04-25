/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Persistence for harness runs: the prompt, plan, per-step results, and
 * verdict. Screenshots are stored on disk under
 * `<projectRoot>/workflow-graph/browser-harness/screenshots/<runId>/<step>.png`.
 */

import type Database from "better-sqlite3";
import { mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  HarnessRunSchema,
  type HarnessRun,
  type HarnessRunVerdict,
  type PlannedStep,
  type StepResult,
} from "../../schemas/browser-harness.schema.js";
import { generateId } from "../utils/id.js";

interface RunRow {
  id: string;
  session_id: string;
  node_id: string | null;
  prompt: string;
  plan: string;
  results: string;
  verdict: string;
  duration_ms: number;
  created_at: number;
}

export interface CreateRunInput {
  sessionId: string;
  nodeId?: string | null;
  prompt: string;
  plan: PlannedStep[];
  results: StepResult[];
  verdict: HarnessRunVerdict;
  durationMs: number;
}

export class RunsStore {
  constructor(
    private readonly db: Database.Database,
    private readonly projectRoot: string,
  ) {}

  create(input: CreateRunInput): HarnessRun {
    const id = generateId("bhrun");
    const createdAt = Date.now();
    this.db
      .prepare(
        `INSERT INTO bh_runs (id, session_id, node_id, prompt, plan, results, verdict, duration_ms, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.sessionId,
        input.nodeId ?? null,
        input.prompt,
        JSON.stringify(input.plan),
        JSON.stringify(input.results),
        input.verdict,
        input.durationMs,
        createdAt,
      );
    return HarnessRunSchema.parse({
      id,
      sessionId: input.sessionId,
      nodeId: input.nodeId ?? null,
      prompt: input.prompt,
      plan: input.plan,
      results: input.results,
      verdict: input.verdict,
      durationMs: input.durationMs,
      createdAt,
    });
  }

  get(id: string): HarnessRun | null {
    const row = this.db
      .prepare(
        `SELECT id, session_id, node_id, prompt, plan, results, verdict, duration_ms, created_at
         FROM bh_runs WHERE id = ?`,
      )
      .get(id) as RunRow | undefined;
    return row ? this.rowToRun(row) : null;
  }

  updateResults(id: string, results: StepResult[]): void {
    this.db
      .prepare("UPDATE bh_runs SET results = ? WHERE id = ?")
      .run(JSON.stringify(results), id);
  }

  list(limit = 50): HarnessRun[] {
    const rows = this.db
      .prepare(
        `SELECT id, session_id, node_id, prompt, plan, results, verdict, duration_ms, created_at
         FROM bh_runs ORDER BY created_at DESC LIMIT ?`,
      )
      .all(limit) as RunRow[];
    return rows.map((r) => this.rowToRun(r));
  }

  /** Persist a step screenshot to disk. Returns the relative path. */
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
      const m = file.match(/^(\d+)\.png$/);
      if (!m) continue;
      out.set(parseInt(m[1], 10), readFileSync(join(dir, file)));
    }
    return out;
  }

  private screenshotsDirFor(runId: string): string {
    return join(this.projectRoot, "workflow-graph", "browser-harness", "screenshots", runId);
  }

  private relativeScreenshotPath(runId: string, stepIndex: number): string {
    return `workflow-graph/browser-harness/screenshots/${runId}/${stepIndex}.png`;
  }

  private rowToRun(row: RunRow): HarnessRun {
    return HarnessRunSchema.parse({
      id: row.id,
      sessionId: row.session_id,
      nodeId: row.node_id,
      prompt: row.prompt,
      plan: JSON.parse(row.plan),
      results: JSON.parse(row.results),
      verdict: row.verdict,
      durationMs: row.duration_ms,
      createdAt: row.created_at,
    });
  }
}
