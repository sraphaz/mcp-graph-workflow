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

/**
 * B29 (P1): runMigrations on a DB where _migrations was dropped but data
 *   tables still exist used to crash with raw SqliteError 'duplicate
 *   column'. Now: detect orphaned-schema state and throw a friendly error
 *   directing to re-init or restore. Source: notebook node_ffe8d0eb034c.
 *
 * B30 (P3): _migrations row with version > maxKnown used to be silently
 *   accepted. Now: logger.warn surfaces 'newer DB' / 'downgrade' so users
 *   running an older binary against a newer DB get a signal.
 *   Source: notebook node_0490b58b326c.
 */

import { describe, it, expect, vi } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../../core/store/migrations.js";
import { logger } from "../../core/utils/logger.js";

describe("B29 — orphaned schema (no _migrations) refuses with friendly error", () => {
  it("throws when data tables exist but _migrations is missing", () => {
    const db = new Database(":memory:");
    runMigrations(db); // initial migration creates _migrations + nodes
    db.exec("DROP TABLE _migrations");

    expect(() => runMigrations(db)).toThrow(/orphaned schema|tracking table/i);
    db.close();
  });

  it("does NOT throw on a fresh in-memory DB (no regression)", () => {
    const db = new Database(":memory:");
    expect(() => runMigrations(db)).not.toThrow();
    db.close();
  });
});

describe("B30 — DB with future migration version logs a warn", () => {
  it("logger.warn fires when applied max > known max", () => {
    const db = new Database(":memory:");
    runMigrations(db);
    db.prepare(
      "INSERT INTO _migrations (version, description, applied_at) VALUES (?, ?, ?)",
    ).run(99999, "future", new Date().toISOString());

    const warnSpy = vi.spyOn(logger, "warn");
    runMigrations(db);

    const calls = warnSpy.mock.calls.map((c) => JSON.stringify(c));
    expect(calls.join("\n")).toMatch(/newer-db|newer than|downgrade/i);
    warnSpy.mockRestore();
    db.close();
  });

  it("logger.warn does NOT fire on a normal DB", () => {
    const db = new Database(":memory:");
    runMigrations(db);

    const warnSpy = vi.spyOn(logger, "warn");
    runMigrations(db); // no new migrations to apply

    const calls = warnSpy.mock.calls.map((c) => JSON.stringify(c));
    expect(calls.join("\n")).not.toMatch(/newer-db|downgrade/i);
    warnSpy.mockRestore();
    db.close();
  });
});
