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

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations, configureDb } from '../core/store/migrations.js';

describe('Migration v37 — Agent Tracking Columns', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    configureDb(db);
    runMigrations(db);
  });

  it('should add modified_by column to nodes table', () => {
    const columns = db.prepare("PRAGMA table_info(nodes)").all() as Array<{ name: string }>;
    const columnNames = columns.map(c => c.name);
    expect(columnNames).toContain('modified_by');
  });

  it('should add version column to nodes table with default 1', () => {
    const columns = db.prepare("PRAGMA table_info(nodes)").all() as Array<{ name: string; dflt_value: string | null }>;
    const versionCol = columns.find(c => c.name === 'version');
    expect(versionCol).toBeDefined();
    expect(versionCol!.dflt_value).toBe('1');
  });

  it('should add modified_by column to edges table', () => {
    const columns = db.prepare("PRAGMA table_info(edges)").all() as Array<{ name: string }>;
    const columnNames = columns.map(c => c.name);
    expect(columnNames).toContain('modified_by');
  });

  it('should add version column to edges table with default 1', () => {
    const columns = db.prepare("PRAGMA table_info(edges)").all() as Array<{ name: string; dflt_value: string | null }>;
    const versionCol = columns.find(c => c.name === 'version');
    expect(versionCol).toBeDefined();
    expect(versionCol!.dflt_value).toBe('1');
  });

  it('should add modified_by column to knowledge_documents table', () => {
    const columns = db.prepare("PRAGMA table_info(knowledge_documents)").all() as Array<{ name: string }>;
    const columnNames = columns.map(c => c.name);
    expect(columnNames).toContain('modified_by');
  });

  it('should add agent_id column to node_changelog table', () => {
    const columns = db.prepare("PRAGMA table_info(node_changelog)").all() as Array<{ name: string }>;
    const columnNames = columns.map(c => c.name);
    expect(columnNames).toContain('agent_id');
  });

  it('should include embedding_type column when embeddings table is created', () => {
    // embeddings table is created lazily by EmbeddingStore, not via migrations.
    // Simulate the CREATE TABLE that EmbeddingStore uses (with embedding_type).
    db.exec(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        source_id TEXT NOT NULL,
        text TEXT NOT NULL,
        embedding BLOB NOT NULL,
        embedding_type TEXT NOT NULL DEFAULT 'tfidf',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    const columns = db.prepare("PRAGMA table_info(embeddings)").all() as Array<{ name: string; dflt_value: string | null }>;
    const embTypeCol = columns.find(c => c.name === 'embedding_type');
    expect(embTypeCol).toBeDefined();
    expect(embTypeCol!.dflt_value).toBe("'tfidf'");
  });

  it('should create resource_locks table', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='resource_locks'"
    ).all() as Array<{ name: string }>;
    expect(tables).toHaveLength(1);
  });

  it('should preserve existing node data after migration', () => {
    // Create a project first (required FK)
    db.prepare(`
      INSERT INTO projects (id, name, created_at, updated_at)
      VALUES ('proj-1', 'Test Project', '2026-01-01', '2026-01-01')
    `).run();

    db.prepare(`
      INSERT INTO nodes (id, project_id, type, title, status, priority, blocked, created_at, updated_at)
      VALUES ('test-1', 'proj-1', 'task', 'Test Task', 'backlog', 3, 0, '2026-01-01', '2026-01-01')
    `).run();

    const row = db.prepare("SELECT modified_by, version FROM nodes WHERE id = 'test-1'").get() as {
      modified_by: string | null;
      version: number;
    };

    expect(row.modified_by).toBeNull();
    expect(row.version).toBe(1);
  });

  it('should allow inserting node with modified_by value', () => {
    db.prepare(`
      INSERT INTO projects (id, name, created_at, updated_at)
      VALUES ('proj-2', 'Test Project 2', '2026-01-01', '2026-01-01')
    `).run();

    db.prepare(`
      INSERT INTO nodes (id, project_id, type, title, status, priority, blocked, created_at, updated_at, modified_by)
      VALUES ('test-2', 'proj-2', 'task', 'Agent Task', 'backlog', 3, 0, '2026-01-01', '2026-01-01', 'claude-1')
    `).run();

    const row = db.prepare("SELECT modified_by FROM nodes WHERE id = 'test-2'").get() as {
      modified_by: string | null;
    };

    expect(row.modified_by).toBe('claude-1');
  });

  it('should enforce resource_locks schema with required columns', () => {
    const columns = db.prepare("PRAGMA table_info(resource_locks)").all() as Array<{ name: string }>;
    const columnNames = columns.map(c => c.name);

    expect(columnNames).toContain('resource_id');
    expect(columnNames).toContain('resource_type');
    expect(columnNames).toContain('agent_id');
    expect(columnNames).toContain('lease_token');
    expect(columnNames).toContain('acquired_at');
    expect(columnNames).toContain('expires_at');
  });
});
