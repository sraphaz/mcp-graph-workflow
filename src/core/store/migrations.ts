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
import { createLogger } from "../utils/logger.js";
import { GraphIntegrityError } from "../utils/errors.js";

const log = createLogger({ layer: "core", source: "migrations.ts" });

interface Migration {
  version: number;
  description: string;
  sql: string;
}

const migrations: Migration[] = [
  {
    version: 1,
    description: "Initial schema — projects, nodes, edges, snapshots, import_history",
    sql: `
      CREATE TABLE IF NOT EXISTS projects (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS nodes (
        id                  TEXT PRIMARY KEY,
        project_id          TEXT NOT NULL REFERENCES projects(id),
        type                TEXT NOT NULL,
        title               TEXT NOT NULL,
        description         TEXT,
        status              TEXT NOT NULL DEFAULT 'backlog',
        priority            INTEGER NOT NULL DEFAULT 3,
        xp_size             TEXT,
        estimate_minutes    INTEGER,
        tags                TEXT, -- JSON array
        parent_id           TEXT,
        sprint              TEXT,
        source_file         TEXT,
        source_start_line   INTEGER,
        source_end_line     INTEGER,
        source_confidence   REAL,
        acceptance_criteria TEXT, -- JSON array
        blocked             INTEGER NOT NULL DEFAULT 0,
        metadata            TEXT, -- JSON object
        created_at          TEXT NOT NULL,
        updated_at          TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS edges (
        id            TEXT PRIMARY KEY,
        project_id    TEXT NOT NULL REFERENCES projects(id),
        from_node     TEXT NOT NULL REFERENCES nodes(id),
        to_node       TEXT NOT NULL REFERENCES nodes(id),
        relation_type TEXT NOT NULL,
        weight        REAL,
        reason        TEXT,
        metadata      TEXT, -- JSON object
        created_at    TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS snapshots (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id  TEXT NOT NULL REFERENCES projects(id),
        data        TEXT NOT NULL, -- JSON dump of GraphDocument
        created_at  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS import_history (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id     TEXT NOT NULL REFERENCES projects(id),
        source_file    TEXT NOT NULL,
        nodes_created  INTEGER NOT NULL DEFAULT 0,
        edges_created  INTEGER NOT NULL DEFAULT 0,
        imported_at    TEXT NOT NULL
      );

      -- Indexes for common query patterns
      CREATE INDEX IF NOT EXISTS idx_nodes_project     ON nodes(project_id);
      CREATE INDEX IF NOT EXISTS idx_nodes_type        ON nodes(project_id, type);
      CREATE INDEX IF NOT EXISTS idx_nodes_status      ON nodes(project_id, status);
      CREATE INDEX IF NOT EXISTS idx_nodes_parent      ON nodes(parent_id);
      CREATE INDEX IF NOT EXISTS idx_edges_project     ON edges(project_id);
      CREATE INDEX IF NOT EXISTS idx_edges_from        ON edges(from_node);
      CREATE INDEX IF NOT EXISTS idx_edges_to          ON edges(to_node);
      CREATE INDEX IF NOT EXISTS idx_snapshots_project ON snapshots(project_id);
      CREATE INDEX IF NOT EXISTS idx_imports_project   ON import_history(project_id);
    `,
  },
  {
    version: 2,
    description: "FTS5 full-text search index on nodes",
    sql: `
      CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
        title, description, tags,
        content='nodes', content_rowid='rowid'
      );

      -- Populate FTS from existing nodes
      INSERT INTO nodes_fts(rowid, title, description, tags)
        SELECT rowid, title, COALESCE(description, ''), COALESCE(tags, '')
        FROM nodes;

      -- Sync triggers: keep FTS in sync with nodes table
      CREATE TRIGGER IF NOT EXISTS nodes_fts_insert AFTER INSERT ON nodes BEGIN
        INSERT INTO nodes_fts(rowid, title, description, tags)
          VALUES (NEW.rowid, NEW.title, COALESCE(NEW.description, ''), COALESCE(NEW.tags, ''));
      END;

      CREATE TRIGGER IF NOT EXISTS nodes_fts_delete AFTER DELETE ON nodes BEGIN
        INSERT INTO nodes_fts(nodes_fts, rowid, title, description, tags)
          VALUES ('delete', OLD.rowid, OLD.title, COALESCE(OLD.description, ''), COALESCE(OLD.tags, ''));
      END;

      CREATE TRIGGER IF NOT EXISTS nodes_fts_update AFTER UPDATE ON nodes BEGIN
        INSERT INTO nodes_fts(nodes_fts, rowid, title, description, tags)
          VALUES ('delete', OLD.rowid, OLD.title, COALESCE(OLD.description, ''), COALESCE(OLD.tags, ''));
        INSERT INTO nodes_fts(rowid, title, description, tags)
          VALUES (NEW.rowid, NEW.title, COALESCE(NEW.description, ''), COALESCE(NEW.tags, ''));
      END;
    `,
  },
  {
    version: 3,
    description: "Docs cache table with FTS5 index for Context7 documentation",
    sql: `
      CREATE TABLE IF NOT EXISTS docs_cache (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        lib_id       TEXT NOT NULL,
        lib_name     TEXT NOT NULL,
        version      TEXT,
        content      TEXT NOT NULL,
        fetched_at   TEXT NOT NULL,
        UNIQUE(lib_id)
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5(
        lib_name, content,
        content='docs_cache', content_rowid='id'
      );

      -- Sync triggers: keep FTS in sync with docs_cache table
      CREATE TRIGGER IF NOT EXISTS docs_fts_insert AFTER INSERT ON docs_cache BEGIN
        INSERT INTO docs_fts(rowid, lib_name, content)
          VALUES (NEW.id, NEW.lib_name, NEW.content);
      END;

      CREATE TRIGGER IF NOT EXISTS docs_fts_delete AFTER DELETE ON docs_cache BEGIN
        INSERT INTO docs_fts(docs_fts, rowid, lib_name, content)
          VALUES ('delete', OLD.id, OLD.lib_name, OLD.content);
      END;

      CREATE TRIGGER IF NOT EXISTS docs_fts_update AFTER UPDATE ON docs_cache BEGIN
        INSERT INTO docs_fts(docs_fts, rowid, lib_name, content)
          VALUES ('delete', OLD.id, OLD.lib_name, OLD.content);
        INSERT INTO docs_fts(rowid, lib_name, content)
          VALUES (NEW.id, NEW.lib_name, NEW.content);
      END;
    `,
  },
  {
    version: 4,
    description: "Knowledge documents table with FTS5 index for unified knowledge store",
    sql: `
      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id            TEXT PRIMARY KEY,
        source_type   TEXT NOT NULL,
        source_id     TEXT NOT NULL,
        title         TEXT NOT NULL,
        content       TEXT NOT NULL,
        content_hash  TEXT NOT NULL,
        chunk_index   INTEGER NOT NULL DEFAULT 0,
        metadata      TEXT, -- JSON object
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_knowledge_source_type ON knowledge_documents(source_type);
      CREATE INDEX IF NOT EXISTS idx_knowledge_source_id ON knowledge_documents(source_id);
      CREATE INDEX IF NOT EXISTS idx_knowledge_content_hash ON knowledge_documents(content_hash);

      CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
        title, content,
        content='knowledge_documents', content_rowid='rowid'
      );

      -- Sync triggers: keep FTS in sync with knowledge_documents table
      CREATE TRIGGER IF NOT EXISTS knowledge_fts_insert AFTER INSERT ON knowledge_documents BEGIN
        INSERT INTO knowledge_fts(rowid, title, content)
          VALUES (NEW.rowid, NEW.title, NEW.content);
      END;

      CREATE TRIGGER IF NOT EXISTS knowledge_fts_delete AFTER DELETE ON knowledge_documents BEGIN
        INSERT INTO knowledge_fts(knowledge_fts, rowid, title, content)
          VALUES ('delete', OLD.rowid, OLD.title, OLD.content);
      END;

      CREATE TRIGGER IF NOT EXISTS knowledge_fts_update AFTER UPDATE ON knowledge_documents BEGIN
        INSERT INTO knowledge_fts(knowledge_fts, rowid, title, content)
          VALUES ('delete', OLD.rowid, OLD.title, OLD.content);
        INSERT INTO knowledge_fts(rowid, title, content)
          VALUES (NEW.rowid, NEW.title, NEW.content);
      END;
    `,
  },
  {
    version: 5,
    description: "Project settings key-value store for lifecycle overrides",
    sql: `
      CREATE TABLE IF NOT EXISTS project_settings (
        project_id  TEXT NOT NULL REFERENCES projects(id),
        key         TEXT NOT NULL,
        value       TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        PRIMARY KEY (project_id, key)
      );
    `,
  },
  {
    version: 6,
    description: "Code Intelligence — symbols, relations, FTS5 index, index metadata",
    sql: `
      CREATE TABLE IF NOT EXISTS code_symbols (
        id          TEXT PRIMARY KEY,
        project_id  TEXT NOT NULL,
        name        TEXT NOT NULL,
        kind        TEXT NOT NULL,
        file        TEXT NOT NULL,
        start_line  INTEGER NOT NULL,
        end_line    INTEGER NOT NULL,
        exported    INTEGER NOT NULL DEFAULT 0,
        module_path TEXT,
        signature   TEXT,
        metadata    TEXT,
        indexed_at  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS code_relations (
        id          TEXT PRIMARY KEY,
        project_id  TEXT NOT NULL,
        from_symbol TEXT NOT NULL REFERENCES code_symbols(id),
        to_symbol   TEXT NOT NULL REFERENCES code_symbols(id),
        type        TEXT NOT NULL,
        file        TEXT,
        line        INTEGER,
        metadata    TEXT,
        indexed_at  TEXT NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS code_symbols_fts USING fts5(
        name, file, signature,
        content='code_symbols', content_rowid='rowid'
      );

      -- FTS5 sync triggers
      CREATE TRIGGER IF NOT EXISTS code_fts_insert AFTER INSERT ON code_symbols BEGIN
        INSERT INTO code_symbols_fts(rowid, name, file, signature)
          VALUES (NEW.rowid, NEW.name, NEW.file, COALESCE(NEW.signature, ''));
      END;

      CREATE TRIGGER IF NOT EXISTS code_fts_delete AFTER DELETE ON code_symbols BEGIN
        INSERT INTO code_symbols_fts(code_symbols_fts, rowid, name, file, signature)
          VALUES ('delete', OLD.rowid, OLD.name, OLD.file, COALESCE(OLD.signature, ''));
      END;

      CREATE TRIGGER IF NOT EXISTS code_fts_update AFTER UPDATE ON code_symbols BEGIN
        INSERT INTO code_symbols_fts(code_symbols_fts, rowid, name, file, signature)
          VALUES ('delete', OLD.rowid, OLD.name, OLD.file, COALESCE(OLD.signature, ''));
        INSERT INTO code_symbols_fts(rowid, name, file, signature)
          VALUES (NEW.rowid, NEW.name, NEW.file, COALESCE(NEW.signature, ''));
      END;

      CREATE TABLE IF NOT EXISTS code_index_meta (
        project_id    TEXT PRIMARY KEY,
        last_indexed  TEXT NOT NULL,
        file_count    INTEGER DEFAULT 0,
        symbol_count  INTEGER DEFAULT 0,
        relation_count INTEGER DEFAULT 0,
        git_hash      TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_code_sym_project ON code_symbols(project_id);
      CREATE INDEX IF NOT EXISTS idx_code_sym_name ON code_symbols(name);
      CREATE INDEX IF NOT EXISTS idx_code_sym_file ON code_symbols(file);
      CREATE INDEX IF NOT EXISTS idx_code_rel_from ON code_relations(from_symbol);
      CREATE INDEX IF NOT EXISTS idx_code_rel_to ON code_relations(to_symbol);
      CREATE INDEX IF NOT EXISTS idx_code_rel_type ON code_relations(type);
    `,
  },
  {
    version: 7,
    description: "Tool token usage tracking for benchmark analytics",
    sql: `
      CREATE TABLE IF NOT EXISTS tool_token_usage (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id    TEXT NOT NULL REFERENCES projects(id),
        tool_name     TEXT NOT NULL,
        input_tokens  INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        called_at     TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ttu_project ON tool_token_usage(project_id);
      CREATE INDEX IF NOT EXISTS idx_ttu_tool    ON tool_token_usage(tool_name);
      CREATE INDEX IF NOT EXISTS idx_ttu_called  ON tool_token_usage(called_at);
    `,
  },
  {
    version: 8,
    description: "Global mode — fs_path on projects, project_id on knowledge_documents",
    sql: `
      ALTER TABLE projects ADD COLUMN fs_path TEXT;
      CREATE INDEX IF NOT EXISTS idx_projects_fs_path ON projects(fs_path);

      ALTER TABLE knowledge_documents ADD COLUMN project_id TEXT;
      CREATE INDEX IF NOT EXISTS idx_knowledge_project ON knowledge_documents(project_id);
    `,
  },
  {
    version: 9,
    description: "Skill preferences and custom skills tables",
    sql: `
      CREATE TABLE IF NOT EXISTS skill_preferences (
        project_id  TEXT NOT NULL,
        skill_name  TEXT NOT NULL,
        enabled     INTEGER NOT NULL DEFAULT 1,
        updated_at  TEXT NOT NULL,
        PRIMARY KEY (project_id, skill_name)
      );

      CREATE TABLE IF NOT EXISTS custom_skills (
        id          TEXT PRIMARY KEY,
        project_id  TEXT NOT NULL,
        name        TEXT NOT NULL,
        description TEXT NOT NULL,
        category    TEXT NOT NULL DEFAULT 'know-me',
        phases      TEXT NOT NULL,
        instructions TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        UNIQUE(project_id, name)
      );

      CREATE INDEX IF NOT EXISTS idx_custom_skills_project ON custom_skills(project_id);
    `,
  },
  {
    version: 10,
    description: "Edge deduplication — remove duplicates, add UNIQUE constraint",
    sql: `
      DELETE FROM edges WHERE rowid NOT IN (
        SELECT MIN(rowid) FROM edges GROUP BY project_id, from_node, to_node, relation_type
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_edges_unique
        ON edges(project_id, from_node, to_node, relation_type);
    `,
  },
  {
    version: 11,
    description: "Journey maps + Knowledge quality scoring, usage tracking, and cross-source relations",
    sql: `
      CREATE TABLE IF NOT EXISTS journey_maps (
        id          TEXT PRIMARY KEY,
        project_id  TEXT NOT NULL REFERENCES projects(id),
        name        TEXT NOT NULL,
        url         TEXT,
        description TEXT,
        metadata    TEXT, -- JSON object
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS journey_screens (
        id          TEXT PRIMARY KEY,
        map_id      TEXT NOT NULL REFERENCES journey_maps(id) ON DELETE CASCADE,
        project_id  TEXT NOT NULL REFERENCES projects(id),
        title       TEXT NOT NULL,
        description TEXT,
        screenshot  TEXT, -- filename relative to journey-screenshots/
        url         TEXT,
        screen_type TEXT NOT NULL DEFAULT 'page',
        fields      TEXT, -- JSON array
        ctas        TEXT, -- JSON array
        metadata    TEXT, -- JSON object
        position_x  REAL DEFAULT 0,
        position_y  REAL DEFAULT 0,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS journey_edges (
        id          TEXT PRIMARY KEY,
        map_id      TEXT NOT NULL REFERENCES journey_maps(id) ON DELETE CASCADE,
        project_id  TEXT NOT NULL REFERENCES projects(id),
        from_screen TEXT NOT NULL REFERENCES journey_screens(id) ON DELETE CASCADE,
        to_screen   TEXT NOT NULL REFERENCES journey_screens(id) ON DELETE CASCADE,
        label       TEXT,
        edge_type   TEXT NOT NULL DEFAULT 'navigation',
        metadata    TEXT, -- JSON object
        created_at  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS journey_variants (
        id          TEXT PRIMARY KEY,
        map_id      TEXT NOT NULL REFERENCES journey_maps(id) ON DELETE CASCADE,
        project_id  TEXT NOT NULL REFERENCES projects(id),
        name        TEXT NOT NULL,
        description TEXT,
        path        TEXT NOT NULL, -- JSON array of screen IDs
        created_at  TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_journey_maps_project ON journey_maps(project_id);
      CREATE INDEX IF NOT EXISTS idx_journey_screens_map ON journey_screens(map_id);
      CREATE INDEX IF NOT EXISTS idx_journey_edges_map ON journey_edges(map_id);
      CREATE INDEX IF NOT EXISTS idx_journey_edges_from ON journey_edges(from_screen);
      CREATE INDEX IF NOT EXISTS idx_journey_edges_to ON journey_edges(to_screen);
      CREATE INDEX IF NOT EXISTS idx_journey_variants_map ON journey_variants(map_id);

      ALTER TABLE knowledge_documents ADD COLUMN quality_score REAL DEFAULT 0.5;
      ALTER TABLE knowledge_documents ADD COLUMN usage_count INTEGER DEFAULT 0;
      ALTER TABLE knowledge_documents ADD COLUMN last_accessed_at TEXT;
      ALTER TABLE knowledge_documents ADD COLUMN staleness_days INTEGER DEFAULT 0;

      CREATE INDEX IF NOT EXISTS idx_knowledge_quality ON knowledge_documents(quality_score);
      CREATE INDEX IF NOT EXISTS idx_knowledge_usage ON knowledge_documents(usage_count);

      CREATE TABLE IF NOT EXISTS knowledge_relations (
        id          TEXT PRIMARY KEY,
        from_doc_id TEXT NOT NULL,
        to_doc_id   TEXT NOT NULL,
        relation    TEXT NOT NULL,
        score       REAL DEFAULT 1.0,
        created_at  TEXT NOT NULL,
        UNIQUE(from_doc_id, to_doc_id, relation)
      );

      CREATE INDEX IF NOT EXISTS idx_krel_from ON knowledge_relations(from_doc_id);
      CREATE INDEX IF NOT EXISTS idx_krel_to ON knowledge_relations(to_doc_id);

      CREATE TABLE IF NOT EXISTS knowledge_usage_log (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_id      TEXT NOT NULL,
        query       TEXT NOT NULL,
        action      TEXT NOT NULL,
        context     TEXT,
        created_at  TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_kusage_doc ON knowledge_usage_log(doc_id);
      CREATE INDEX IF NOT EXISTS idx_kusage_action ON knowledge_usage_log(action);
    `,
  },
  {
    version: 12,
    description: "Knowledge Graph — entities, relations, mentions with FTS5 index",
    sql: `
      CREATE TABLE IF NOT EXISTS kg_entities (
        id              TEXT PRIMARY KEY,
        name            TEXT NOT NULL,
        type            TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        aliases         TEXT DEFAULT '[]',
        description     TEXT,
        metadata        TEXT DEFAULT '{}',
        mention_count   INTEGER DEFAULT 0,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_kg_entities_type ON kg_entities(type);
      CREATE INDEX IF NOT EXISTS idx_kg_entities_normalized ON kg_entities(normalized_name);

      CREATE VIRTUAL TABLE IF NOT EXISTS kg_entities_fts USING fts5(
        name, aliases, description
      );

      CREATE TABLE IF NOT EXISTS kg_relations (
        id              TEXT PRIMARY KEY,
        from_entity_id  TEXT NOT NULL REFERENCES kg_entities(id),
        to_entity_id    TEXT NOT NULL REFERENCES kg_entities(id),
        relation_type   TEXT NOT NULL,
        weight          REAL DEFAULT 1.0,
        source_doc_id   TEXT,
        created_at      TEXT NOT NULL,
        UNIQUE(from_entity_id, to_entity_id, relation_type)
      );

      CREATE INDEX IF NOT EXISTS idx_kg_relations_from ON kg_relations(from_entity_id);
      CREATE INDEX IF NOT EXISTS idx_kg_relations_to ON kg_relations(to_entity_id);

      CREATE TABLE IF NOT EXISTS kg_mentions (
        id          TEXT PRIMARY KEY,
        entity_id   TEXT NOT NULL REFERENCES kg_entities(id),
        doc_id      TEXT NOT NULL,
        context     TEXT,
        position    INTEGER DEFAULT 0,
        created_at  TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_kg_mentions_entity ON kg_mentions(entity_id);
      CREATE INDEX IF NOT EXISTS idx_kg_mentions_doc ON kg_mentions(doc_id);
    `,
  },
  {
    version: 13,
    description: "LSP cache — language server result caching with mtime invalidation",
    sql: `
      CREATE TABLE IF NOT EXISTS lsp_cache (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id      TEXT NOT NULL,
        cache_key       TEXT NOT NULL,
        operation       TEXT NOT NULL,
        language_id     TEXT NOT NULL,
        file_path       TEXT NOT NULL,
        result_json     TEXT NOT NULL,
        file_mtime      TEXT NOT NULL,
        created_at      TEXT NOT NULL,
        UNIQUE(project_id, cache_key)
      );

      CREATE INDEX IF NOT EXISTS idx_lsp_cache_file ON lsp_cache(project_id, file_path);
      CREATE INDEX IF NOT EXISTS idx_lsp_cache_lang ON lsp_cache(project_id, language_id);
    `,
  },
  {
    version: 14,
    description: "Recreate code_symbols_fts with signature column (replaces kind)",
    sql: `
      -- Drop old FTS table and triggers (schema mismatch: had 'kind', needs 'signature')
      DROP TRIGGER IF EXISTS code_fts_insert;
      DROP TRIGGER IF EXISTS code_fts_delete;
      DROP TRIGGER IF EXISTS code_fts_update;
      DROP TABLE IF EXISTS code_symbols_fts;

      CREATE VIRTUAL TABLE code_symbols_fts USING fts5(
        name, file, signature,
        content='code_symbols', content_rowid='rowid'
      );

      CREATE TRIGGER code_fts_insert AFTER INSERT ON code_symbols BEGIN
        INSERT INTO code_symbols_fts(rowid, name, file, signature)
          VALUES (NEW.rowid, NEW.name, NEW.file, COALESCE(NEW.signature, ''));
      END;

      CREATE TRIGGER code_fts_delete AFTER DELETE ON code_symbols BEGIN
        INSERT INTO code_symbols_fts(code_symbols_fts, rowid, name, file, signature)
          VALUES ('delete', OLD.rowid, OLD.name, OLD.file, COALESCE(OLD.signature, ''));
      END;

      CREATE TRIGGER code_fts_update AFTER UPDATE ON code_symbols BEGIN
        INSERT INTO code_symbols_fts(code_symbols_fts, rowid, name, file, signature)
          VALUES ('delete', OLD.rowid, OLD.name, OLD.file, COALESCE(OLD.signature, ''));
        INSERT INTO code_symbols_fts(rowid, name, file, signature)
          VALUES (NEW.rowid, NEW.name, NEW.file, COALESCE(NEW.signature, ''));
      END;
    `,
  },
  {
    version: 15,
    description: "Translation jobs + UCR (Universal Construct Registry) tables",
    sql: `
      CREATE TABLE IF NOT EXISTS translation_jobs (
        id                TEXT PRIMARY KEY,
        project_id        TEXT NOT NULL,
        source_language   TEXT NOT NULL,
        target_language   TEXT NOT NULL,
        source_code       TEXT NOT NULL,
        target_code       TEXT,
        status            TEXT NOT NULL DEFAULT 'pending',
        scope             TEXT NOT NULL DEFAULT 'snippet',
        constraints       TEXT,
        analysis          TEXT,
        result            TEXT,
        evidence          TEXT,
        confidence_score  REAL,
        warnings          TEXT,
        error_message     TEXT,
        created_at        TEXT NOT NULL,
        updated_at        TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tj_project ON translation_jobs(project_id);
      CREATE INDEX IF NOT EXISTS idx_tj_status ON translation_jobs(status);
      CREATE INDEX IF NOT EXISTS idx_tj_lang_pair ON translation_jobs(source_language, target_language);

      CREATE TABLE IF NOT EXISTS ucr_categories (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS ucr_constructs (
        id              TEXT PRIMARY KEY,
        category_id     TEXT NOT NULL,
        canonical_name  TEXT NOT NULL UNIQUE,
        description     TEXT,
        semantic_group  TEXT,
        metadata        TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_ucr_constructs_category ON ucr_constructs(category_id);
      CREATE INDEX IF NOT EXISTS idx_ucr_constructs_group ON ucr_constructs(semantic_group);

      CREATE TABLE IF NOT EXISTS ucr_language_mappings (
        id              TEXT PRIMARY KEY,
        construct_id    TEXT NOT NULL,
        language_id     TEXT NOT NULL,
        syntax_pattern  TEXT NOT NULL,
        ast_node_type   TEXT,
        confidence      REAL NOT NULL DEFAULT 1.0,
        is_primary      INTEGER NOT NULL DEFAULT 1,
        constraints     TEXT,
        UNIQUE(construct_id, language_id, syntax_pattern)
      );
      CREATE INDEX IF NOT EXISTS idx_ucr_mapping_construct ON ucr_language_mappings(construct_id);
      CREATE INDEX IF NOT EXISTS idx_ucr_mapping_language ON ucr_language_mappings(language_id);

      CREATE TABLE IF NOT EXISTS ucr_equivalence_classes (
        id                TEXT PRIMARY KEY,
        name              TEXT NOT NULL,
        description       TEXT,
        equivalence_type  TEXT NOT NULL DEFAULT 'exact'
      );

      CREATE TABLE IF NOT EXISTS ucr_translation_log (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        source_lang     TEXT NOT NULL,
        target_lang     TEXT NOT NULL,
        construct_id    TEXT NOT NULL,
        mapping_id      TEXT NOT NULL,
        success         INTEGER NOT NULL DEFAULT 1,
        feedback        TEXT,
        created_at      TEXT NOT NULL
      );
    `,
  },
  {
    version: 16,
    description: "Tool call log for prerequisite enforcement",
    sql: `
      CREATE TABLE IF NOT EXISTS tool_call_log (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        node_id    TEXT,
        tool_name  TEXT NOT NULL,
        tool_args  TEXT,
        called_at  TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tool_call_log_lookup
        ON tool_call_log (project_id, node_id, tool_name);
    `,
  },
  {
    version: 17,
    description: "Cleanup duplicate project_settings rows (defensive fix for NEW-1)",
    sql: `
      DELETE FROM project_settings
      WHERE rowid NOT IN (
        SELECT MAX(rowid) FROM project_settings GROUP BY project_id, key
      );
    `,
  },
  {
    version: 18,
    description: "Add pre-computed recency_score column to knowledge_documents",
    sql: `
      ALTER TABLE knowledge_documents ADD COLUMN recency_score REAL DEFAULT 1.0;
      CREATE INDEX IF NOT EXISTS idx_knowledge_recency ON knowledge_documents(recency_score);
    `,
  },
  {
    version: 19,
    description: "Add missing performance indexes for knowledge_documents, tool_call_log, code_symbols",
    sql: `
      CREATE INDEX IF NOT EXISTS idx_knowledge_project_id ON knowledge_documents(project_id);
      CREATE INDEX IF NOT EXISTS idx_knowledge_source_type ON knowledge_documents(source_type);
      CREATE INDEX IF NOT EXISTS idx_tool_call_node ON tool_call_log(project_id, node_id);
      CREATE INDEX IF NOT EXISTS idx_code_symbols_file ON code_symbols(file);
    `,
  },
  {
    version: 20,
    description: "Translation projects + project files tables for full project conversion",
    sql: `
      CREATE TABLE IF NOT EXISTS translation_projects (
        id                  TEXT PRIMARY KEY,
        project_id          TEXT NOT NULL,
        name                TEXT NOT NULL,
        source_language     TEXT,
        target_language     TEXT NOT NULL,
        status              TEXT NOT NULL DEFAULT 'uploading',
        total_files         INTEGER NOT NULL DEFAULT 0,
        processed_files     INTEGER NOT NULL DEFAULT 0,
        overall_confidence  REAL,
        deterministic_pct   REAL,
        created_at          TEXT NOT NULL,
        updated_at          TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tp_project ON translation_projects(project_id);
      CREATE INDEX IF NOT EXISTS idx_tp_status ON translation_projects(status);

      CREATE TABLE IF NOT EXISTS translation_project_files (
        id                      TEXT PRIMARY KEY,
        translation_project_id  TEXT NOT NULL REFERENCES translation_projects(id) ON DELETE CASCADE,
        file_path               TEXT NOT NULL,
        source_code             TEXT NOT NULL,
        source_language         TEXT,
        status                  TEXT NOT NULL DEFAULT 'pending',
        job_id                  TEXT REFERENCES translation_jobs(id) ON DELETE SET NULL,
        deterministic           INTEGER,
        analysis                TEXT,
        confidence_score        REAL,
        error_message           TEXT,
        created_at              TEXT NOT NULL,
        updated_at              TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tpf_project ON translation_project_files(translation_project_id);
      CREATE INDEX IF NOT EXISTS idx_tpf_job ON translation_project_files(job_id);
      CREATE INDEX IF NOT EXISTS idx_tpf_status ON translation_project_files(status);
    `,
  },
  {
    version: 21,
    description: "Syntax Enrichment — language, docstring, source_snippet, visibility columns + FTS5 rebuild with docstring",
    sql: `
      ALTER TABLE code_symbols ADD COLUMN language TEXT DEFAULT 'typescript';
      ALTER TABLE code_symbols ADD COLUMN docstring TEXT;
      ALTER TABLE code_symbols ADD COLUMN source_snippet TEXT;
      ALTER TABLE code_symbols ADD COLUMN visibility TEXT DEFAULT 'public';

      CREATE INDEX IF NOT EXISTS idx_code_sym_language ON code_symbols(language);

      -- Rebuild FTS5 to include docstring as searchable field
      DROP TRIGGER IF EXISTS code_fts_insert;
      DROP TRIGGER IF EXISTS code_fts_delete;
      DROP TRIGGER IF EXISTS code_fts_update;
      DROP TABLE IF EXISTS code_symbols_fts;

      CREATE VIRTUAL TABLE code_symbols_fts USING fts5(
        name, file, signature, docstring,
        content='code_symbols', content_rowid='rowid'
      );

      CREATE TRIGGER code_fts_insert AFTER INSERT ON code_symbols BEGIN
        INSERT INTO code_symbols_fts(rowid, name, file, signature, docstring)
          VALUES (NEW.rowid, NEW.name, NEW.file, COALESCE(NEW.signature, ''), COALESCE(NEW.docstring, ''));
      END;

      CREATE TRIGGER code_fts_delete AFTER DELETE ON code_symbols BEGIN
        INSERT INTO code_symbols_fts(code_symbols_fts, rowid, name, file, signature, docstring)
          VALUES ('delete', OLD.rowid, OLD.name, OLD.file, COALESCE(OLD.signature, ''), COALESCE(OLD.docstring, ''));
      END;

      CREATE TRIGGER code_fts_update AFTER UPDATE ON code_symbols BEGIN
        INSERT INTO code_symbols_fts(code_symbols_fts, rowid, name, file, signature, docstring)
          VALUES ('delete', OLD.rowid, OLD.name, OLD.file, COALESCE(OLD.signature, ''), COALESCE(OLD.docstring, ''));
        INSERT INTO code_symbols_fts(rowid, name, file, signature, docstring)
          VALUES (NEW.rowid, NEW.name, NEW.file, COALESCE(NEW.signature, ''), COALESCE(NEW.docstring, ''));
      END;

      -- Repopulate FTS5 from existing data (critical for DBs that already had symbols)
      INSERT INTO code_symbols_fts(code_symbols_fts) VALUES('rebuild');
    `,
  },
  {
    version: 22,
    description: "DreamMode — dream_cycles and dream_archive tables for REM-inspired knowledge consolidation",
    sql: `
      CREATE TABLE IF NOT EXISTS dream_cycles (
        id              TEXT PRIMARY KEY,
        status          TEXT NOT NULL,
        config          TEXT NOT NULL,
        result          TEXT,
        started_at      TEXT NOT NULL,
        completed_at    TEXT,
        error_message   TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_dream_cycles_status ON dream_cycles(status);
      CREATE INDEX IF NOT EXISTS idx_dream_cycles_started ON dream_cycles(started_at);

      CREATE TABLE IF NOT EXISTS dream_archive (
        id              TEXT PRIMARY KEY,
        original_doc_id TEXT NOT NULL,
        title           TEXT NOT NULL,
        source_type     TEXT NOT NULL,
        quality_score   REAL,
        reason          TEXT NOT NULL,
        archived_at     TEXT NOT NULL,
        cycle_id        TEXT REFERENCES dream_cycles(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_dream_archive_cycle ON dream_archive(cycle_id);
      CREATE INDEX IF NOT EXISTS idx_dream_archive_reason ON dream_archive(reason);
    `,
  },
  {
    version: 23,
    description: "Node changelog for audit trail",
    sql: `
      CREATE TABLE IF NOT EXISTS node_changelog (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        field TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        changed_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_changelog_node ON node_changelog(node_id);
      CREATE INDEX IF NOT EXISTS idx_changelog_project ON node_changelog(project_id);
    `,
  },
  {
    version: 24,
    description: "Add test_files column to nodes for linking test files to ACs",
    sql: `
      ALTER TABLE nodes ADD COLUMN test_files TEXT; -- JSON array of test file paths
    `,
  },
  {
    version: 25,
    description: "Task templates for reusable task patterns",
    sql: `
      CREATE TABLE IF NOT EXISTS task_templates (
        id          TEXT PRIMARY KEY,
        project_id  TEXT NOT NULL REFERENCES projects(id),
        name        TEXT NOT NULL,
        description TEXT NOT NULL,
        subtasks    TEXT NOT NULL, -- JSON array of template subtasks
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        UNIQUE(project_id, name)
      );
      CREATE INDEX IF NOT EXISTS idx_templates_project ON task_templates(project_id);
    `,
  },
  {
    version: 26,
    description: "Flow snapshots for Cumulative Flow Diagrams",
    sql: `
      CREATE TABLE IF NOT EXISTS flow_snapshots (
        id               TEXT PRIMARY KEY,
        project_id       TEXT NOT NULL,
        snapshot_date    TEXT NOT NULL,
        backlog_count    INTEGER DEFAULT 0,
        ready_count      INTEGER DEFAULT 0,
        in_progress_count INTEGER DEFAULT 0,
        blocked_count    INTEGER DEFAULT 0,
        done_count       INTEGER DEFAULT 0,
        sprint           TEXT,
        created_at       TEXT NOT NULL,
        UNIQUE(project_id, snapshot_date, sprint)
      );
      CREATE INDEX IF NOT EXISTS idx_flow_snapshots_project_date ON flow_snapshots(project_id, snapshot_date);
    `,
  },
  {
    version: 27,
    description: "Query cache table for semantic query caching",
    sql: `
      CREATE TABLE IF NOT EXISTS query_cache (
        query_hash    TEXT NOT NULL UNIQUE,
        query_text    TEXT NOT NULL,
        embedding     BLOB,
        result_json   TEXT NOT NULL,
        tokens_saved  INTEGER NOT NULL DEFAULT 0,
        hit_count     INTEGER NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL,
        expires_at    TEXT NOT NULL
      );
    `,
  },
  {
    version: 28,
    description: "Session chunks table for context delta tracking",
    sql: `
      CREATE TABLE IF NOT EXISTS session_chunks (
        session_id    TEXT NOT NULL,
        content_hash  TEXT NOT NULL,
        tokens        INTEGER NOT NULL DEFAULT 0,
        tracked_at    TEXT NOT NULL,
        UNIQUE(session_id, content_hash)
      );
      CREATE INDEX IF NOT EXISTS idx_session_chunks_session_id ON session_chunks(session_id);
    `,
  },
  {
    version: 29,
    description: "Relevance feedback table for implicit RAG quality signals",
    sql: `
      CREATE TABLE IF NOT EXISTS relevance_feedback (
        id           TEXT PRIMARY KEY,
        session_id   TEXT NOT NULL,
        query        TEXT NOT NULL,
        document_id  TEXT NOT NULL,
        signal       TEXT NOT NULL,
        created_at   TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_relevance_feedback_session ON relevance_feedback(session_id);
      CREATE INDEX IF NOT EXISTS idx_relevance_feedback_doc ON relevance_feedback(document_id);
    `,
  },
  {
    version: 30,
    description: "v7.0 schema cleanup: backfill NULLs for required fields + rebuild FTS indexes",
    sql: `
      -- Backfill NULL status, priority, blocked fields (now required in v7)
      UPDATE nodes SET status = 'backlog' WHERE status IS NULL;
      UPDATE nodes SET priority = 3 WHERE priority IS NULL;
      UPDATE nodes SET blocked = 0 WHERE blocked IS NULL OR blocked = '';

      -- Rebuild nodes FTS index with fresh data
      DELETE FROM nodes_fts;
      INSERT INTO nodes_fts(rowid, title, description)
        SELECT rowid, COALESCE(title, ''), COALESCE(description, '') FROM nodes;

      -- Rebuild docs_cache FTS index (lib docs)
      INSERT OR IGNORE INTO docs_fts(rowid, lib_name, content)
        SELECT id, COALESCE(lib_name, ''), COALESCE(content, '') FROM docs_cache
        WHERE id NOT IN (SELECT rowid FROM docs_fts);
    `,
  },
  {
    version: 31,
    description: "v7.0 community summaries: add community_summaries table + FTS5 virtual table for GraphRAG",
    sql: `
      CREATE TABLE IF NOT EXISTS community_summaries (
        id               TEXT PRIMARY KEY,
        community_id     TEXT NOT NULL,
        title            TEXT NOT NULL,
        summary          TEXT NOT NULL,
        member_node_ids  TEXT NOT NULL,
        member_count     INTEGER NOT NULL,
        top_terms        TEXT NOT NULL,
        created_at       TEXT NOT NULL,
        updated_at       TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_community_summaries_community_id
        ON community_summaries(community_id);

      CREATE VIRTUAL TABLE IF NOT EXISTS community_summaries_fts USING fts5(
        community_id UNINDEXED,
        title,
        summary,
        top_terms,
        content=community_summaries,
        content_rowid=rowid
      );

      CREATE TRIGGER IF NOT EXISTS community_summaries_fts_insert
        AFTER INSERT ON community_summaries BEGIN
          INSERT INTO community_summaries_fts(rowid, community_id, title, summary, top_terms)
            VALUES (new.rowid, new.community_id, new.title, new.summary, new.top_terms);
        END;

      CREATE TRIGGER IF NOT EXISTS community_summaries_fts_delete
        AFTER DELETE ON community_summaries BEGIN
          INSERT INTO community_summaries_fts(community_summaries_fts, rowid, community_id, title, summary, top_terms)
            VALUES ('delete', old.rowid, old.community_id, old.title, old.summary, old.top_terms);
        END;

      CREATE TRIGGER IF NOT EXISTS community_summaries_fts_update
        AFTER UPDATE ON community_summaries BEGIN
          INSERT INTO community_summaries_fts(community_summaries_fts, rowid, community_id, title, summary, top_terms)
            VALUES ('delete', old.rowid, old.community_id, old.title, old.summary, old.top_terms);
          INSERT INTO community_summaries_fts(rowid, community_id, title, summary, top_terms)
            VALUES (new.rowid, new.community_id, new.title, new.summary, new.top_terms);
        END;
    `,
  },
  {
    version: 32,
    description: "Plugin system: add plugins table for extension persistence",
    sql: `
      CREATE TABLE IF NOT EXISTS plugins (
        name         TEXT NOT NULL,
        project_id   TEXT NOT NULL,
        version      TEXT NOT NULL,
        path         TEXT NOT NULL,
        enabled      INTEGER NOT NULL DEFAULT 1,
        config       TEXT,
        installed_at TEXT NOT NULL,
        updated_at   TEXT NOT NULL,
        PRIMARY KEY (project_id, name)
      );

      CREATE INDEX IF NOT EXISTS idx_plugins_project
        ON plugins(project_id);
    `,
  },
  {
    version: 33,
    description: "Harness v2: add harness_history table for trend tracking",
    sql: `
      CREATE TABLE IF NOT EXISTS harness_history (
        id          TEXT NOT NULL PRIMARY KEY,
        project_id  TEXT NOT NULL,
        score       REAL NOT NULL,
        grade       TEXT NOT NULL,
        breakdown   TEXT NOT NULL,
        git_commit  TEXT,
        timestamp   TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_harness_history_project_time
        ON harness_history(project_id, timestamp);
    `,
  },
  {
    version: 34,
    description: "Spec evolution: spec_documents, spec_document_versions, spec_node_links",
    sql: `
      CREATE TABLE IF NOT EXISTS spec_documents (
        id             TEXT PRIMARY KEY,
        project_id     TEXT NOT NULL,
        name           TEXT NOT NULL,
        template_name  TEXT,
        file_path      TEXT,
        content_hash   TEXT NOT NULL,
        version        INTEGER NOT NULL DEFAULT 1,
        status         TEXT NOT NULL DEFAULT 'draft',
        metadata       TEXT,
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_spec_docs_project
        ON spec_documents(project_id);

      CREATE TABLE IF NOT EXISTS spec_document_versions (
        id             TEXT PRIMARY KEY,
        spec_id        TEXT NOT NULL REFERENCES spec_documents(id) ON DELETE CASCADE,
        version        INTEGER NOT NULL,
        content        TEXT NOT NULL,
        content_hash   TEXT NOT NULL,
        diff_summary   TEXT,
        created_at     TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_spec_versions_spec
        ON spec_document_versions(spec_id);

      CREATE TABLE IF NOT EXISTS spec_node_links (
        id             TEXT PRIMARY KEY,
        spec_id        TEXT NOT NULL REFERENCES spec_documents(id) ON DELETE CASCADE,
        node_id        TEXT NOT NULL,
        section_title  TEXT,
        link_type      TEXT NOT NULL DEFAULT 'derived_from',
        created_at     TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_spec_links_spec
        ON spec_node_links(spec_id);

      CREATE INDEX IF NOT EXISTS idx_spec_links_node
        ON spec_node_links(node_id);
    `,
  },
  {
    version: 35,
    description: "Harness v3: issue_patterns table (moved from constructor to versioned migration)",
    sql: `
      CREATE TABLE IF NOT EXISTS issue_patterns (
        id TEXT PRIMARY KEY,
        pattern_type TEXT NOT NULL UNIQUE,
        count INTEGER NOT NULL DEFAULT 1,
        first_seen TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        suggested_rule TEXT,
        auto_generated INTEGER NOT NULL DEFAULT 0
      );
    `,
  },
  {
    version: 36,
    description: "Remediation Engine v4: suppressions, validations, meta-rules tables",
    sql: `
      CREATE TABLE IF NOT EXISTS remediation_suppressions (
        id TEXT PRIMARY KEY,
        file TEXT NOT NULL,
        violation_type TEXT NOT NULL,
        dimension TEXT NOT NULL,
        reason TEXT,
        suppressed_at TEXT NOT NULL,
        UNIQUE(file, violation_type)
      );

      CREATE TABLE IF NOT EXISTS remediation_validations (
        id TEXT PRIMARY KEY,
        rule_id TEXT NOT NULL,
        file TEXT NOT NULL,
        applied INTEGER NOT NULL DEFAULT 0,
        score_before REAL,
        score_after REAL,
        confirmed INTEGER NOT NULL DEFAULT 0,
        validated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS remediation_meta_rules (
        id TEXT PRIMARY KEY,
        dimension TEXT NOT NULL,
        violation_type TEXT NOT NULL,
        pattern TEXT NOT NULL,
        fix_template TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 0.8,
        confirmations INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 37,
    description: "Agent tracking: modified_by, version columns + resource_locks table + embedding_type",
    sql: `
      -- Agent identity columns on nodes
      ALTER TABLE nodes ADD COLUMN modified_by TEXT;
      ALTER TABLE nodes ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

      -- Agent identity columns on edges
      ALTER TABLE edges ADD COLUMN modified_by TEXT;
      ALTER TABLE edges ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

      -- Agent identity on knowledge_documents
      ALTER TABLE knowledge_documents ADD COLUMN modified_by TEXT;

      -- Agent tracking in changelog
      ALTER TABLE node_changelog ADD COLUMN agent_id TEXT;

      -- Embedding type for dual-mode (tfidf vs onnx)
      -- Note: embeddings table is created lazily by EmbeddingStore.
      -- The column is added conditionally at EmbeddingStore init time.

      -- Resource locks for multi-agent lease-based locking
      CREATE TABLE IF NOT EXISTS resource_locks (
        resource_id   TEXT PRIMARY KEY,
        resource_type TEXT NOT NULL,
        agent_id      TEXT NOT NULL,
        lease_token   TEXT NOT NULL UNIQUE,
        acquired_at   TEXT NOT NULL,
        expires_at    TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_resource_locks_agent
        ON resource_locks(agent_id);

      CREATE INDEX IF NOT EXISTS idx_resource_locks_expires
        ON resource_locks(expires_at);
    `,
  },
  {
    version: 38,
    description: "Cross-terminal event queue for teamTask mode",
    sql: `
      CREATE TABLE IF NOT EXISTS event_queue (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        payload    TEXT NOT NULL,
        agent_id   TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_event_queue_created
        ON event_queue(created_at);
    `,
  },
  {
    version: 39,
    description: "Composite index (project_id, parent_id) for node queries",
    sql: `
      CREATE INDEX IF NOT EXISTS idx_nodes_project_parent
        ON nodes(project_id, parent_id);
    `,
  },
  {
    version: 40,
    description: "Rename FTS sync triggers to explicit after_* names",
    sql: `
      DROP TRIGGER IF EXISTS nodes_fts_insert;
      DROP TRIGGER IF EXISTS nodes_fts_delete;
      DROP TRIGGER IF EXISTS nodes_fts_update;

      CREATE TRIGGER IF NOT EXISTS nodes_fts_after_insert AFTER INSERT ON nodes BEGIN
        INSERT INTO nodes_fts(rowid, title, description, tags)
          VALUES (NEW.rowid, NEW.title, COALESCE(NEW.description, ''), COALESCE(NEW.tags, ''));
      END;

      CREATE TRIGGER IF NOT EXISTS nodes_fts_after_delete AFTER DELETE ON nodes BEGIN
        INSERT INTO nodes_fts(nodes_fts, rowid, title, description, tags)
          VALUES ('delete', OLD.rowid, OLD.title, COALESCE(OLD.description, ''), COALESCE(OLD.tags, ''));
      END;

      CREATE TRIGGER IF NOT EXISTS nodes_fts_after_update AFTER UPDATE ON nodes BEGIN
        INSERT INTO nodes_fts(nodes_fts, rowid, title, description, tags)
          VALUES ('delete', OLD.rowid, OLD.title, COALESCE(OLD.description, ''), COALESCE(OLD.tags, ''));
        INSERT INTO nodes_fts(rowid, title, description, tags)
          VALUES (NEW.rowid, NEW.title, COALESCE(NEW.description, ''), COALESCE(NEW.tags, ''));
      END;
    `,
  },
  {
    version: 43,
    description: "Deterministic edge deduplication by created_at/id ordering",
    sql: `
      DELETE FROM edges
      WHERE rowid IN (
        SELECT rowid FROM (
          SELECT
            rowid,
            ROW_NUMBER() OVER (
              PARTITION BY project_id, from_node, to_node, relation_type
              ORDER BY COALESCE(created_at, ''), id, rowid
            ) AS rn
          FROM edges
        ) ranked
        WHERE ranked.rn > 1
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_edges_unique
        ON edges(project_id, from_node, to_node, relation_type);
    `,
  },
  {
    version: 44,
    description: "Add ON DELETE CASCADE to edges foreign keys",
    sql: `
      -- SQLite cannot ALTER FK constraints, so recreate the table
      CREATE TABLE IF NOT EXISTS edges_new (
        id            TEXT PRIMARY KEY,
        project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        from_node     TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
        to_node       TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
        relation_type TEXT NOT NULL,
        weight        REAL,
        reason        TEXT,
        metadata      TEXT,
        created_at    TEXT NOT NULL,
        modified_by   TEXT,
        version       INTEGER NOT NULL DEFAULT 1
      );

      INSERT OR IGNORE INTO edges_new SELECT * FROM edges;
      DROP TABLE edges;
      ALTER TABLE edges_new RENAME TO edges;

      -- Recreate indexes
      CREATE INDEX IF NOT EXISTS idx_edges_project ON edges(project_id);
      CREATE INDEX IF NOT EXISTS idx_edges_from    ON edges(from_node);
      CREATE INDEX IF NOT EXISTS idx_edges_to      ON edges(to_node);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_edges_unique
        ON edges(project_id, from_node, to_node, relation_type);
    `,
  },
  {
    version: 45,
    description: "Add UNIQUE constraint on knowledge_documents(content_hash, source_id) to prevent dedup race condition",
    sql: `
      -- Remove any existing duplicates (keep oldest by rowid)
      DELETE FROM knowledge_documents
        WHERE rowid NOT IN (
          SELECT MIN(rowid)
          FROM knowledge_documents
          GROUP BY content_hash, source_id
        );

      -- Add UNIQUE index to enforce dedup at DB level
      CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_content_hash_source_id
        ON knowledge_documents(content_hash, source_id);
    `,
  },
  {
    version: 46,
    description: "Contract violations table for architecture rule enforcement (Design by Contract — Meyer 1986)",
    sql: `
      CREATE TABLE IF NOT EXISTS contract_violations (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_id    TEXT NOT NULL,
        file       TEXT NOT NULL,
        line       INTEGER NOT NULL DEFAULT 0,
        message    TEXT NOT NULL,
        severity   TEXT NOT NULL DEFAULT 'error',
        node_id    TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_contract_violations_node_created
        ON contract_violations(node_id, created_at);
    `,
  },
  {
    version: 47,
    description: "Token budget policy table for adaptive Q-Learning (Sutton & Barto RL)",
    sql: (() => {
      const phases = ["ANALYZE", "DESIGN", "PLAN", "IMPLEMENT", "VALIDATE", "REVIEW", "HANDOFF", "DEPLOY", "LISTENING"];
      const grades = ["A", "B", "C", "D"];
      const presets = ["graph_heavy", "knowledge_heavy", "balanced", "code_heavy", "minimal"];

      let sql = `
        CREATE TABLE IF NOT EXISTS token_budget_policy (
          state_phase    TEXT NOT NULL,
          state_grade    TEXT NOT NULL,
          action_preset  TEXT NOT NULL,
          q_value        REAL NOT NULL DEFAULT 0,
          visits         INTEGER NOT NULL DEFAULT 0,
          updated_at     TEXT NOT NULL,
          PRIMARY KEY (state_phase, state_grade, action_preset)
        );
      `;

      const now = new Date().toISOString();
      const rows: string[] = [];
      for (const phase of phases) {
        for (const grade of grades) {
          for (const preset of presets) {
            rows.push(`('${phase}', '${grade}', '${preset}', 0, 0, '${now}')`);
          }
        }
      }

      sql += `INSERT OR IGNORE INTO token_budget_policy (state_phase, state_grade, action_preset, q_value, visits, updated_at) VALUES ${rows.join(",\n")};`;

      return sql;
    })(),
  },
  {
    version: 48,
    description: "Autopilot sessions table for autonomous sprint execution (Hewitt Actor Model 1973)",
    sql: `
      CREATE TABLE IF NOT EXISTS autopilot_sessions (
        id               TEXT PRIMARY KEY,
        sprint_id        TEXT NOT NULL,
        started_at       TEXT NOT NULL,
        status           TEXT NOT NULL DEFAULT 'running',
        tasks_completed  INTEGER NOT NULL DEFAULT 0,
        tasks_failed     INTEGER NOT NULL DEFAULT 0,
        tokens_used      INTEGER NOT NULL DEFAULT 0,
        config           TEXT NOT NULL DEFAULT '{}',
        decisions        TEXT NOT NULL DEFAULT '[]'
      );

      CREATE INDEX IF NOT EXISTS idx_autopilot_sessions_sprint_status
        ON autopilot_sessions(sprint_id, status);
    `,
  },
  {
    version: 49,
    description: "Add FK constraint to plugins table (E1-T13)",
    sql: `
      CREATE TABLE IF NOT EXISTS plugins_new (
        name         TEXT NOT NULL,
        project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        version      TEXT NOT NULL,
        path         TEXT NOT NULL,
        enabled      INTEGER NOT NULL DEFAULT 1,
        config       TEXT,
        installed_at TEXT NOT NULL,
        updated_at   TEXT NOT NULL,
        PRIMARY KEY (project_id, name)
      );

      INSERT OR IGNORE INTO plugins_new SELECT * FROM plugins;
      DROP TABLE IF EXISTS plugins;
      ALTER TABLE plugins_new RENAME TO plugins;

      CREATE INDEX IF NOT EXISTS idx_plugins_project ON plugins(project_id);
    `,
  },
  {
    version: 50,
    description: "Execution traces and spans for agent observability (Kalman Observability Theorem 1960)",
    sql: `
      CREATE TABLE IF NOT EXISTS execution_traces (
        id                 TEXT PRIMARY KEY,
        thread_id          TEXT NOT NULL,
        node_id            TEXT,
        tool_name          TEXT NOT NULL,
        started_at         TEXT NOT NULL,
        ended_at           TEXT,
        latency_ms         INTEGER,
        status             TEXT NOT NULL DEFAULT 'running',
        tokens_in          INTEGER DEFAULT 0,
        tokens_out         INTEGER DEFAULT 0,
        estimated_cost_usd REAL DEFAULT 0,
        metadata           TEXT DEFAULT '{}'
      );

      CREATE INDEX IF NOT EXISTS idx_traces_thread ON execution_traces(thread_id);
      CREATE INDEX IF NOT EXISTS idx_traces_node ON execution_traces(node_id);
      CREATE INDEX IF NOT EXISTS idx_traces_status ON execution_traces(status);

      CREATE TABLE IF NOT EXISTS execution_spans (
        id              TEXT PRIMARY KEY,
        trace_id        TEXT NOT NULL REFERENCES execution_traces(id),
        parent_span_id  TEXT,
        name            TEXT NOT NULL,
        started_at      TEXT NOT NULL,
        ended_at        TEXT,
        latency_ms      INTEGER,
        input_summary   TEXT,
        output_summary  TEXT,
        metadata        TEXT DEFAULT '{}'
      );

      CREATE INDEX IF NOT EXISTS idx_spans_trace ON execution_spans(trace_id);
    `,
  },
  {
    version: 51,
    description: "Guardrail executions for unified quality gate tracking (Meyer Design by Contract 1986)",
    sql: `
      CREATE TABLE IF NOT EXISTS guardrail_executions (
        id          TEXT PRIMARY KEY,
        trace_id    TEXT REFERENCES execution_traces(id),
        name        TEXT NOT NULL,
        position    TEXT NOT NULL,
        passed      INTEGER NOT NULL,
        score       REAL,
        latency_ms  INTEGER,
        strategy    TEXT NOT NULL DEFAULT 'fail_closed',
        details     TEXT DEFAULT '{}',
        created_at  TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_guardrail_trace ON guardrail_executions(trace_id);
      CREATE INDEX IF NOT EXISTS idx_guardrail_name ON guardrail_executions(name);
    `,
  },
  {
    version: 52,
    description: "Decision log for confidence scorer replay and counterfactual analysis (von Neumann-Morgenstern 1944, Pearl 2000)",
    sql: `
      CREATE TABLE IF NOT EXISTS decision_log (
        id                  TEXT PRIMARY KEY,
        trace_id            TEXT REFERENCES execution_traces(id),
        node_id             TEXT NOT NULL,
        decision            TEXT NOT NULL,
        confidence_score    REAL NOT NULL,
        evidence            TEXT NOT NULL,
        weights_used        TEXT NOT NULL,
        policy_name         TEXT DEFAULT 'default',
        guardrail_pass_rate REAL,
        outcome             TEXT,
        created_at          TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_decision_node ON decision_log(node_id);
      CREATE INDEX IF NOT EXISTS idx_decision_trace ON decision_log(trace_id);
      CREATE INDEX IF NOT EXISTS idx_decision_outcome ON decision_log(outcome);
    `,
  },
  {
    version: 53,
    description: "Experiment tracking — datasets, experiments, results (Fisher Hypothesis Testing 1925)",
    sql: `
      CREATE TABLE IF NOT EXISTS eval_datasets (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        source      TEXT NOT NULL,
        entry_count INTEGER DEFAULT 0,
        created_at  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS eval_dataset_entries (
        id              TEXT PRIMARY KEY,
        dataset_id      TEXT NOT NULL REFERENCES eval_datasets(id),
        input           TEXT NOT NULL,
        expected_output TEXT,
        metadata        TEXT DEFAULT '{}',
        created_at      TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_entries_dataset ON eval_dataset_entries(dataset_id);

      CREATE TABLE IF NOT EXISTS eval_experiments (
        id               TEXT PRIMARY KEY,
        name             TEXT NOT NULL,
        dataset_id       TEXT NOT NULL REFERENCES eval_datasets(id),
        evaluator_config TEXT NOT NULL,
        status           TEXT NOT NULL DEFAULT 'pending',
        summary          TEXT,
        created_at       TEXT NOT NULL,
        completed_at     TEXT
      );

      CREATE TABLE IF NOT EXISTS eval_experiment_results (
        id            TEXT PRIMARY KEY,
        experiment_id TEXT NOT NULL REFERENCES eval_experiments(id),
        entry_id      TEXT NOT NULL REFERENCES eval_dataset_entries(id),
        actual_output TEXT,
        scores        TEXT NOT NULL,
        trace_id      TEXT,
        created_at    TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_results_experiment ON eval_experiment_results(experiment_id);
    `,
  },
  {
    version: 54,
    description: "Quality policies with default seed (Lamport Safety/Liveness Properties 1977)",
    sql: `
      CREATE TABLE IF NOT EXISTS quality_policies (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL UNIQUE,
        gates      TEXT NOT NULL,
        active     INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      INSERT OR IGNORE INTO quality_policies (id, name, gates, active, created_at, updated_at)
      VALUES (
        'policy_default',
        'default',
        '[{"metric":"harness_score","operator":">=","threshold":70,"severity":"block"},{"metric":"security_score","operator":">=","threshold":80,"severity":"block"},{"metric":"test_pass_rate","operator":">=","threshold":80,"severity":"warn"},{"metric":"trend_direction","operator":"!=","threshold":-1,"severity":"warn"}]',
        1,
        datetime('now'),
        datetime('now')
      );
    `,
  },
  {
    version: 55,
    description: "Security events audit log (Hermes-agent integration — input sanitization)",
    sql: `
      CREATE TABLE IF NOT EXISTS security_events (
        id          TEXT PRIMARY KEY,
        event_type  TEXT NOT NULL,
        severity    TEXT NOT NULL DEFAULT 'medium',
        input_hash  TEXT NOT NULL,
        details     TEXT NOT NULL,
        tool_name   TEXT,
        created_at  TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at);
    `,
  },
  {
    version: 56,
    description: "Tool result persistence store (Hermes-agent integration — audit/replay)",
    sql: `
      CREATE TABLE IF NOT EXISTS tool_results (
        id           TEXT PRIMARY KEY,
        project_id   TEXT NOT NULL,
        trace_id     TEXT,
        tool_name    TEXT NOT NULL,
        tool_args    TEXT,
        result       TEXT NOT NULL,
        result_hash  TEXT NOT NULL,
        size_bytes   INTEGER NOT NULL DEFAULT 0,
        truncated    INTEGER NOT NULL DEFAULT 0,
        created_at   TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tool_results_trace ON tool_results(trace_id);
      CREATE INDEX IF NOT EXISTS idx_tool_results_tool ON tool_results(tool_name);
      CREATE INDEX IF NOT EXISTS idx_tool_results_project ON tool_results(project_id);
    `,
  },
  {
    version: 57,
    description: "Session recall store with FTS5 (Hermes-agent integration — cross-session search)",
    sql: `
      CREATE TABLE IF NOT EXISTS session_summaries (
        id                 TEXT PRIMARY KEY,
        session_id         TEXT NOT NULL UNIQUE,
        parent_session_id  TEXT,
        summary            TEXT NOT NULL,
        topics             TEXT NOT NULL DEFAULT '[]',
        node_ids           TEXT DEFAULT '[]',
        tokens_used        INTEGER DEFAULT 0,
        cost_usd           REAL DEFAULT 0,
        created_at         TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_session_summaries_parent ON session_summaries(parent_session_id);
      CREATE INDEX IF NOT EXISTS idx_session_summaries_created ON session_summaries(created_at);
      CREATE VIRTUAL TABLE IF NOT EXISTS session_summaries_fts USING fts5(
        summary, topics, content='session_summaries', content_rowid='rowid'
      );
    `,
  },
  {
    version: 58,
    description: "Sub-agent delegation tracking (Hermes-agent integration — orchestration)",
    sql: `
      CREATE TABLE IF NOT EXISTS delegations (
        id                TEXT PRIMARY KEY,
        parent_agent_id   TEXT NOT NULL,
        child_agent_id    TEXT NOT NULL,
        objective         TEXT NOT NULL,
        allowed_tools     TEXT NOT NULL DEFAULT '[]',
        status            TEXT NOT NULL DEFAULT 'running',
        result_summary    TEXT,
        tokens_used       INTEGER NOT NULL DEFAULT 0,
        depth             INTEGER NOT NULL DEFAULT 1,
        created_at        TEXT NOT NULL,
        completed_at      TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_delegations_parent ON delegations(parent_agent_id);
      CREATE INDEX IF NOT EXISTS idx_delegations_status ON delegations(status);
    `,
  },
  {
    version: 59,
    description: "Skill system enhancement — toolchain, triggers, context template (Hermes-agent integration)",
    sql: `
      ALTER TABLE custom_skills ADD COLUMN toolchain TEXT DEFAULT '[]';
      ALTER TABLE custom_skills ADD COLUMN triggers TEXT DEFAULT '[]';
      ALTER TABLE custom_skills ADD COLUMN context_template TEXT;
    `,
  },
  {
    version: 60,
    description: "Browser-harness — CDP sessions, agent-editable helpers registry, audit log, runs",
    sql: `
      CREATE TABLE IF NOT EXISTS bh_sessions (
        id            TEXT PRIMARY KEY,
        cdp_endpoint  TEXT NOT NULL,
        pid           INTEGER,
        status        TEXT NOT NULL,
        started_at    INTEGER NOT NULL,
        closed_at     INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_bh_sessions_status ON bh_sessions(status);

      CREATE TABLE IF NOT EXISTS bh_helpers (
        name         TEXT NOT NULL,
        version      INTEGER NOT NULL,
        source       TEXT NOT NULL,
        signature    TEXT NOT NULL,
        origin       TEXT NOT NULL,
        created_at   INTEGER NOT NULL,
        created_by   TEXT,
        PRIMARY KEY (name, version)
      );
      CREATE INDEX IF NOT EXISTS idx_bh_helpers_origin ON bh_helpers(origin);

      CREATE TABLE IF NOT EXISTS bh_audit (
        id           TEXT PRIMARY KEY,
        session_id   TEXT NOT NULL,
        action       TEXT NOT NULL,
        payload      TEXT NOT NULL,
        result       TEXT,
        at           INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_bh_audit_session ON bh_audit(session_id);
      CREATE INDEX IF NOT EXISTS idx_bh_audit_action ON bh_audit(action);

      CREATE TABLE IF NOT EXISTS bh_runs (
        id            TEXT PRIMARY KEY,
        session_id    TEXT NOT NULL,
        node_id       TEXT,
        prompt        TEXT NOT NULL,
        plan          TEXT NOT NULL,
        results       TEXT NOT NULL DEFAULT '[]',
        verdict       TEXT NOT NULL,
        duration_ms   INTEGER NOT NULL,
        created_at    INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_bh_runs_session ON bh_runs(session_id);
      CREATE INDEX IF NOT EXISTS idx_bh_runs_verdict ON bh_runs(verdict);
    `,
  },
  {
    version: 61,
    description: "Journey runs — per-variant execution history with step screenshots + OCR",
    sql: `
      CREATE TABLE IF NOT EXISTS journey_runs (
        id            TEXT PRIMARY KEY,
        map_id        TEXT NOT NULL,
        variant_id    TEXT,
        node_id       TEXT,
        prompt        TEXT,
        plan          TEXT NOT NULL,
        results       TEXT NOT NULL DEFAULT '[]',
        verdict       TEXT NOT NULL,
        duration_ms   INTEGER NOT NULL,
        created_at    INTEGER NOT NULL,
        finished_at   INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_journey_runs_map ON journey_runs(map_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_journey_runs_node ON journey_runs(node_id);
      CREATE INDEX IF NOT EXISTS idx_journey_runs_verdict ON journey_runs(verdict);
    `,
  },
  {
    version: 62,
    description: "Lifecycle violation log — records gate bypass attempts with reason, decision node, severity",
    sql: `
      CREATE TABLE IF NOT EXISTS lifecycle_violations (
        id               TEXT PRIMARY KEY,
        gate_id          TEXT NOT NULL,
        node_id          TEXT NOT NULL,
        sprint           TEXT NOT NULL,
        reason           TEXT NOT NULL,
        decision_node_id TEXT,
        severity         TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high')),
        mode             TEXT NOT NULL CHECK(mode IN ('strict', 'advisory')),
        created_at       TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_violations_sprint   ON lifecycle_violations(sprint);
      CREATE INDEX IF NOT EXISTS idx_violations_severity ON lifecycle_violations(severity);
      CREATE INDEX IF NOT EXISTS idx_violations_gate     ON lifecycle_violations(gate_id);
    `,
  },
  {
    version: 63,
    description: "Subtask artifacts store (v11 Context-Pollination) — structured outputs per subtask for sibling-context assembly",
    sql: `
      CREATE TABLE IF NOT EXISTS subtask_artifacts (
        id           TEXT PRIMARY KEY,
        project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        node_id      TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
        epic_id      TEXT NOT NULL,
        kind         TEXT NOT NULL CHECK(kind IN ('diff','file','interface','decision','note')),
        path         TEXT,
        content      TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        created_at   TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_artifacts_epic   ON subtask_artifacts(epic_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_artifacts_node   ON subtask_artifacts(node_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_artifacts_dedup
        ON subtask_artifacts(project_id, epic_id, kind, content_hash);
    `,
  },
  {
    version: 64,
    description: "Tool telemetry columns (v11 Maestro Phase 1) — adds success, duration_ms, error_kind to tool_token_usage for deprecation gate evidence",
    sql: `
      ALTER TABLE tool_token_usage ADD COLUMN success     INTEGER;
      ALTER TABLE tool_token_usage ADD COLUMN duration_ms INTEGER;
      ALTER TABLE tool_token_usage ADD COLUMN error_kind  TEXT;
      CREATE INDEX IF NOT EXISTS idx_ttu_success  ON tool_token_usage(success);
      CREATE INDEX IF NOT EXISTS idx_ttu_err_kind ON tool_token_usage(error_kind);
    `,
  },
  {
    version: 65,
    description: "Feature-depth file-level baselines — per-file score history for finish_task regression gate, plan_sprint risk index, and quadrant-crossing memory entries",
    sql: `
      CREATE TABLE IF NOT EXISTS feature_depth_baselines (
        project_id  TEXT NOT NULL,
        rel_path    TEXT NOT NULL,
        module      TEXT NOT NULL,
        score       REAL NOT NULL,
        quadrant    TEXT NOT NULL,
        test_loc    INTEGER NOT NULL,
        source_loc  INTEGER NOT NULL,
        stored_at   TEXT NOT NULL,
        git_commit  TEXT,
        PRIMARY KEY (project_id, rel_path)
      );
      CREATE INDEX IF NOT EXISTS idx_fd_module ON feature_depth_baselines(project_id, module);
    `,
  },
  {
    version: 66,
    description: "knowledge_docs_project index — enables efficient per-project FTS5 post-filter; prevents full-table scan in multi-project daemons",
    sql: `
      CREATE INDEX IF NOT EXISTS knowledge_docs_project ON knowledge_documents(project_id);
    `,
  },
  {
    version: 67,
    description: "embeddings table: add embedding_blob (BLOB) and vector_dim (INT) columns for ONNX dense-vector storage alongside legacy TF-IDF float arrays",
    sql: `
      CREATE TABLE IF NOT EXISTS embeddings (
        id             TEXT PRIMARY KEY,
        source         TEXT NOT NULL,
        source_id      TEXT NOT NULL,
        text           TEXT NOT NULL,
        embedding      BLOB NOT NULL,
        embedding_type TEXT NOT NULL DEFAULT 'tfidf',
        created_at     TEXT NOT NULL DEFAULT (datetime('now')),
        embedding_blob BLOB,
        vector_dim     INTEGER
      );
    `,
  },
  {
    version: 68,
    description: "EPIC 5 Self-Learning: agent_performance (per-agent score + decay) and reasoning_trajectories (ReasoningBank) tables",
    sql: `
      CREATE TABLE IF NOT EXISTS agent_performance (
        id           TEXT PRIMARY KEY,
        project_id   TEXT NOT NULL REFERENCES projects(id),
        agent_name   TEXT NOT NULL,
        task_kind    TEXT NOT NULL,
        harness_score REAL NOT NULL DEFAULT 0,
        samples      INTEGER NOT NULL DEFAULT 0,
        last_used_ts TEXT NOT NULL,
        decay_factor REAL NOT NULL DEFAULT 1.0,
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL,
        UNIQUE (project_id, agent_name, task_kind)
      );
      CREATE INDEX IF NOT EXISTS idx_agent_perf_project ON agent_performance(project_id);
      CREATE INDEX IF NOT EXISTS idx_agent_perf_kind    ON agent_performance(project_id, task_kind);

      CREATE TABLE IF NOT EXISTS reasoning_trajectories (
        id           TEXT PRIMARY KEY,
        project_id   TEXT NOT NULL REFERENCES projects(id),
        node_id      TEXT REFERENCES nodes(id),
        agent_name   TEXT NOT NULL,
        task_kind    TEXT NOT NULL,
        trajectory   TEXT NOT NULL,
        outcome_score REAL NOT NULL DEFAULT 0,
        samples      INTEGER NOT NULL DEFAULT 1,
        last_used_ts TEXT NOT NULL,
        created_at   TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_rt_project ON reasoning_trajectories(project_id);
      CREATE INDEX IF NOT EXISTS idx_rt_kind    ON reasoning_trajectories(project_id, task_kind);
      CREATE INDEX IF NOT EXISTS idx_rt_node    ON reasoning_trajectories(node_id);
    `,
  },
  {
    version: 69,
    description: "Hooks Sprint 3 — hook_handlers (runtime registrations) + hook_handler_stats (per-handler observability counters)",
    sql: `
      CREATE TABLE IF NOT EXISTS hook_handlers (
        id            TEXT PRIMARY KEY,
        channel       TEXT NOT NULL,
        kind          TEXT NOT NULL,           -- 'shell' | 'inline-unsafe' | 'module' (future)
        command       TEXT,                    -- shell command path
        command_args  TEXT,                    -- JSON array
        env           TEXT,                    -- JSON object {KEY:VALUE}
        timeout_ms    INTEGER NOT NULL DEFAULT 5000,
        priority      INTEGER NOT NULL DEFAULT 0,
        enabled       INTEGER NOT NULL DEFAULT 1,
        description   TEXT,
        origin        TEXT NOT NULL DEFAULT 'runtime',  -- 'runtime' | 'config' | 'builtin'
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_hook_handlers_channel  ON hook_handlers(channel);
      CREATE INDEX IF NOT EXISTS idx_hook_handlers_origin   ON hook_handlers(origin);

      CREATE TABLE IF NOT EXISTS hook_handler_stats (
        handler_id    TEXT PRIMARY KEY,
        call_count    INTEGER NOT NULL DEFAULT 0,
        p50_duration  REAL,
        p95_duration  REAL,
        last_error    TEXT,
        circuit_state TEXT NOT NULL DEFAULT 'closed',
        updated_at    TEXT NOT NULL
      );
    `,
  },
  {
    version: 70,
    // §EPIC-16.2 — Creates llm_call_ledger (was referenced by BudgetLedger
    // and v66 schema-tests but never actually created in any prior migration —
    // see broken v66 tests). Adds provider_used + fallback_count for failover
    // observability. Task description named this "v74" but head was v69 at
    // implementation time; using v70 keeps versions monotonic.
    description: "EPIC 16 LLM Failover — create llm_call_ledger with provider_used + fallback_count",
    sql: `
      CREATE TABLE IF NOT EXISTS llm_call_ledger (
        id                     TEXT PRIMARY KEY,
        ts                     INTEGER NOT NULL,
        project_id             TEXT,
        cell_id                TEXT,
        run_id                 TEXT,
        node_id                TEXT,
        caller                 TEXT,
        provider               TEXT NOT NULL,
        model                  TEXT NOT NULL,
        input_tokens           INTEGER NOT NULL DEFAULT 0,
        output_tokens          INTEGER NOT NULL DEFAULT 0,
        cached_input_tokens    INTEGER,
        cache_creation_tokens  INTEGER,
        cost_usd               REAL NOT NULL DEFAULT 0,
        latency_ms             INTEGER,
        status                 TEXT NOT NULL,
        error_kind             TEXT,
        provider_used          TEXT,
        fallback_count         INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_llm_ledger_cell ON llm_call_ledger(cell_id);
      CREATE INDEX IF NOT EXISTS idx_llm_ledger_run  ON llm_call_ledger(run_id);
      CREATE INDEX IF NOT EXISTS idx_llm_ledger_ts   ON llm_call_ledger(ts);
    `,
  },
  {
    version: 71,
    // §EPIC-18.T01 — Evals + Golden Dataset.
    // eval_golden: persisted (input, expected) pairs per tool with scorer kind.
    // eval_run: per-row scoring outcome of running a golden through a model,
    // capturing pass/fail, latency, model_used and cost_usd for empirical
    // model routing (modelHint feedback loop, AC5).
    description: "EPIC 18 Evals — create eval_golden + eval_run tables with indexes",
    sql: `
      CREATE TABLE IF NOT EXISTS eval_golden (
        id           TEXT PRIMARY KEY,
        input        TEXT NOT NULL,
        expected     TEXT NOT NULL,
        scorer_kind  TEXT NOT NULL,
        tool         TEXT NOT NULL,
        project_id   TEXT,
        metadata     TEXT,
        tags         TEXT,
        created_at   TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_eval_golden_tool        ON eval_golden(tool);
      CREATE INDEX IF NOT EXISTS idx_eval_golden_project     ON eval_golden(project_id);
      CREATE INDEX IF NOT EXISTS idx_eval_golden_scorer_kind ON eval_golden(scorer_kind);

      CREATE TABLE IF NOT EXISTS eval_run (
        id          TEXT PRIMARY KEY,
        run_id      TEXT NOT NULL,
        golden_id   TEXT NOT NULL,
        score       REAL NOT NULL,
        passed      INTEGER NOT NULL,
        latency_ms  INTEGER,
        model_used  TEXT,
        cost_usd    REAL NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL,
        FOREIGN KEY (golden_id) REFERENCES eval_golden(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_eval_run_run_id    ON eval_run(run_id);
      CREATE INDEX IF NOT EXISTS idx_eval_run_golden_id ON eval_run(golden_id);
      CREATE INDEX IF NOT EXISTS idx_eval_run_model     ON eval_run(model_used);
    `,
  },
  {
    version: 72,
    // §EPIC-19.T01 — Multi-Agent Topologies.
    // swarm_session: one row per swarm orchestration. swarm_member: one row
    // per agent participating in the session, with role (queen|worker|judge)
    // and status (idle|running|done|failed). The skeleton persists state so
    // a crashed coordinator can be resumed; topology-specific orchestration
    // (hierarchical/ring/majority) layers on top in T02-T04.
    description: "EPIC 19 Swarm — create swarm_sessions + swarm_agents tables",
    sql: `
      CREATE TABLE IF NOT EXISTS swarm_sessions (
        id           TEXT PRIMARY KEY,
        topology     TEXT NOT NULL,
        consensus    TEXT NOT NULL,
        status       TEXT NOT NULL,
        max_agents   INTEGER NOT NULL,
        strategy     TEXT NOT NULL,
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_swarm_sessions_status   ON swarm_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_swarm_sessions_topology ON swarm_sessions(topology);

      CREATE TABLE IF NOT EXISTS swarm_agents (
        id          TEXT PRIMARY KEY,
        session_id  TEXT NOT NULL,
        role        TEXT NOT NULL,
        status      TEXT NOT NULL,
        result      TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT,
        FOREIGN KEY (session_id) REFERENCES swarm_sessions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_swarm_agents_session ON swarm_agents(session_id);
      CREATE INDEX IF NOT EXISTS idx_swarm_agents_role    ON swarm_agents(role);
    `,
  },
  {
    version: 73,
    // §EPIC-20.T02 — A2A Direct Communication mailbox.
    // Ring-buffer-backed mailbox per recipient agent. Status flow:
    //   pending → delivered → acked. The mailbox is COURIER, never authoritative —
    //   real decisions still write to the graph (see §EPIC-20 design notes).
    description: "EPIC 20 A2A — create a2a_mailbox table for agent-to-agent messages",
    sql: `
      CREATE TABLE IF NOT EXISTS a2a_mailbox (
        id            TEXT PRIMARY KEY,
        from_agent    TEXT NOT NULL,
        to_agent      TEXT NOT NULL,
        body          TEXT NOT NULL,
        status        TEXT NOT NULL,
        created_at    TEXT NOT NULL,
        delivered_at  TEXT,
        acked_at      TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_a2a_mailbox_to       ON a2a_mailbox(to_agent);
      CREATE INDEX IF NOT EXISTS idx_a2a_mailbox_status   ON a2a_mailbox(status);
      CREATE INDEX IF NOT EXISTS idx_a2a_mailbox_to_status ON a2a_mailbox(to_agent, status);
    `,
  },
  {
    version: 76,
    // §EPIC-22.A1 — Autonomy 100% retry persistence.
    // retry_queue persiste falhas para que processo crashes não percam state.
    // RetryWorker (E22.A2) varre status='pending' AND next_retry_ms <= now,
    // re-executa com backoff exponencial. EventReactor (E22.A4) enqueue em
    // task:error. Status flow: pending → done | abandoned (após MAX_ATTEMPTS).
    description: "EPIC 22 Autonomy — retry_queue table for persistent retry across crashes",
    sql: `
      CREATE TABLE IF NOT EXISTS retry_queue (
        id            TEXT PRIMARY KEY,
        task_id       TEXT NOT NULL,
        attempt       INTEGER NOT NULL DEFAULT 0,
        next_retry_ms INTEGER NOT NULL,
        last_error    TEXT,
        status        TEXT NOT NULL,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES nodes(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_retry_queue_status     ON retry_queue(status);
      CREATE INDEX IF NOT EXISTS idx_retry_queue_next_retry ON retry_queue(next_retry_ms);
      CREATE INDEX IF NOT EXISTS idx_retry_queue_task       ON retry_queue(task_id);
    `,
  },
  {
    version: 77,
    // §EPIC-22.B1 — error_patterns table for recurring-error tracking.
    // recordError() hashes error.message + classifies via classifyError, then UPSERTs.
    // Adaptive retry policy (B2) reads count to decide escalation vs backoff.
    description: "EPIC 22 Autonomy — error_patterns table for adaptive retry intelligence",
    sql: `
      CREATE TABLE IF NOT EXISTS error_patterns (
        id          TEXT PRIMARY KEY,
        error_hash  TEXT NOT NULL UNIQUE,
        category    TEXT NOT NULL,
        message     TEXT NOT NULL,
        count       INTEGER NOT NULL DEFAULT 1,
        first_seen  TEXT NOT NULL,
        last_seen   TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_error_patterns_hash     ON error_patterns(error_hash);
      CREATE INDEX IF NOT EXISTS idx_error_patterns_category ON error_patterns(category);
      CREATE INDEX IF NOT EXISTS idx_error_patterns_count    ON error_patterns(count DESC);
    `,
  },
  {
    version: 78,
    // §EPIC-22.B2 — lessons_learned table for adaptive retry escalation memory.
    // RetryWorker insere lesson quando pattern.count>2 → abandon imediato.
    // Sprint 4 D5 lerá esta tabela em start_task para injetar no modelHint.
    description: "EPIC 22 Autonomy — lessons_learned table for adaptive escalation memory",
    sql: `
      CREATE TABLE IF NOT EXISTS lessons_learned (
        id                  TEXT PRIMARY KEY,
        pattern_hash        TEXT NOT NULL,
        description         TEXT NOT NULL,
        recommended_action  TEXT NOT NULL,
        applied_count       INTEGER NOT NULL DEFAULT 1,
        confidence          REAL NOT NULL DEFAULT 0.5,
        created_at          TEXT NOT NULL,
        updated_at          TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_lessons_pattern ON lessons_learned(pattern_hash);
      CREATE INDEX IF NOT EXISTS idx_lessons_action  ON lessons_learned(recommended_action);
    `,
  },
  {
    version: 79,
    // §EPIC-22.D3 — lessons_learned source provenance + confidence index.
    // Add 'source' column so D4 lessons-persister sabe se veio de retry-worker
    // (B2), dream-engine wake (D4), ou outras origens.
    description: "EPIC 22 Autonomy — lessons_learned source column + confidence index",
    sql: `
      ALTER TABLE lessons_learned ADD COLUMN source TEXT NOT NULL DEFAULT 'unknown';
      CREATE INDEX IF NOT EXISTS idx_lessons_confidence ON lessons_learned(confidence DESC);
      CREATE INDEX IF NOT EXISTS idx_lessons_source     ON lessons_learned(source);
    `,
  },
  {
    version: 80,
    // §EPIC-9.T02 — decide tool dedicated table.
    // Stores intent + options_json + chosen + reasoning + outcome (success/result/summary).
    // Distinct from decision_log (v52) which is the confidence-scorer replay log;
    // here, the user/agent records actionable decisions for stats + audit.
    description: "EPIC 9 Decision Intelligence — decisions table for record/outcome/stats/audit",
    sql: `
      CREATE TABLE IF NOT EXISTS decisions (
        id              TEXT PRIMARY KEY,
        intent          TEXT NOT NULL,
        options_json    TEXT NOT NULL,
        chosen          TEXT NOT NULL,
        reasoning       TEXT NOT NULL,
        node_id         TEXT,
        success         INTEGER,
        result_summary  TEXT,
        outcome_at      TEXT,
        created_at      TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_decisions_intent  ON decisions(intent);
      CREATE INDEX IF NOT EXISTS idx_decisions_node    ON decisions(node_id);
      CREATE INDEX IF NOT EXISTS idx_decisions_success ON decisions(success);
      CREATE INDEX IF NOT EXISTS idx_decisions_created ON decisions(created_at);
    `,
  },
  {
    version: 81,
    // §EPIC-12.T07 — knowledge_documents project scoping index.
    // Enforces fast WHERE project_id = ? lookups so cross-project FTS queries
    // are filtered before scanning. Caller (knowledge-store) must pass
    // projectId on every query — the lint test in src/tests/ enforces this.
    description: "EPIC 12 Resilience — knowledge_documents project_id index for project-scoped FTS",
    sql: `
      CREATE INDEX IF NOT EXISTS idx_knowledge_documents_project_id
        ON knowledge_documents(project_id);
    `,
  },
  {
    version: 82,
    // §EPIC-6.T01 — Token Economy: response cache + economy metrics.
    // Schema versions v76-v81 already taken; bumped to v82. Tables back the
    // ResponseCache (E6.T04) persistence and the economy reporting query.
    description:
      "EPIC 6 Token Economy — llm_response_cache + economy_metrics tables",
    sql: `
      CREATE TABLE IF NOT EXISTS llm_response_cache (
        key             TEXT PRIMARY KEY,
        value_json      TEXT NOT NULL,
        schema_version  INTEGER NOT NULL,
        created_at_ms   INTEGER NOT NULL,
        ttl_expires_at  INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_llm_response_cache_ttl
        ON llm_response_cache(ttl_expires_at);
      CREATE INDEX IF NOT EXISTS idx_llm_response_cache_schema
        ON llm_response_cache(schema_version);

      CREATE TABLE IF NOT EXISTS economy_metrics (
        id            TEXT PRIMARY KEY,
        ts            INTEGER NOT NULL,
        tier          TEXT NOT NULL,
        tokens_saved  INTEGER NOT NULL DEFAULT 0,
        cost_saved    REAL NOT NULL DEFAULT 0,
        cache_hit     INTEGER NOT NULL DEFAULT 0,
        node_id       TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_economy_metrics_ts   ON economy_metrics(ts);
      CREATE INDEX IF NOT EXISTS idx_economy_metrics_tier ON economy_metrics(tier);
      CREATE INDEX IF NOT EXISTS idx_economy_metrics_node ON economy_metrics(node_id);
    `,
  },
  {
    version: 83,
    // §SprintA-cleanup — Swarm consensus rounds + strategy default.
    // Adds the swarm_consensus_rounds table expected by EPIC-19 consensus
    // protocols (§EPIC-19.T03) and relaxes swarm_sessions.strategy to allow
    // legacy callers/tests that pre-date the strategy column. Existing rows
    // (which already have strategy populated) are unaffected.
    description: "Swarm consensus rounds + strategy default",
    sql: `
      CREATE TABLE IF NOT EXISTS swarm_consensus_rounds (
        id            TEXT PRIMARY KEY,
        session_id    TEXT NOT NULL,
        round_index   INTEGER NOT NULL,
        outcome       TEXT NOT NULL,
        decided_at    TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES swarm_sessions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_swarm_consensus_rounds_session ON swarm_consensus_rounds(session_id);
      CREATE INDEX IF NOT EXISTS idx_swarm_consensus_rounds_round   ON swarm_consensus_rounds(round_index);

      CREATE TABLE IF NOT EXISTS swarm_sessions_v83 (
        id           TEXT PRIMARY KEY,
        topology     TEXT NOT NULL,
        consensus    TEXT NOT NULL,
        status       TEXT NOT NULL,
        max_agents   INTEGER NOT NULL,
        strategy     TEXT NOT NULL DEFAULT 'default',
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL
      );
      INSERT INTO swarm_sessions_v83 (id, topology, consensus, status, max_agents, strategy, created_at, updated_at)
        SELECT id, topology, consensus, status, max_agents, strategy, created_at, updated_at FROM swarm_sessions;
      DROP TABLE swarm_sessions;
      ALTER TABLE swarm_sessions_v83 RENAME TO swarm_sessions;
      CREATE INDEX IF NOT EXISTS idx_swarm_sessions_status   ON swarm_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_swarm_sessions_topology ON swarm_sessions(topology);
    `,
  },
  {
    version: 84,
    // §SprintD — Lifecycle health snapshots.
    // The 9-phase régua (prd-lifecycle-health) computes a passedAll boolean
    // every call; persisting the snapshot lets analyze(success_rate) report
    // the rolling pass-rate over a window. Idempotent per (epic_id, taken_on)
    // day so multiple invocations the same day collapse to one row.
    description: "Lifecycle health snapshots — persist régua results for trend analysis",
    sql: `
      CREATE TABLE IF NOT EXISTS lifecycle_health_snapshots (
        id            TEXT PRIMARY KEY,
        epic_id       TEXT,
        snapshot_json TEXT NOT NULL,
        passed_all    INTEGER NOT NULL,
        taken_at      TEXT NOT NULL,
        taken_on      TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_lifecycle_health_unique
        ON lifecycle_health_snapshots(COALESCE(epic_id, ''), taken_on);
      CREATE INDEX IF NOT EXISTS idx_lifecycle_health_taken_at
        ON lifecycle_health_snapshots(taken_at);
    `,
  },
  {
    version: 85,
    // §extracta — evolution_reason on nodes (Hive auto-merge inspiration).
    // When the orchestrator regenerates a node (failure recovery, cost
    // overrun, user nudge), we want the *why* preserved alongside the new
    // metadata so analyze(evolution_audit) can surface top regenerated
    // nodes + reasons. Nullable so existing rows are unaffected.
    description: "evolution_reason on nodes — audit trail for node regeneration",
    sql: `
      ALTER TABLE nodes ADD COLUMN evolution_reason TEXT;
      ALTER TABLE nodes ADD COLUMN evolution_count INTEGER NOT NULL DEFAULT 0;
      CREATE INDEX IF NOT EXISTS idx_nodes_evolution_count
        ON nodes(evolution_count) WHERE evolution_count > 0;
    `,
  },
  {
    version: 86,
    // §extracta-cost-observability — session_id on llm_call_ledger.
    // Enables aggregating cost across an entire agent session (across
    // many cells and runs) so we can enforce a session-level budget cap
    // and trigger auto-fallback to a cheaper model at the soft-cap.
    description: "session_id on llm_call_ledger — session-scoped cost aggregation",
    sql: `
      ALTER TABLE llm_call_ledger ADD COLUMN session_id TEXT;
      CREATE INDEX IF NOT EXISTS idx_llm_ledger_session
        ON llm_call_ledger(session_id) WHERE session_id IS NOT NULL;
    `,
  },
  {
    version: 87,
    // §harness-savings-ledger (Eduardo, 2026-04-30) — every harness block
    // persists a row with REAL token-savings metrics so the graph can
    // quantify how much hallucination/quality/context-loss cost was
    // avoided. Grounded in Hu et al. 2026 "Memory in the Age of AI Agents"
    // §4 (factual + experiential memory).
    description:
      "harness_savings_ledger — token savings on each harness block (Eduardo spec)",
    sql: `
      CREATE TABLE IF NOT EXISTS harness_savings_ledger (
        id                       TEXT PRIMARY KEY,
        project_id               TEXT NOT NULL,
        block_type               TEXT NOT NULL,
        blocker_module           TEXT NOT NULL,
        node_id                  TEXT,
        session_id               TEXT,
        tokens_consumed          INTEGER NOT NULL DEFAULT 0,
        baseline_continuation    INTEGER NOT NULL DEFAULT 0,
        baseline_n               INTEGER NOT NULL DEFAULT 0,
        savings_tokens           INTEGER NOT NULL DEFAULT 0,
        confidence               REAL NOT NULL DEFAULT 0,
        source                   TEXT NOT NULL,
        evidence_json            TEXT,
        timestamp                TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_harness_savings_project_time
        ON harness_savings_ledger(project_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_harness_savings_block_type
        ON harness_savings_ledger(block_type);
      CREATE INDEX IF NOT EXISTS idx_harness_savings_node
        ON harness_savings_ledger(node_id) WHERE node_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_harness_savings_session
        ON harness_savings_ledger(session_id) WHERE session_id IS NOT NULL;
    `,
  },
  {
    version: 88,
    // §EPIC-unified-observability Task 1.2 — failure signal collector.
    // Persists structured failure signals from 5 collection hooks
    // (tool invocation, lifecycle gate, DoD check, SQLite busy, MCP server).
    description: "failure_signals — structured failure signal collector (obs-90)",
    sql: `
      CREATE TABLE IF NOT EXISTS failure_signals (
        id          INTEGER PRIMARY KEY,
        source      TEXT NOT NULL,
        signalKind  TEXT NOT NULL,
        context     TEXT NOT NULL DEFAULT '{}',
        severity    TEXT NOT NULL DEFAULT 'error',
        timestamp   TEXT NOT NULL,
        rawError    TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_failure_signals_kind
        ON failure_signals(signalKind);
      CREATE INDEX IF NOT EXISTS idx_failure_signals_source
        ON failure_signals(source);
      CREATE INDEX IF NOT EXISTS idx_failure_signals_timestamp
        ON failure_signals(timestamp);
    `,
  },
  {
    version: 89,
    // §EPIC-unified-observability Task 1.1 — event store for structured
    // observability events. Buffered writes via EventWriter (best-effort,
    // not durable across crash before flush).
    description: "events — structured event store for observability (obs-90)",
    sql: `
      CREATE TABLE IF NOT EXISTS events (
        id              TEXT PRIMARY KEY,
        kind            TEXT NOT NULL,
        subjectRef_kind TEXT NOT NULL,
        subjectRef_id   TEXT NOT NULL,
        payload         TEXT,
        timestamp       TEXT NOT NULL,
        projectId       TEXT,
        sessionId       TEXT,
        durationMs      REAL,
        parentEventId   TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_events_timestamp
        ON events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_events_kind
        ON events(kind);
      CREATE INDEX IF NOT EXISTS idx_events_session
        ON events(sessionId) WHERE sessionId IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_events_subject
        ON events(subjectRef_kind, subjectRef_id);
    `,
  },
  {
    version: 90,
    // §EPIC-policy-engine-context-routing Task 2.1 — analyze(mode:"policy_observations").
    // Stores one row per routing decision for divergence tracking.
    description: "policy_observations — routing decision log for divergence analysis",
    sql: `
      CREATE TABLE IF NOT EXISTS policy_observations (
        id               TEXT PRIMARY KEY,
        project_id       TEXT,
        timestamp        TEXT NOT NULL,
        signals_snapshot TEXT NOT NULL DEFAULT '{}',
        decision         TEXT NOT NULL DEFAULT '{}',
        actual_used      TEXT NOT NULL DEFAULT '[]',
        divergence       INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_policy_obs_project_time
        ON policy_observations(project_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_policy_obs_timestamp
        ON policy_observations(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_policy_obs_divergence
        ON policy_observations(divergence) WHERE divergence = 1;
    `,
  },
  {
    version: 91,
    // §EPIC-browser-harness Task 4.1 — browser_test_runs table.
    // Stores structured browser test run results with JSON evidence fields.
    description: "browser_test_runs — browser test run results with JSON evidence (browser-harness)",
    sql: `
      CREATE TABLE IF NOT EXISTS browser_test_runs (
        id            TEXT PRIMARY KEY,
        runId         TEXT NOT NULL,
        targetUrl     TEXT NOT NULL,
        featureNodeId TEXT NOT NULL,
        status        TEXT NOT NULL DEFAULT 'running',
        evidences     TEXT NOT NULL DEFAULT '[]',
        pathTaken     TEXT NOT NULL DEFAULT '[]',
        startedAt     TEXT NOT NULL,
        endedAt       TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_browser_test_runs_feature
        ON browser_test_runs(featureNodeId);
      CREATE INDEX IF NOT EXISTS idx_browser_test_runs_status
        ON browser_test_runs(status);
    `,
  },
  {
    version: 92,
    // Task 2.1 (autonomy-gap-3-to-6 PRD): episodic memory outcome table.
    // Stores outcome-centric tuples per completed task for cross-task learning.
    description: "episodic_outcomes — outcome-centric memory tuples indexed by task_type (autonomy-gap Task 2.1)",
    sql: `
      CREATE TABLE IF NOT EXISTS episodic_outcomes (
        id               TEXT PRIMARY KEY,
        node_id          TEXT NOT NULL,
        task_type        TEXT NOT NULL DEFAULT '',
        tags             TEXT NOT NULL DEFAULT '',
        approach_summary TEXT NOT NULL DEFAULT '',
        outcome          TEXT NOT NULL CHECK(outcome IN ('success', 'partial', 'failure')),
        cycle_time_delta REAL NOT NULL DEFAULT 0,
        reopen_count     INTEGER NOT NULL DEFAULT 0,
        created_at       INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_episodic_outcomes_task_type_created
        ON episodic_outcomes(task_type, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_episodic_outcomes_created
        ON episodic_outcomes(created_at DESC);
    `,
  },
];

/** Apply pending schema migrations to the database. */
export function runMigrations(db: Database.Database): void {
  // B29 (node_ffe8d0eb034c): if data tables exist (e.g. nodes) but
  // _migrations was dropped, naively re-running migrations from v1 fails
  // with raw SqliteError ("duplicate column") that bubbles up as an
  // uncaught Node stack trace. Detect the orphaned-schema state and
  // refuse with a friendly error so the user knows to re-init or restore.
  const migrationsTableExists =
    db
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='_migrations'")
      .get() !== undefined;
  if (!migrationsTableExists) {
    const dataTableExists =
      db
        .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='nodes'")
        .get() !== undefined;
    if (dataTableExists) {
      throw new GraphIntegrityError(
        "Database has data tables but the _migrations tracking table is missing — orphaned schema. " +
          "Re-initialize with 'mcp-graph init' or restore from a snapshot.",
      );
    }
  }

  // Create migrations tracking table (no-op if it already exists)
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version     INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at  TEXT NOT NULL
    );
  `);

  const applied = new Set(
    db
      .prepare("SELECT version FROM _migrations")
      .all()
      .map((row) => (row as { version: number }).version),
  );

  // B30 (node_0490b58b326c): warn if the DB has migration rows for
  // versions newer than this build knows about — typical downgrade
  // scenario where an older mcp-graph runs against a newer DB. Surface
  // it instead of silently behaving as if the DB were current.
  const knownMaxVersion = migrations.reduce((m, x) => Math.max(m, x.version), 0);
  let appliedMax = 0;
  for (const v of applied) appliedMax = Math.max(appliedMax, v);
  if (appliedMax > knownMaxVersion) {
    log.warn("migration:newer-db", {
      appliedMax,
      knownMaxVersion,
      message:
        "Database has migrations newer than this mcp-graph build supports — possible downgrade",
    });
  }

  // Migrations that delete large amounts of data and benefit from VACUUM
  const VACUUM_AFTER_VERSIONS = new Set([10, 17, 30]);
  let needsVacuum = false;

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;

    log.info("migration:run", { version: migration.version, description: migration.description });
    db.transaction(() => {
      db.exec(migration.sql);
      db.prepare(
        "INSERT INTO _migrations (version, description, applied_at) VALUES (?, ?, ?)",
      ).run(migration.version, migration.description, new Date().toISOString());
    })();
    log.info("migration:ok", { version: migration.version });

    if (VACUUM_AFTER_VERSIONS.has(migration.version)) {
      needsVacuum = true;
    }
  }

  // VACUUM must run outside any transaction to reclaim space after heavy deletions
  if (needsVacuum) {
    try {
      db.exec("VACUUM");
      log.info("migration:vacuum:ok");
    } catch (err) {
      log.warn("migration:vacuum:failed", { error: err instanceof Error ? err.message : String(err) });
    }
  }
}

/** Set SQLite pragmas for WAL mode, performance, and safety. */
export function configureDb(db: Database.Database): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");
  db.pragma("cache_size = -8000");
  db.pragma("busy_timeout = 5000");
  db.pragma("temp_store = MEMORY");
  db.pragma("mmap_size = 67108864");
}
