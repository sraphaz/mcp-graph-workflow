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

import type Database from "better-sqlite3";
import { generateId } from "../utils/id.js";
import { logger } from "../utils/logger.js";
import { McpGraphError } from "../utils/errors.js";
import type { DaVinciJobStatus } from "./davinci-types.js";

// ── Row Interface ─────────────────────────────────────────────────────

interface DaVinciJobRow {
  id: string;
  source_code: string;
  analysis: string | null;
  generated_java: string | null;
  generated_pom: string | null;
  plugin_type: string;
  plugin_name: string;
  package_name: string;
  class_name: string;
  target_sdk: string;
  status: string;
  jar_path: string | null;
  build_output: string | null;
  confidence: number | null;
  warnings: string | null;
  created_at: string;
  updated_at: string;
}

// ── Public Interface ──────────────────────────────────────────────────

export interface DaVinciJob {
  id: string;
  sourceCode: string;
  analysis?: string;
  generatedJava?: string;
  generatedPom?: string;
  pluginType: string;
  pluginName: string;
  packageName: string;
  className: string;
  targetSdk: string;
  status: DaVinciJobStatus;
  jarPath?: string;
  buildOutput?: string;
  confidence?: number;
  warnings?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateJobInput {
  sourceCode: string;
  pluginType: string;
  pluginName: string;
  packageName: string;
  className: string;
  targetSdk: string;
}

// ── Conversion ────────────────────────────────────────────────────────

function rowToJob(row: DaVinciJobRow): DaVinciJob {
  return {
    id: row.id,
    sourceCode: row.source_code,
    ...(row.analysis != null && { analysis: row.analysis }),
    ...(row.generated_java != null && { generatedJava: row.generated_java }),
    ...(row.generated_pom != null && { generatedPom: row.generated_pom }),
    pluginType: row.plugin_type,
    pluginName: row.plugin_name,
    packageName: row.package_name,
    className: row.class_name,
    targetSdk: row.target_sdk,
    status: row.status as DaVinciJobStatus,
    ...(row.jar_path != null && { jarPath: row.jar_path }),
    ...(row.build_output != null && { buildOutput: row.build_output }),
    ...(row.confidence != null && { confidence: row.confidence }),
    ...(row.warnings != null && { warnings: JSON.parse(row.warnings) as string[] }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Store Class ───────────────────────────────────────────────────────

export class DaVinciStore {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.ensureTable();
  }

  private ensureTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS davinci_jobs (
        id TEXT PRIMARY KEY,
        source_code TEXT NOT NULL,
        analysis TEXT,
        generated_java TEXT,
        generated_pom TEXT,
        plugin_type TEXT NOT NULL,
        plugin_name TEXT NOT NULL,
        package_name TEXT NOT NULL,
        class_name TEXT NOT NULL,
        target_sdk TEXT NOT NULL DEFAULT 'pingfederate',
        status TEXT NOT NULL DEFAULT 'analyzing',
        jar_path TEXT,
        build_output TEXT,
        confidence REAL,
        warnings TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  createJob(input: CreateJobInput): DaVinciJob {
    const id = generateId("dvjob");
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO davinci_jobs (id, source_code, plugin_type, plugin_name, package_name, class_name, target_sdk, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'analyzing', ?, ?)
    `).run(id, input.sourceCode, input.pluginType, input.pluginName, input.packageName, input.className, input.targetSdk, now, now);

    logger.info("davinci-store: job created", { id, pluginName: input.pluginName });
    const job = this.getJob(id);
    if (!job) throw new McpGraphError(`Failed to retrieve created job ${id}`);
    return job;
  }

  getJob(id: string): DaVinciJob | undefined {
    const row = this.db.prepare("SELECT * FROM davinci_jobs WHERE id = ?").get(id) as DaVinciJobRow | undefined;
    return row ? rowToJob(row) : undefined;
  }

  listJobs(): DaVinciJob[] {
    const rows = this.db.prepare("SELECT * FROM davinci_jobs ORDER BY created_at DESC").all() as DaVinciJobRow[];
    return rows.map(rowToJob);
  }

  updateJob(id: string, updates: Partial<{
    analysis: string;
    generatedJava: string;
    generatedPom: string;
    status: DaVinciJobStatus;
    jarPath: string;
    buildOutput: string;
    confidence: number;
    warnings: string[];
  }>): DaVinciJob | undefined {
    const now = new Date().toISOString();
    const sets: string[] = ["updated_at = ?"];
    const values: unknown[] = [now];

    if (updates.analysis !== undefined) { sets.push("analysis = ?"); values.push(updates.analysis); }
    if (updates.generatedJava !== undefined) { sets.push("generated_java = ?"); values.push(updates.generatedJava); }
    if (updates.generatedPom !== undefined) { sets.push("generated_pom = ?"); values.push(updates.generatedPom); }
    if (updates.status !== undefined) { sets.push("status = ?"); values.push(updates.status); }
    if (updates.jarPath !== undefined) { sets.push("jar_path = ?"); values.push(updates.jarPath); }
    if (updates.buildOutput !== undefined) { sets.push("build_output = ?"); values.push(updates.buildOutput); }
    if (updates.confidence !== undefined) { sets.push("confidence = ?"); values.push(updates.confidence); }
    if (updates.warnings !== undefined) { sets.push("warnings = ?"); values.push(JSON.stringify(updates.warnings)); }

    values.push(id);
    this.db.prepare(`UPDATE davinci_jobs SET ${sets.join(", ")} WHERE id = ?`).run(...values);

    return this.getJob(id);
  }

  deleteJob(id: string): boolean {
    const result = this.db.prepare("DELETE FROM davinci_jobs WHERE id = ?").run(id);
    return result.changes > 0;
  }
}
