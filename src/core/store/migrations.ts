import type Database from "better-sqlite3";
import { logger } from "../utils/logger.js";

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
];

/** Apply pending schema migrations to the database. */
export function runMigrations(db: Database.Database): void {
  // Create migrations tracking table
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

  // Migrations that delete large amounts of data and benefit from VACUUM
  const VACUUM_AFTER_VERSIONS = new Set([10, 17, 30]);
  let needsVacuum = false;

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;

    logger.info("migration:run", { version: migration.version, description: migration.description });
    db.transaction(() => {
      db.exec(migration.sql);
      db.prepare(
        "INSERT INTO _migrations (version, description, applied_at) VALUES (?, ?, ?)",
      ).run(migration.version, migration.description, new Date().toISOString());
    })();
    logger.info("migration:ok", { version: migration.version });

    if (VACUUM_AFTER_VERSIONS.has(migration.version)) {
      needsVacuum = true;
    }
  }

  // VACUUM must run outside any transaction to reclaim space after heavy deletions
  if (needsVacuum) {
    try {
      db.exec("VACUUM");
      logger.info("migration:vacuum:ok");
    } catch (err) {
      logger.warn("migration:vacuum:failed", { error: err instanceof Error ? err.message : String(err) });
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
