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

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type {
  GraphDocument,
  GraphNode,
  GraphEdge,
  GraphProject,
  NodeType,
  NodeStatus,
  SourceRef,
} from "../graph/graph-types.js";
import { buildIndexes } from "../graph/graph-indexes.js";
import { generateId } from "../utils/id.js";
import { now } from "../utils/time.js";
import { configureDb, runMigrations } from "./migrations.js";
import { logger } from "../utils/logger.js";
import { GraphNotInitializedError, ValidationError, SnapshotNotFoundError, McpGraphError, ConflictError } from "../utils/errors.js";
import { GraphNodeSchema } from "../../schemas/node.schema.js";
import { GraphEdgeSchema } from "../../schemas/edge.schema.js";
import { z } from "zod/v4";

import { STORE_DIR, DB_FILE } from "../utils/constants.js";
import { normalizeNewlines } from "../utils/text.js";
import { AsyncMutex } from "../utils/async-mutex.js";
import { timedQuery } from "../utils/slow-query-logger.js";

/** Options for mutation operations (multi-agent support, ADR-10). */
export interface MutationOptions {
  agentId?: string;
  expectedVersion?: number;
}

// ── Row types (SQLite ↔ JS) ─────────────────────────────

interface ProjectRow {
  id: string;
  name: string;
  fs_path: string | null;
  created_at: string;
  updated_at: string;
}

interface NodeRow {
  id: string;
  project_id: string;
  type: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  xp_size: string | null;
  estimate_minutes: number | null;
  tags: string | null;
  parent_id: string | null;
  sprint: string | null;
  source_file: string | null;
  source_start_line: number | null;
  source_end_line: number | null;
  source_confidence: number | null;
  acceptance_criteria: string | null;
  test_files: string | null;
  blocked: number;
  metadata: string | null;
  evolution_reason: string | null;
  evolution_count: number | null;
  created_at: string;
  updated_at: string;
}

interface EdgeRow {
  id: string;
  project_id: string;
  from_node: string;
  to_node: string;
  relation_type: string;
  weight: number | null;
  reason: string | null;
  metadata: string | null;
  created_at: string;
}



// ── Mapping helpers ──────────────────────────────────────

/** Safely serialize a value to JSON, replacing NaN/Infinity with null and catching circular refs. */
function safeJsonStringify(value: unknown, field: string, nodeId: string): string | null {
  if (value === null || value === undefined) return null;
  let hadNonFinite = false;
  try {
    const resultValue = JSON.stringify(value, (_key, v) => {
      if (typeof v === "number" && !Number.isFinite(v)) {
        hadNonFinite = true;
        return null;
      }
      return v;
    });
    if (hadNonFinite) {
      logger.warn("Non-finite number sanitized to null in node field", { nodeId, field });
    }
    return resultValue;
  } catch (err) {
    logger.warn("Failed to serialize node field", { nodeId, field, error: String(err) });
    throw new ValidationError(
      `Invalid JSON in field '${field}' for node '${nodeId}': ${String(err)}`,
      [{ field, nodeId, error: String(err) }],
    );
  }
}

function nodeToRow(node: GraphNode, projectId: string): NodeRow {
  return {
    id: node.id,
    project_id: projectId,
    type: node.type,
    title: node.title,
    description: node.description ?? null,
    status: node.status,
    priority: node.priority,
    xp_size: node.xpSize ?? null,
    estimate_minutes: node.estimateMinutes ?? null,
    tags: safeJsonStringify(node.tags, "tags", node.id),
    parent_id: node.parentId ?? null,
    sprint: node.sprint ?? null,
    source_file: node.sourceRef?.file ?? null,
    source_start_line: node.sourceRef?.startLine ?? null,
    source_end_line: node.sourceRef?.endLine ?? null,
    source_confidence: node.sourceRef?.confidence ?? null,
    acceptance_criteria: safeJsonStringify(node.acceptanceCriteria, "acceptanceCriteria", node.id),
    test_files: safeJsonStringify(node.testFiles, "testFiles", node.id),
    blocked: node.blocked ? 1 : 0,
    metadata: safeJsonStringify(node.metadata, "metadata", node.id),
    evolution_reason: node.evolutionReason ?? null,
    evolution_count: node.evolutionCount ?? 0,
    created_at: node.createdAt,
    updated_at: node.updatedAt,
  };
}

function rowToNode(row: NodeRow): GraphNode {
  const node: GraphNode = {
    id: row.id,
    type: row.type as NodeType,
    title: row.title,
    status: row.status as NodeStatus,
    priority: row.priority as 1 | 2 | 3 | 4 | 5,
    blocked: row.blocked === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (row.description) node.description = row.description;
  if (row.xp_size) node.xpSize = row.xp_size as GraphNode["xpSize"];
  if (row.estimate_minutes != null) node.estimateMinutes = row.estimate_minutes;
  if (row.tags) {
    try { node.tags = JSON.parse(row.tags); } catch {
      logger.warn("corrupt JSON in node field", { nodeId: row.id, field: "tags" });
      node.tags = [];
    }
  }
  if (row.parent_id) node.parentId = row.parent_id;
  if (row.sprint) node.sprint = row.sprint;
  if (row.acceptance_criteria) {
    try { node.acceptanceCriteria = JSON.parse(row.acceptance_criteria); } catch {
      logger.warn("corrupt JSON in node field", { nodeId: row.id, field: "acceptanceCriteria" });
      node.acceptanceCriteria = [];
    }
  }
  if (row.test_files) {
    try { node.testFiles = JSON.parse(row.test_files); } catch {
      logger.warn("corrupt JSON in node field", { nodeId: row.id, field: "testFiles" });
      node.testFiles = [];
    }
  }
  if (row.metadata) {
    try { node.metadata = JSON.parse(row.metadata); } catch {
      logger.warn("corrupt JSON in node field", { nodeId: row.id, field: "metadata" });
      node.metadata = {};
    }
  }
  if (row.evolution_reason) node.evolutionReason = row.evolution_reason;
  if (row.evolution_count !== null && row.evolution_count !== undefined && row.evolution_count > 0) {
    node.evolutionCount = row.evolution_count;
  }

  if (row.source_file) {
    const ref: SourceRef = { file: row.source_file };
    if (row.source_start_line != null) ref.startLine = row.source_start_line;
    if (row.source_end_line != null) ref.endLine = row.source_end_line;
    if (row.source_confidence != null) ref.confidence = row.source_confidence;
    node.sourceRef = ref;
  }

  return node;
}

const MAX_EDGE_METADATA_SIZE = 100_000;
const MAX_NODE_METADATA_SIZE = 100_000;

function edgeToRow(edge: GraphEdge, projectId: string): EdgeRow {
  // Bug #055: validate edge metadata JSON size + Bug #E1-T04: validate JSON
  let metadataJson: string | null = null;
  if (edge.metadata) {
    let hadNonFinite = false;
    try {
      metadataJson = JSON.stringify(edge.metadata, (_key, v) => {
        if (typeof v === "number" && !Number.isFinite(v)) {
          hadNonFinite = true;
          return null;
        }
        return v;
      });
    } catch (err) {
      logger.warn("Failed to serialize edge metadata", { edgeId: edge.id, error: String(err) });
      throw new ValidationError(
        `Invalid JSON in field 'metadata' for edge '${edge.id}': ${String(err)}`,
        [{ field: "metadata", edgeId: edge.id, error: String(err) }],
      );
    }
    if (hadNonFinite) {
      logger.warn("Non-finite number sanitized to null in edge metadata", { edgeId: edge.id });
    }
  }
  if (metadataJson && metadataJson.length > MAX_EDGE_METADATA_SIZE) {
    throw new ValidationError(`Edge metadata too large (${metadataJson.length} chars, max ${MAX_EDGE_METADATA_SIZE})`, []);
  }
  return {
    id: edge.id,
    project_id: projectId,
    from_node: edge.from,
    to_node: edge.to,
    relation_type: edge.relationType,
    weight: edge.weight ?? null,
    reason: edge.reason ?? null,
    metadata: metadataJson,
    created_at: edge.createdAt,
  };
}

function rowToEdge(row: EdgeRow): GraphEdge {
  const edge: GraphEdge = {
    id: row.id,
    from: row.from_node,
    to: row.to_node,
    relationType: row.relation_type as GraphEdge["relationType"],
    createdAt: row.created_at,
  };

  if (row.weight != null) edge.weight = row.weight;
  if (row.reason) edge.reason = row.reason;
  if (row.metadata) {
    try { edge.metadata = JSON.parse(row.metadata); } catch { /* corrupted edge metadata — skip */ }
  }

  return edge;
}

// ── Row → Domain mapping ─────────────────────────────────

function rowToProject(row: ProjectRow): GraphProject {
  const project: GraphProject = {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.fs_path) project.fsPath = row.fs_path;
  return project;
}

// ── SqliteStore ──────────────────────────────────────────

export class SqliteStore {
  private db: Database.Database;
  private projectId: string | null = null;
  private _eventBus: import("../events/event-bus.js").GraphEventBus | null = null;
  /** Serializes multi-step write sequences that span async boundaries. */
  readonly writeMutex = new AsyncMutex();

  private constructor(db: Database.Database) {
    this.db = db;
  }

  /** Attach an event bus to emit mutation events */
  set eventBus(bus: import("../events/event-bus.js").GraphEventBus | null) {
    this._eventBus = bus;
  }

  get eventBus(): import("../events/event-bus.js").GraphEventBus | null {
    return this._eventBus;
  }

  /**
   * Open (or create) a store at basePath/workflow-graph/graph.db.
   * Pass ":memory:" for in-memory testing.
   */
  static open(basePath: string = process.cwd()): SqliteStore {
    let db: Database.Database;

    if (basePath === ":memory:") {
      db = new Database(":memory:");
    } else {
      const newDir = path.join(basePath, STORE_DIR);
      mkdirSync(newDir, { recursive: true });
      db = new Database(path.join(newDir, DB_FILE));
    }

    configureDb(db);
    runMigrations(db);

    const store = new SqliteStore(db);

    // Auto-load project if one exists
    const row = db
      .prepare("SELECT id FROM projects LIMIT 1")
      .get() as { id: string } | undefined;
    if (row) store.projectId = row.id;

    logger.info(`Store opened${basePath === ":memory:" ? " (in-memory)" : ` at ${basePath}`}`);
    return store;
  }

  /**
   * Open a store at an absolute DB file path.
   * Creates the file and parent dirs if they don't exist.
   * Useful for global mode where the DB is at ~/.mcp-graph/graph.db.
   */
  static openDb(dbPath: string): SqliteStore {
    const dir = path.dirname(dbPath);
    mkdirSync(dir, { recursive: true });

    const db = new Database(dbPath);
    configureDb(db);
    runMigrations(db);

    const store = new SqliteStore(db);

    // Auto-load project if one exists
    const row = db
      .prepare("SELECT id FROM projects LIMIT 1")
      .get() as { id: string } | undefined;
    if (row) store.projectId = row.id;

    logger.info(`Store opened at ${dbPath}`);
    return store;
  }

  /** Expose the raw database instance for extension modules (e.g. DocsCacheStore). */
  getDb(): Database.Database {
    return this.db;
  }

  /**
   * Run `fn` exclusively under the write mutex.
   * Use this to serialize multi-step write sequences that span async boundaries.
   * Single-step writes (insertNode, updateNode, etc.) already use SQLite transactions
   * and are safe without this wrapper; use it when you need to group multiple writes
   * as an atomic async unit at the application level.
   */
  async withWriteLock<T>(fn: () => T | Promise<T>): Promise<T> {
    return this.writeMutex.run(fn);
  }

  close(): void {
    this.db.close();
  }

  // ── Project ──────────────────────────────────────

  initProject(name?: string): GraphProject {
    // If no name provided and project already active, return current
    if (this.projectId && !name) {
      return this.getProject() as GraphProject;
    }

    // If name provided, check if same as current project
    if (this.projectId && name) {
      const current = this.getProject() as GraphProject;
      if (current.name === name) {
        return current;
      }
      // Check if a project with this name already exists
      const existing = this.db
        .prepare("SELECT * FROM projects WHERE name = ?")
        .get(name) as ProjectRow | undefined;
      if (existing) {
        this.projectId = existing.id;
        logger.info("Project activated by name", { name, projectId: existing.id });
        return rowToProject(existing);
      }
    }

    // No active project, or different name — check if project already exists by name
    const projectName = name || "Local MCP Graph";
    const existing = this.db
      .prepare("SELECT * FROM projects WHERE name = ?")
      .get(projectName) as ProjectRow | undefined;
    if (existing) {
      this.projectId = existing.id;
      logger.info("Project activated by name", { name: projectName, projectId: existing.id });
      return rowToProject(existing);
    }

    // If no name provided but a project exists in DB, reuse it
    if (!name) {
      const anyProject = this.db
        .prepare("SELECT * FROM projects LIMIT 1")
        .get() as ProjectRow | undefined;
      if (anyProject) {
        this.projectId = anyProject.id;
        logger.info("Project activated (existing)", { name: anyProject.name, projectId: anyProject.id });
        return rowToProject(anyProject);
      }
    }

    // Truly no project exists — create new
    const id = generateId("proj");
    const timestamp = now();
    this.db
      .prepare(
        "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
      )
      .run(id, projectName, timestamp, timestamp);

    this.projectId = id;
    logger.info(`Project initialized: ${projectName} (${id})`);
    return { id, name: projectName, createdAt: timestamp, updatedAt: timestamp };
  }

  getProject(): GraphProject | null {
    if (!this.projectId) return null;
    const row = this.db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(this.projectId) as ProjectRow | undefined;
    if (!row) return null;
    return rowToProject(row);
  }

  /** Alias for getProject — returns the currently active project. */
  getActiveProject(): GraphProject | null {
    return this.getProject();
  }

  /** List all projects in the database. */
  listProjects(): GraphProject[] {
    const rows = this.db
      .prepare("SELECT * FROM projects ORDER BY created_at")
      .all() as ProjectRow[];
    return rows.map(rowToProject);
  }

  /** Switch the active project. Throws if project ID does not exist. */
  activateProject(projectId: string): void {
    const row = this.db
      .prepare("SELECT id FROM projects WHERE id = ?")
      .get(projectId) as { id: string } | undefined;
    if (!row) {
      throw new ValidationError(`Project not found: ${projectId}`, []);
    }
    this.projectId = projectId;
    logger.info("Project activated", { projectId });
  }

  /**
   * Find a project by its filesystem path.
   * Returns null if no project is registered at that path.
   */
  findProjectByPath(fsPath: string): GraphProject | null {
    const row = this.db
      .prepare("SELECT * FROM projects WHERE fs_path = ?")
      .get(fsPath) as ProjectRow | undefined;
    return row ? rowToProject(row) : null;
  }

  /**
   * Register a project with a filesystem path.
   * If a project already exists at that path, returns the existing one.
   * Creates and activates a new project otherwise.
   */
  registerProject(name: string, fsPath: string): GraphProject {
    // Check if project already exists at this path
    const existing = this.findProjectByPath(fsPath);
    if (existing) {
      this.projectId = existing.id;
      logger.info("Project found by path", { name: existing.name, fsPath, projectId: existing.id });
      return existing;
    }

    // Create new project with fs_path
    const id = generateId("proj");
    const timestamp = now();
    this.db
      .prepare(
        "INSERT INTO projects (id, name, fs_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(id, name, fsPath, timestamp, timestamp);

    this.projectId = id;
    logger.info(`Project registered: ${name} at ${fsPath} (${id})`);
    return { id, name, fsPath, createdAt: timestamp, updatedAt: timestamp };
  }

  /**
   * Set or update the filesystem path for a project.
   */
  setProjectFsPath(projectId: string, fsPath: string): void {
    const timestamp = now();
    this.db
      .prepare("UPDATE projects SET fs_path = ?, updated_at = ? WHERE id = ?")
      .run(fsPath, timestamp, projectId);
    logger.info("Project fs_path updated", { projectId, fsPath });
  }

  private ensureProject(): string {
    if (!this.projectId) {
      throw new GraphNotInitializedError();
    }
    return this.projectId;
  }

  // ── Nodes ────────────────────────────────────────

  insertNode(node: GraphNode, options?: MutationOptions): void {
    try {
      GraphNodeSchema.parse(node);
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw new ValidationError("Invalid node", err.issues);
      }
      throw err;
    }
    // Bug #E1-T14: validate node metadata JSON size
    if (node.metadata) {
      const metadataJson = JSON.stringify(node.metadata);
      if (metadataJson.length > MAX_NODE_METADATA_SIZE) {
        throw new ValidationError(`Node metadata too large (${metadataJson.length} chars, max ${MAX_NODE_METADATA_SIZE})`, []);
      }
    }
    // Bug #E1-T09: reject self-referencing parentId on insert
    if (node.parentId && node.parentId === node.id) {
      throw new ValidationError(`Node '${node.id}' cannot be its own parent`, []);
    }

    const pid = this.ensureProject();
    const normalized = { ...node, description: normalizeNewlines(node.description) };
    const row = nodeToRow(normalized, pid);
    this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO nodes
            (id, project_id, type, title, description, status, priority,
             xp_size, estimate_minutes, tags, parent_id, sprint,
             source_file, source_start_line, source_end_line, source_confidence,
             acceptance_criteria, test_files, blocked, metadata,
             evolution_reason, evolution_count,
             created_at, updated_at, modified_by)
           VALUES
            (@id, @project_id, @type, @title, @description, @status, @priority,
             @xp_size, @estimate_minutes, @tags, @parent_id, @sprint,
             @source_file, @source_start_line, @source_end_line, @source_confidence,
             @acceptance_criteria, @test_files, @blocked, @metadata,
             @evolution_reason, @evolution_count,
             @created_at, @updated_at, @modified_by)`,
        )
        .run({ ...row, modified_by: options?.agentId ?? null });
    })();
    // Event emitted AFTER transaction succeeds
    this._eventBus?.emitTyped("node:created", { nodeId: node.id, title: node.title, nodeType: node.type });
  }

  getNodeById(id: string): GraphNode | null {
    this.ensureProject();
    const row = this.db
      .prepare("SELECT * FROM nodes WHERE id = ? AND project_id = ?")
      .get(id, this.projectId) as NodeRow | undefined;
    return row ? rowToNode(row) : null;
  }

  getAllNodes(): GraphNode[] {
    const pid = this.ensureProject();
    const rows = this.db
      .prepare("SELECT * FROM nodes WHERE project_id = ? ORDER BY created_at")
      .all(pid) as NodeRow[];
    return rows.map(rowToNode);
  }

  /** Paginated + filtered node query for dashboard API. */
  queryNodes(opts: {
    limit?: number;
    offset?: number;
    status?: NodeStatus[];
    type?: NodeType[];
    search?: string;
  }): { nodes: GraphNode[]; totalCount: number } {
    const pid = this.ensureProject();
    // E10-T05: Validate limit/offset boundaries
    const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
    const offset = Math.max(opts.offset ?? 0, 0);

    const conditions: string[] = ["project_id = ?"];
    const params: unknown[] = [pid];

    if (opts.status && opts.status.length > 0) {
      const placeholders = opts.status.map(() => "?").join(", ");
      conditions.push(`status IN (${placeholders})`);
      params.push(...opts.status);
    }

    if (opts.type && opts.type.length > 0) {
      const placeholders = opts.type.map(() => "?").join(", ");
      conditions.push(`type IN (${placeholders})`);
      params.push(...opts.type);
    }

    if (opts.search) {
      conditions.push("title LIKE ?");
      params.push(`%${opts.search}%`);
    }

    const where = conditions.join(" AND ");

    const countRow = this.db
      .prepare(`SELECT COUNT(*) as cnt FROM nodes WHERE ${where}`)
      .get(...params) as { cnt: number };
    const totalCount = countRow.cnt;

    const rows = this.db
      .prepare(
        `SELECT * FROM nodes WHERE ${where} ORDER BY created_at LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as NodeRow[];

    return { nodes: rows.map(rowToNode), totalCount };
  }

  getNodesByType(type: NodeType): GraphNode[] {
    const pid = this.ensureProject();
    const rows = this.db
      .prepare(
        "SELECT * FROM nodes WHERE project_id = ? AND type = ? ORDER BY created_at",
      )
      .all(pid, type) as NodeRow[];
    return rows.map(rowToNode);
  }

  getNodesByStatus(status: NodeStatus): GraphNode[] {
    const pid = this.ensureProject();
    const rows = this.db
      .prepare(
        "SELECT * FROM nodes WHERE project_id = ? AND status = ? ORDER BY created_at",
      )
      .all(pid, status) as NodeRow[];
    return rows.map(rowToNode);
  }

  getChildNodes(parentId: string): GraphNode[] {
    const pid = this.ensureProject();
    const rows = this.db
      .prepare(
        "SELECT * FROM nodes WHERE project_id = ? AND parent_id = ? ORDER BY created_at",
      )
      .all(pid, parentId) as NodeRow[];
    return rows.map(rowToNode);
  }

  updateNodeStatus(id: string, status: NodeStatus, options?: MutationOptions): GraphNode | null {
    const pid = this.ensureProject();
    const timestamp = now();

    // Read old status for changelog before mutation
    const oldNode = this.getNodeById(id);
    if (!oldNode) return null;
    const oldStatus = oldNode.status;

    const agentId = options?.agentId ?? null;
    const setClauses = ["status = ?", "updated_at = ?"];
    const params: unknown[] = [status, timestamp];

    if (agentId) {
      setClauses.push("modified_by = ?");
      params.push(agentId);
    }

    const resultValue = this.db
      .prepare(
        `UPDATE nodes SET ${setClauses.join(", ")} WHERE id = ? AND project_id = ?`,
      )
      .run(...params, id, pid);

    if (resultValue.changes === 0) return null;

    // Record status change in changelog with agent identity
    if (oldStatus !== status) {
      this.db.prepare(
        `INSERT INTO node_changelog (project_id, node_id, field, old_value, new_value, changed_at, agent_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(pid, id, "status", oldStatus, status, timestamp, agentId);
    }

    this._eventBus?.emitTyped("node:updated", { nodeId: id, fields: ["status"] });
    return this.getNodeById(id);
  }

  /** Walk up the parent chain from newParentId; return true if nodeId is found (cycle). */
  private detectParentCycle(nodeId: string, newParentId: string): boolean {
    const pid = this.ensureProject();
    let current: string | null = newParentId;
    const visited = new Set<string>();
    while (current) {
      if (current === nodeId) return true;
      if (visited.has(current)) return false;
      visited.add(current);
      const parent = this.db.prepare(
        "SELECT parent_id FROM nodes WHERE id = ? AND project_id = ?",
      ).get(current, pid) as { parent_id: string | null } | undefined;
      current = parent?.parent_id ?? null;
    }
    return false;
  }

  updateNode(
    id: string,
    fields: Partial<
      Pick<
        GraphNode,
        | "title"
        | "description"
        | "type"
        | "priority"
        | "xpSize"
        | "estimateMinutes"
        | "tags"
        | "parentId"
        | "sprint"
        | "blocked"
        | "acceptanceCriteria"
        | "testFiles"
        | "metadata"
        | "evolutionReason"
      >
    >,
    options?: MutationOptions,
  ): GraphNode | null {
    const pid = this.ensureProject();
    const existing = this.getNodeById(id);
    if (!existing) return null;

    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (fields.title !== undefined) {
      setClauses.push("title = ?");
      params.push(fields.title);
    }
    if (fields.description !== undefined) {
      setClauses.push("description = ?");
      params.push(normalizeNewlines(fields.description) ?? null);
    }
    if (fields.type !== undefined) {
      setClauses.push("type = ?");
      params.push(fields.type);
    }
    if (fields.priority !== undefined) {
      setClauses.push("priority = ?");
      params.push(fields.priority);
    }
    if (fields.xpSize !== undefined) {
      setClauses.push("xp_size = ?");
      params.push(fields.xpSize ?? null);
    }
    if (fields.estimateMinutes !== undefined) {
      setClauses.push("estimate_minutes = ?");
      params.push(fields.estimateMinutes ?? null);
    }
    if (fields.tags !== undefined) {
      setClauses.push("tags = ?");
      params.push(fields.tags ? JSON.stringify(fields.tags) : null);
    }
    if (fields.parentId !== undefined) {
      if (fields.parentId !== null && fields.parentId !== undefined) {
        if (fields.parentId === id || this.detectParentCycle(id, fields.parentId)) {
          throw new ValidationError(`Setting parentId '${fields.parentId}' on node '${id}' would create a cycle`, []);
        }
      }
      setClauses.push("parent_id = ?");
      params.push(fields.parentId ?? null);
    }
    if (fields.sprint !== undefined) {
      setClauses.push("sprint = ?");
      params.push(fields.sprint ?? null);
    }
    if (fields.blocked !== undefined) {
      setClauses.push("blocked = ?");
      params.push(fields.blocked ? 1 : 0);
    }
    if (fields.acceptanceCriteria !== undefined) {
      setClauses.push("acceptance_criteria = ?");
      params.push(
        fields.acceptanceCriteria
          ? JSON.stringify(fields.acceptanceCriteria)
          : null,
      );
    }
    if (fields.testFiles !== undefined) {
      setClauses.push("test_files = ?");
      params.push(fields.testFiles ? JSON.stringify(fields.testFiles) : null);
    }
    if (fields.metadata !== undefined) {
      // Bug #E1-T14: validate node metadata JSON size
      if (fields.metadata) {
        const metadataJson = JSON.stringify(fields.metadata);
        if (metadataJson.length > MAX_NODE_METADATA_SIZE) {
          throw new ValidationError(`Node metadata too large (${metadataJson.length} chars, max ${MAX_NODE_METADATA_SIZE})`, []);
        }
      }
      setClauses.push("metadata = ?");
      params.push(fields.metadata ? JSON.stringify(fields.metadata) : null);
    }
    if (fields.evolutionReason !== undefined) {
      // §extracta — atomic increment of evolution_count alongside the
      // reason set. Setting reason → null clears both fields.
      setClauses.push("evolution_reason = ?");
      params.push(fields.evolutionReason);
      if (fields.evolutionReason !== null) {
        setClauses.push("evolution_count = COALESCE(evolution_count, 0) + 1");
      } else {
        setClauses.push("evolution_count = 0");
      }
    }

    if (setClauses.length === 0) return existing;

    // Agent tracking (ADR-10): update modified_by and increment version
    if (options?.agentId) {
      setClauses.push("modified_by = ?");
      params.push(options.agentId);
    }
    setClauses.push("version = version + 1");

    const timestamp = now();
    setClauses.push("updated_at = ?");
    params.push(timestamp);
    params.push(id, pid);

    // ── Transaction: re-read existing + changelog + optimistic lock + write ──
    // Fix E1-T01: existing must be read INSIDE transaction to prevent race condition
    const serialize = (v: unknown): string | null => {
      if (v === undefined || v === null) return null;
      if (typeof v === "object") return JSON.stringify(v);
      return String(v);
    };

    const fieldMap: Record<string, (n: GraphNode) => unknown> = {
      title: (n) => n.title,
      description: (n) => n.description,
      type: (n) => n.type,
      priority: (n) => n.priority,
      xpSize: (n) => n.xpSize,
      estimateMinutes: (n) => n.estimateMinutes,
      tags: (n) => n.tags,
      parentId: (n) => n.parentId,
      sprint: (n) => n.sprint,
      blocked: (n) => n.blocked,
      acceptanceCriteria: (n) => n.acceptanceCriteria,
      testFiles: (n) => n.testFiles,
      metadata: (n) => n.metadata,
      evolutionReason: (n) => n.evolutionReason,
    };

    this.db.transaction(() => {
      // Re-read existing inside transaction for race-safe changelog diff
      const txExisting = this.getNodeById(id);
      const changelogEntries: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];
      if (txExisting) {
        for (const key of Object.keys(fields) as Array<keyof typeof fields>) {
          const getter = fieldMap[key];
          if (!getter) continue;
          const oldVal = serialize(getter(txExisting));
          const newVal = serialize(fields[key]);
          if (oldVal !== newVal) {
            changelogEntries.push({ field: key, oldValue: oldVal, newValue: newVal });
          }
        }
      }
      // Optimistic locking (ADR-08): if expectedVersion provided, verify before write
      if (options?.expectedVersion !== undefined) {
        const current = this.db.prepare(
          "SELECT version, modified_by, updated_at FROM nodes WHERE id = ? AND project_id = ?",
        ).get(id, pid) as { version: number; modified_by: string | null; updated_at: string } | undefined;

        if (current && current.version !== options.expectedVersion) {
          throw new ConflictError({
            currentVersion: current.version,
            expectedVersion: options.expectedVersion,
            modifiedBy: current.modified_by,
            modifiedAt: current.updated_at,
          });
        }
      }

      this.db
        .prepare(
          `UPDATE nodes SET ${setClauses.join(", ")} WHERE id = ? AND project_id = ?`,
        )
        .run(...params);

      if (changelogEntries.length > 0) {
        const insertChangelog = this.db.prepare(
          `INSERT INTO node_changelog (project_id, node_id, field, old_value, new_value, changed_at, agent_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        );
        const agentId = options?.agentId ?? null;
        for (const entry of changelogEntries) {
          insertChangelog.run(pid, id, entry.field, entry.oldValue, entry.newValue, timestamp, agentId);
        }
      }
    })();

    this._eventBus?.emitTyped("node:updated", { nodeId: id, fields: Object.keys(fields) });
    return this.getNodeById(id);
  }

  getNodeHistory(nodeId: string): Array<{ field: string; oldValue: string | null; newValue: string | null; changedAt: string; agentId: string | null }> {
    const pid = this.ensureProject();
    const rows = this.db.prepare(
      `SELECT field, old_value, new_value, changed_at, agent_id FROM node_changelog WHERE project_id = ? AND node_id = ? ORDER BY changed_at DESC, id DESC`,
    ).all(pid, nodeId) as Array<{ field: string; old_value: string | null; new_value: string | null; changed_at: string; agent_id: string | null }>;
    return rows.map((r) => ({
      field: r.field,
      oldValue: r.old_value,
      newValue: r.new_value,
      changedAt: r.changed_at,
      agentId: r.agent_id,
    }));
  }

  deleteNode(id: string): boolean {
    const pid = this.ensureProject();
    logger.debug("tx:delete-node", { id });

    // Bug #050: collect events inside transaction, emit AFTER commit
    const deletedNodeIds: string[] = [];

    const deleted = this.db.transaction(() => {
      // Recursively collect all descendant node IDs
      const toDelete: string[] = [];
      const collectDescendants = (nodeId: string): void => {
        toDelete.push(nodeId);
        const children = this.db
          .prepare("SELECT id FROM nodes WHERE project_id = ? AND parent_id = ?")
          .all(pid, nodeId) as { id: string }[];
        for (const child of children) {
          collectDescendants(child.id);
        }
      };
      collectDescendants(id);

      // Batch DELETE edges and nodes for all collected IDs (avoids N+1 pattern)
      if (toDelete.length > 0) {
        const placeholders = toDelete.map(() => "?").join(",");
        this.db
          .prepare(
            `DELETE FROM edges WHERE project_id = ? AND (from_node IN (${placeholders}) OR to_node IN (${placeholders}))`,
          )
          .run(pid, ...toDelete, ...toDelete);

        const resultValue = this.db
          .prepare(`DELETE FROM nodes WHERE project_id = ? AND id IN (${placeholders})`)
          .run(pid, ...toDelete);
        if (resultValue.changes > 0) {
          deletedNodeIds.push(...toDelete);
        }
      }

      const anyDeleted = deletedNodeIds.length > 0;

      return anyDeleted;
    })();

    // Emit events after transaction committed successfully
    for (const nodeId of deletedNodeIds) {
      this._eventBus?.emitTyped("node:deleted", { nodeId });
    }

    return deleted;
  }

  deleteEdge(id: string): boolean {
    const pid = this.ensureProject();
    const resultValue = this.db
      .prepare("DELETE FROM edges WHERE id = ? AND project_id = ?")
      .run(id, pid);
    const deleted = resultValue.changes > 0;
    if (deleted) this._eventBus?.emitTyped("edge:deleted", { edgeId: id });
    return deleted;
  }

  // ── Edges ────────────────────────────────────────

  insertEdge(edge: GraphEdge): void {
    try {
      GraphEdgeSchema.parse(edge);
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw new ValidationError("Invalid edge", err.issues);
      }
      throw err;
    }
    const pid = this.ensureProject();
    // Bug #E4-T02: check node existence inside transaction to prevent TOCTOU
    const inserted = this.db.transaction(() => {
      const fromExists = this.db.prepare("SELECT 1 FROM nodes WHERE id = ? AND project_id = ?").get(edge.from, pid);
      const toExists = this.db.prepare("SELECT 1 FROM nodes WHERE id = ? AND project_id = ?").get(edge.to, pid);
      if (!fromExists || !toExists) {
        logger.debug("edge:insert:skipped:missing-node", { edgeId: edge.id, from: edge.from, to: edge.to, fromExists: !!fromExists, toExists: !!toExists });
        return false;
      }
      const row = edgeToRow(edge, pid);
      this.db
        .prepare(
          `INSERT OR IGNORE INTO edges
            (id, project_id, from_node, to_node, relation_type, weight, reason, metadata, created_at)
           VALUES
            (@id, @project_id, @from_node, @to_node, @relation_type, @weight, @reason, @metadata, @created_at)`,
        )
        .run(row);
      return true;
    })();
    if (inserted) {
      this._eventBus?.emitTyped("edge:created", { edgeId: edge.id, from: edge.from, to: edge.to, relationType: edge.relationType });
    }
  }

  getEdgesFrom(nodeId: string): GraphEdge[] {
    const pid = this.ensureProject();
    const rows = this.db
      .prepare("SELECT * FROM edges WHERE project_id = ? AND from_node = ?")
      .all(pid, nodeId) as EdgeRow[];
    return rows.map(rowToEdge);
  }

  getEdgesTo(nodeId: string): GraphEdge[] {
    const pid = this.ensureProject();
    const rows = this.db
      .prepare("SELECT * FROM edges WHERE project_id = ? AND to_node = ?")
      .all(pid, nodeId) as EdgeRow[];
    return rows.map(rowToEdge);
  }

  getAllEdges(): GraphEdge[] {
    const pid = this.ensureProject();
    const rows = this.db
      .prepare("SELECT * FROM edges WHERE project_id = ? ORDER BY created_at")
      .all(pid) as EdgeRow[];
    return rows.map(rowToEdge);
  }

  // ── Import cleanup ─────────────────────────────────

  /**
   * Check if a source file has been previously imported.
   */
  hasImport(sourceFile: string): boolean {
    const pid = this.ensureProject();
    const row = this.db
      .prepare(
        "SELECT 1 FROM import_history WHERE project_id = ? AND source_file = ? LIMIT 1",
      )
      .get(pid, sourceFile) as unknown;
    return row !== undefined;
  }

  /**
   * Delete all nodes (and their edges) that were imported from a specific source file.
   * Also removes the import history entry so re-import is clean.
   */
  clearImportedNodes(sourceFile: string): { nodesDeleted: number; edgesDeleted: number } {
    const pid = this.ensureProject();
    logger.debug("tx:clear-imported", { sourceFile });

    // Safety snapshot before destructive operation
    const snapshotId = this.createSnapshot();
    logger.info("clear-imported:snapshot-created", { sourceFile, snapshotId });

    const cleared = this.db.transaction(() => {
      // Find node IDs from this source file
      const nodeIds = this.db
        .prepare(
          "SELECT id FROM nodes WHERE project_id = ? AND source_file = ?",
        )
        .all(pid, sourceFile) as { id: string }[];

      let edgesDeleted = 0;

      for (const { id } of nodeIds) {
        const resultValue = this.db
          .prepare(
            "DELETE FROM edges WHERE project_id = ? AND (from_node = ? OR to_node = ?)",
          )
          .run(pid, id, id);
        edgesDeleted += resultValue.changes;
      }

      const nodesResult = this.db
        .prepare(
          "DELETE FROM nodes WHERE project_id = ? AND source_file = ?",
        )
        .run(pid, sourceFile);

      // Clear import history for this source file
      this.db
        .prepare(
          "DELETE FROM import_history WHERE project_id = ? AND source_file = ?",
        )
        .run(pid, sourceFile);

      return { nodesDeleted: nodesResult.changes, edgesDeleted };
    })();

    // Bug #050: emit after transaction committed
    this._eventBus?.emitTyped("bulk:updated", { count: cleared.nodesDeleted + cleared.edgesDeleted, operation: "clearImportedNodes" });
    return cleared;
  }

  // ── Bulk ─────────────────────────────────────────

  bulkInsert(nodes: GraphNode[], edges: GraphEdge[]): void {
    const pid = this.ensureProject();
    logger.info(`Bulk insert: ${nodes.length} nodes, ${edges.length} edges`);

    logger.debug("tx:bulk-insert:start");
    this.db.transaction(() => {
      for (const node of nodes) {
        const row = nodeToRow(node, pid);
        this.db
          .prepare(
            `INSERT INTO nodes
              (id, project_id, type, title, description, status, priority,
               xp_size, estimate_minutes, tags, parent_id, sprint,
               source_file, source_start_line, source_end_line, source_confidence,
               acceptance_criteria, blocked, metadata, created_at, updated_at)
             VALUES
              (@id, @project_id, @type, @title, @description, @status, @priority,
               @xp_size, @estimate_minutes, @tags, @parent_id, @sprint,
               @source_file, @source_start_line, @source_end_line, @source_confidence,
               @acceptance_criteria, @blocked, @metadata, @created_at, @updated_at)`,
          )
          .run(row);
      }
      // Bug #E4-T02: validate node existence inside transaction before edge insert
      const nodeExistsStmt = this.db.prepare("SELECT 1 FROM nodes WHERE id = ? AND project_id = ?");
      for (const edge of edges) {
        const fromExists = nodeExistsStmt.get(edge.from, pid);
        const toExists = nodeExistsStmt.get(edge.to, pid);
        if (!fromExists || !toExists) {
          logger.debug("bulk-insert:edge:skipped:missing-node", { edgeId: edge.id, from: edge.from, to: edge.to });
          continue;
        }
        const row = edgeToRow(edge, pid);
        this.db
          .prepare(
            `INSERT OR IGNORE INTO edges
              (id, project_id, from_node, to_node, relation_type, weight, reason, metadata, created_at)
             VALUES
              (@id, @project_id, @from_node, @to_node, @relation_type, @weight, @reason, @metadata, @created_at)`,
          )
          .run(row);
      }
    })();
    logger.debug("tx:bulk-insert:done");
    this._eventBus?.emitTyped("import:completed", { nodesCreated: nodes.length, edgesCreated: edges.length });
  }

  /**
   * Merge-insert nodes and edges using INSERT OR IGNORE semantics for both.
   * Existing nodes (by ID) and edges (by unique constraint) are silently skipped.
   * Returns actual counts of rows inserted.
   */
  mergeInsert(nodes: GraphNode[], edges: GraphEdge[]): { nodesInserted: number; edgesInserted: number } {
    const pid = this.ensureProject();
    logger.info("merge-insert:start", { nodes: nodes.length, edges: edges.length });

    let nodesInserted = 0;
    let edgesInserted = 0;

    this.db.transaction(() => {
      for (const node of nodes) {
        const row = nodeToRow(node, pid);
        const resultValue = this.db
          .prepare(
            `INSERT OR IGNORE INTO nodes
              (id, project_id, type, title, description, status, priority,
               xp_size, estimate_minutes, tags, parent_id, sprint,
               source_file, source_start_line, source_end_line, source_confidence,
               acceptance_criteria, blocked, metadata, created_at, updated_at)
             VALUES
              (@id, @project_id, @type, @title, @description, @status, @priority,
               @xp_size, @estimate_minutes, @tags, @parent_id, @sprint,
               @source_file, @source_start_line, @source_end_line, @source_confidence,
               @acceptance_criteria, @blocked, @metadata, @created_at, @updated_at)`,
          )
          .run(row);
        nodesInserted += resultValue.changes;
      }
      // Bug #E4-T02: validate node existence inside transaction before edge insert
      const nodeExistsStmt = this.db.prepare("SELECT 1 FROM nodes WHERE id = ? AND project_id = ?");
      for (const edge of edges) {
        const fromExists = nodeExistsStmt.get(edge.from, pid);
        const toExists = nodeExistsStmt.get(edge.to, pid);
        if (!fromExists || !toExists) {
          logger.debug("merge-insert:edge:skipped:missing-node", { edgeId: edge.id, from: edge.from, to: edge.to });
          continue;
        }
        const row = edgeToRow(edge, pid);
        const resultValue = this.db
          .prepare(
            `INSERT OR IGNORE INTO edges
              (id, project_id, from_node, to_node, relation_type, weight, reason, metadata, created_at)
             VALUES
              (@id, @project_id, @from_node, @to_node, @relation_type, @weight, @reason, @metadata, @created_at)`,
          )
          .run(row);
        edgesInserted += resultValue.changes;
      }
    })();

    logger.info("merge-insert:done", { nodesInserted, edgesInserted });
    this._eventBus?.emitTyped("import:completed", { nodesCreated: nodesInserted, edgesCreated: edgesInserted });
    return { nodesInserted, edgesInserted };
  }

  // ── Snapshots ────────────────────────────────────

  createSnapshot(): number {
    const pid = this.ensureProject();
    const doc = this.toGraphDocument();
    const resultValue = this.db
      .prepare(
        "INSERT INTO snapshots (project_id, data, created_at) VALUES (?, ?, ?)",
      )
      .run(pid, JSON.stringify(doc), now());
    return resultValue.lastInsertRowid as number;
  }

  // ── Import history ───────────────────────────────

  recordImport(
    sourceFile: string,
    nodesCreated: number,
    edgesCreated: number,
  ): void {
    const pid = this.ensureProject();
    this.db
      .prepare(
        `INSERT INTO import_history (project_id, source_file, nodes_created, edges_created, imported_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(pid, sourceFile, nodesCreated, edgesCreated, now());
  }

  // ── Stats ────────────────────────────────────────

  getStats(): {
    totalNodes: number;
    totalEdges: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  } {
    const pid = this.ensureProject();

    const totalNodes = (
      this.db
        .prepare("SELECT COUNT(*) as c FROM nodes WHERE project_id = ?")
        .get(pid) as { c: number }
    ).c;

    const totalEdges = (
      this.db
        .prepare("SELECT COUNT(*) as c FROM edges WHERE project_id = ?")
        .get(pid) as { c: number }
    ).c;

    const byType: Record<string, number> = {};
    const typeRows = this.db
      .prepare(
        "SELECT type, COUNT(*) as c FROM nodes WHERE project_id = ? GROUP BY type",
      )
      .all(pid) as { type: string; c: number }[];
    for (const rVar of typeRows) byType[rVar.type] = rVar.c;

    const byStatus: Record<string, number> = {};
    const statusRows = this.db
      .prepare(
        "SELECT status, COUNT(*) as c FROM nodes WHERE project_id = ? GROUP BY status",
      )
      .all(pid) as { status: string; c: number }[];
    for (const rVar of statusRows) byStatus[rVar.status] = rVar.c;

    return { totalNodes, totalEdges, byType, byStatus };
  }

  // ── Project Settings ──────────────────────────

  getProjectSetting(key: string): string | null {
    const pid = this.ensureProject();
    const row = this.db
      .prepare("SELECT value FROM project_settings WHERE project_id = ? AND key = ?")
      .get(pid, key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  setProjectSetting(key: string, value: string): void {
    const pid = this.ensureProject();
    const timestamp = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO project_settings (project_id, key, value, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(project_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(pid, key, value, timestamp);
  }

  // ── Full-text search ─────────────────────────────

  /**
   * Search nodes using FTS5 with BM25 ranking.
   * Returns nodes ordered by relevance score.
   */
  searchNodes(query: string, limit: number = 20): Array<GraphNode & { score: number }> {
    const pid = this.ensureProject();

    // FTS5 match query — escape user input for safety
    const sql = `SELECT n.*, bm25(nodes_fts) AS score
         FROM nodes_fts fts
         JOIN nodes n ON n.rowid = fts.rowid
         WHERE nodes_fts MATCH ?
           AND n.project_id = ?
         ORDER BY score
         LIMIT ?`;
    const rows = timedQuery(sql, () =>
      this.db.prepare(sql).all(query, pid, limit),
    ) as (NodeRow & { score: number })[];

    return rows.map((row) => ({
      ...rowToNode(row),
      score: Math.abs(row.score),
    }));
  }

  // ── Bulk status update ─────────────────────────

  bulkUpdateStatus(ids: string[], status: NodeStatus): { updated: string[]; notFound: string[] } {
    this.ensureProject();
    logger.debug("tx:bulk-update-status", { count: ids.length, status });
    const updated: string[] = [];
    const notFound: string[] = [];

    this.db.transaction(() => {
      for (const id of ids) {
        const resultValue = this.updateNodeStatus(id, status);
        if (resultValue) {
          updated.push(id);
        } else {
          notFound.push(id);
        }
      }
    })();

    return { updated, notFound };
  }

  // ── Restore snapshot ──────────────────────────

  restoreSnapshot(snapshotId: number): { nodesValid: number; nodesInvalid: number; edgesRestored: number } {
    const pid = this.ensureProject();
    logger.debug("tx:restore-snapshot", { snapshotId });
    const row = this.db
      .prepare("SELECT data FROM snapshots WHERE rowid = ? AND project_id = ?")
      .get(snapshotId, pid) as { data: string } | undefined;

    if (!row) {
      throw new SnapshotNotFoundError(snapshotId);
    }

    // Bug #048: validate snapshot JSON structure before restoring
    let doc: GraphDocument;
    try {
      const parsed = JSON.parse(row.data);
      if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
        throw new Error("Invalid snapshot structure: missing nodes or edges arrays");
      }
      doc = parsed as GraphDocument;
    } catch (err) {
      throw new McpGraphError(`Corrupt snapshot ${snapshotId}: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Bug #E1-T11: validate each node with GraphNodeSchema before insert
    const validNodes: GraphNode[] = [];
    let nodesInvalid = 0;
    for (const node of doc.nodes) {
      const resultValue = GraphNodeSchema.safeParse(node);
      if (resultValue.success) {
        validNodes.push(resultValue.data as GraphNode);
      } else {
        nodesInvalid++;
        logger.warn("Invalid node in snapshot — skipped", {
          snapshotId,
          nodeId: (node as unknown as Record<string, unknown>).id ?? "unknown",
          issues: resultValue.error.issues.map((i) => i.message).join("; "),
        });
      }
    }

    let edgesRestored = 0;
    this.db.transaction(() => {
      this.db.prepare("DELETE FROM edges WHERE project_id = ?").run(pid);
      this.db.prepare("DELETE FROM nodes WHERE project_id = ?").run(pid);

      for (const node of validNodes) {
        const rVar = nodeToRow(node, pid);
        this.db
          .prepare(
            `INSERT INTO nodes
              (id, project_id, type, title, description, status, priority,
               xp_size, estimate_minutes, tags, parent_id, sprint,
               source_file, source_start_line, source_end_line, source_confidence,
               acceptance_criteria, blocked, metadata, created_at, updated_at)
             VALUES
              (@id, @project_id, @type, @title, @description, @status, @priority,
               @xp_size, @estimate_minutes, @tags, @parent_id, @sprint,
               @source_file, @source_start_line, @source_end_line, @source_confidence,
               @acceptance_criteria, @blocked, @metadata, @created_at, @updated_at)`,
          )
          .run(rVar);
      }
      for (const edge of doc.edges) {
        const rVar = edgeToRow(edge, pid);
        this.db
          .prepare(
            `INSERT INTO edges
              (id, project_id, from_node, to_node, relation_type, weight, reason, metadata, created_at)
             VALUES
              (@id, @project_id, @from_node, @to_node, @relation_type, @weight, @reason, @metadata, @created_at)`,
          )
          .run(rVar);
        edgesRestored++;
      }
    })();

    if (nodesInvalid > 0) {
      logger.info("Snapshot restored with invalid nodes skipped", {
        snapshotId,
        nodesValid: validNodes.length,
        nodesInvalid,
        edgesRestored,
      });
    }

    return { nodesValid: validNodes.length, nodesInvalid, edgesRestored };
  }

  listSnapshots(): Array<{ snapshotId: number; createdAt: string }> {
    const pid = this.ensureProject();
    const rows = this.db
      .prepare(
        "SELECT id, created_at FROM snapshots WHERE project_id = ? ORDER BY id DESC",
      )
      .all(pid) as Array<{ id: number; created_at: string }>;
    return rows.map((r) => ({ snapshotId: r.id, createdAt: r.created_at }));
  }

  // ── Bridge: materialize full GraphDocument ───────

  toGraphDocument(): GraphDocument {
    const project = this.getProject();
    if (!project) {
      throw new GraphNotInitializedError();
    }

    const nodes = this.getAllNodes();
    const edges = this.getAllEdges();
    const indexes = buildIndexes(nodes, edges);

    // Collect source files from import history
    const pid = this.ensureProject();
    const imports = this.db
      .prepare(
        "SELECT DISTINCT source_file FROM import_history WHERE project_id = ?",
      )
      .all(pid) as { source_file: string }[];

    const lastImportRow = this.db
      .prepare(
        "SELECT imported_at FROM import_history WHERE project_id = ? ORDER BY imported_at DESC LIMIT 1",
      )
      .get(pid) as { imported_at: string } | undefined;

    return {
      version: "1.0.0",
      project,
      nodes,
      edges,
      indexes,
      meta: {
        sourceFiles: imports.map((r) => r.source_file),
        lastImport: lastImportRow?.imported_at ?? null,
      },
    };
  }
}
