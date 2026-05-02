/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.D4 + D5 — Lessons store: persister + consultant.
 * D4: persistLessonsFromPatterns() promove patterns recorrentes (count > N)
 * em lessons_learned (source='dream-wake' ou caller-provided).
 * D5: consultLessons(query) retorna lessons aplicáveis ordenadas por
 * confidence DESC para start_task injetar no modelHint context.
 */

import type Database from "better-sqlite3";

export const PATTERN_TO_LESSON_THRESHOLD = 3;

export interface LessonInput {
  patternHash: string;
  description: string;
  recommendedAction: string;
  confidence?: number;
  source?: string;
}

export interface LessonRow {
  id: string;
  patternHash: string;
  description: string;
  recommendedAction: string;
  confidence: number;
  appliedCount: number;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface PatternRecord {
  patternHash: string;
  description: string;
  count: number;
  recommendedAction?: string;
}

/** Insert OR update (UPSERT-by-hash). Increments applied_count when matched. */
export function persistLesson(db: Database.Database, lesson: LessonInput): LessonRow {
  const now = new Date().toISOString();
  const existing = db
    .prepare(
      `SELECT id, applied_count, created_at FROM lessons_learned WHERE pattern_hash = ?`,
    )
    .get(lesson.patternHash) as
    | { id: string; applied_count: number; created_at: string }
    | undefined;

  if (existing) {
    db.prepare(
      `UPDATE lessons_learned
         SET applied_count = applied_count + 1,
             confidence = MAX(confidence, ?),
             updated_at = ?
       WHERE id = ?`,
    ).run(lesson.confidence ?? 0.5, now, existing.id);
    return getLessonByHash(db, lesson.patternHash) as LessonRow;
  }

  const id = `lesson-${lesson.patternHash}-${Date.now()}`;
  db.prepare(
    `INSERT INTO lessons_learned
       (id, pattern_hash, description, recommended_action, applied_count, confidence, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)`,
  ).run(
    id,
    lesson.patternHash,
    lesson.description,
    lesson.recommendedAction,
    lesson.confidence ?? 0.5,
    lesson.source ?? "unknown",
    now,
    now,
  );
  return getLessonByHash(db, lesson.patternHash) as LessonRow;
}

/**
 * §D4 — Walk a list of recorded patterns; any with count >= threshold becomes
 * a lesson. Returns the IDs persisted (or refreshed).
 */
export function persistLessonsFromPatterns(
  db: Database.Database,
  patterns: PatternRecord[],
  source: string = "dream-wake",
  threshold: number = PATTERN_TO_LESSON_THRESHOLD,
): LessonRow[] {
  const out: LessonRow[] = [];
  for (const pVar of patterns) {
    if (pVar.count < threshold) continue;
    out.push(
      persistLesson(db, {
        patternHash: pVar.patternHash,
        description: pVar.description,
        recommendedAction: pVar.recommendedAction ?? "investigate",
        confidence: Math.min(0.5 + pVar.count * 0.1, 0.95),
        source,
      }),
    );
  }
  return out;
}

function rowToLesson(row: Record<string, unknown>): LessonRow {
  return {
    id: row.id as string,
    patternHash: row.pattern_hash as string,
    description: row.description as string,
    recommendedAction: row.recommended_action as string,
    confidence: row.confidence as number,
    appliedCount: row.applied_count as number,
    source: row.source as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/** getLessonByHash — auto-generated description placeholder. */
export function getLessonByHash(
  db: Database.Database,
  patternHash: string,
): LessonRow | undefined {
  const row = db
    .prepare(`SELECT * FROM lessons_learned WHERE pattern_hash = ?`)
    .get(patternHash) as Record<string, unknown> | undefined;
  return row ? rowToLesson(row) : undefined;
}

/**
 * §D5 — Consultant: fetch lessons whose description matches any query token,
 * ordered by confidence DESC. Limit defaults to 5 to keep token cost low.
 */
export function consultLessons(
  db: Database.Database,
  query: string,
  limit: number = 5,
): LessonRow[] {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9_-]/g, ""))
    .filter((t) => t.length >= 3);

  if (tokens.length === 0) return [];

  const conditions = tokens.map(() => "LOWER(description) LIKE ?").join(" OR ");
  const params = tokens.map((t) => `%${t}%`);
  const rows = db
    .prepare(
      `SELECT * FROM lessons_learned
       WHERE ${conditions}
       ORDER BY confidence DESC, applied_count DESC
       LIMIT ?`,
    )
    .all(...params, limit) as Array<Record<string, unknown>>;
  return rows.map(rowToLesson);
}

/** isLessonsConsultantDisabled — auto-generated description placeholder. */
export function isLessonsConsultantDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.MCP_GRAPH_LESSONS_CONSULTANT === "off";
}

/**
 * §D5 — Format top lessons as a compact string for injection into
 * modelHint.context. Caps at maxChars to keep token cost bounded (~200 tok).
 */
export function formatLessonsForContext(lessons: LessonRow[], maxChars: number = 800): string {
  if (lessons.length === 0) return "";
  const lines = lessons.map(
    (l, i) =>
      `${i + 1}. [${l.recommendedAction}] ${l.description} (conf=${l.confidence.toFixed(2)}, applied=${l.appliedCount}x)`,
  );
  const joined = `Past lessons:\n${lines.join("\n")}`;
  return joined.length <= maxChars ? joined : `${joined.slice(0, maxChars - 3)}...`;
}

/**
 * §D5 — Combined helper for start_task: respects toggle, queries by node text,
 * returns formatted context string ready to inject. Top-K=3 by default.
 */
export function buildLessonsContext(
  db: Database.Database,
  nodeText: string,
  topK: number = 3,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (isLessonsConsultantDisabled(env)) return "";
  const lessons = consultLessons(db, nodeText, topK);
  return formatLessonsForContext(lessons);
}
