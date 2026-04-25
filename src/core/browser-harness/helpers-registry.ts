/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Persistent registry of harness helpers — built-in + agent-added — backed
 * by SQLite. Versioning is monotonic per helper name; lookups always return
 * the latest version.
 */

import type Database from "better-sqlite3";
import {
  HelperRecordSchema,
  type HelperOrigin,
  type HelperRecord,
  type HelperSignature,
} from "../../schemas/browser-harness.schema.js";
import { HelperNotFoundError } from "../utils/errors.js";

interface HelperRow {
  name: string;
  version: number;
  source: string;
  signature: string;
  origin: string;
  created_at: number;
  created_by: string | null;
}

export interface UpsertHelperInput {
  name: string;
  source: string;
  signature: HelperSignature;
  origin: HelperOrigin;
  createdBy?: string | null;
}

export class HelpersRegistry {
  constructor(private readonly db: Database.Database) {}

  /** Insert a new version of a helper. Returns the resulting record. */
  upsert(input: UpsertHelperInput): HelperRecord {
    const nextVersion = this.nextVersion(input.name);
    const createdAt = Date.now();
    this.db
      .prepare(
        `INSERT INTO bh_helpers (name, version, source, signature, origin, created_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.name,
        nextVersion,
        input.source,
        JSON.stringify(input.signature),
        input.origin,
        createdAt,
        input.createdBy ?? null,
      );

    return HelperRecordSchema.parse({
      name: input.name,
      version: nextVersion,
      source: input.source,
      signature: input.signature,
      origin: input.origin,
      createdAt,
      createdBy: input.createdBy ?? null,
    });
  }

  /** Fetch the latest version of a helper, or throw HelperNotFoundError. */
  get(name: string): HelperRecord {
    const row = this.db
      .prepare(
        `SELECT name, version, source, signature, origin, created_at, created_by
         FROM bh_helpers WHERE name = ? ORDER BY version DESC LIMIT 1`,
      )
      .get(name) as HelperRow | undefined;

    if (!row) throw new HelperNotFoundError(name);
    return this.rowToRecord(row);
  }

  /** Returns the latest version of a helper, or null if missing. */
  find(name: string): HelperRecord | null {
    const row = this.db
      .prepare(
        `SELECT name, version, source, signature, origin, created_at, created_by
         FROM bh_helpers WHERE name = ? ORDER BY version DESC LIMIT 1`,
      )
      .get(name) as HelperRow | undefined;
    return row ? this.rowToRecord(row) : null;
  }

  /** List the latest version of every helper, optionally filtered by origin. */
  list(origin?: HelperOrigin): HelperRecord[] {
    const sql = `
      SELECT h.name, h.version, h.source, h.signature, h.origin, h.created_at, h.created_by
      FROM bh_helpers h
      INNER JOIN (
        SELECT name, MAX(version) AS max_version FROM bh_helpers GROUP BY name
      ) latest ON h.name = latest.name AND h.version = latest.max_version
      ${origin ? "WHERE h.origin = ?" : ""}
      ORDER BY h.name ASC
    `;
    const rows = (origin
      ? this.db.prepare(sql).all(origin)
      : this.db.prepare(sql).all()) as HelperRow[];
    return rows.map((r) => this.rowToRecord(r));
  }

  private nextVersion(name: string): number {
    const row = this.db
      .prepare("SELECT COALESCE(MAX(version), 0) AS v FROM bh_helpers WHERE name = ?")
      .get(name) as { v: number };
    return row.v + 1;
  }

  private rowToRecord(row: HelperRow): HelperRecord {
    return HelperRecordSchema.parse({
      name: row.name,
      version: row.version,
      source: row.source,
      signature: JSON.parse(row.signature),
      origin: row.origin,
      createdAt: row.created_at,
      createdBy: row.created_by,
    });
  }
}
